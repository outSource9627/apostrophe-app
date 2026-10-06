import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../api'
import type { MessageDto, ThreadDto, ThreadPage } from '../api/chat'
import { ChatSendError, useThreadSocket, type ThreadRest } from './socket'
import { fmtBytes, isChatRefusal, newClientMessageId, refusalCopy } from './format'
import { pickChatDocument, pickChatImage, uploadChatAttachment, type ChatFile } from './upload'

/** The newest page on open, and each page back (the server's default and its keyset size). */
const PAGE = 50
/** My "typing" goes quiet this long after the last keystroke. */
const MY_TYPING_IDLE_MS = 2500
/** Their "typing" is dropped if no update arrives this long (a lost `typing: false`). */
const PEER_TYPING_TIMEOUT_MS = 6000

/** One persona's endpoints: the page reader, and the REST half of send / mark-read (the socket is shared). */
export interface ChatThreadSource {
  getPage: (id: string, params: { before?: string; limit?: number }) => Promise<ThreadPage>
  rest: ThreadRest
}

/** A send failure, in words: CH-06's refusal sentence when the server gave a code, its message otherwise. */
function failureCopy(e: unknown, fallback: string): { text: string; refused: boolean } {
  const reason = e instanceof ChatSendError ? e.reason : e instanceof ApiClientError ? e.meta?.reason : undefined
  if (isChatRefusal(reason)) return { text: refusalCopy(reason), refused: true }
  return { text: e instanceof Error && e.message ? e.message : fallback, refused: false }
}

/**
 * One conversation, for every persona — the load, the paging back, the socket
 * (new messages, read receipts, typing), the draft and the send. The student,
 * employer and interviewer thread screens each hand it their own endpoints and
 * draw what it returns with the shared pieces in components/chat.
 *
 *   OLDER MESSAGES. The newest 50 come first; `loadOlder` fetches the page
 *   before the oldest one held (`nextBefore`, the server's keyset cursor) and
 *   puts it on top, until the server says there is no more.
 *
 *   A TEXT IS SHOWN AT ONCE, marked "Sending", and swapped for the stored
 *   message on the ack; a refused send takes it back out, puts the words back
 *   in the field and says why. A file is uploaded first (its progress is
 *   `uploading`, 0–100), then sent.
 *
 *   `endSignal` changes whenever the transcript should go to its newest line:
 *   the first load, and each send.
 */
export function useChatThread(id: string, source: ChatThreadSource) {
  const src = useRef(source)
  src.current = source

  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [sending, setSending] = useState<ReadonlySet<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [before, setBefore] = useState<string | null>(null)
  const [older, setOlder] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [peerTyping, setPeerTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [endSignal, setEndSignal] = useState(0)

  const myTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const olderBusy = useRef(false)

  useEffect(() => () => {
    if (myTypingTimer.current) clearTimeout(myTypingTimer.current)
    if (peerTimer.current) clearTimeout(peerTimer.current)
  }, [])

  /** (Re)reads the newest page. Messages paged back earlier are dropped — the newest 50 are the truth after a change. */
  const load = useCallback(async () => {
    setError(null)
    try {
      const page = await src.current.getPage(id, { limit: PAGE })
      setThread(page.thread)
      setMessages([...page.rows].reverse())
      setBefore(page.nextBefore)
      setOlder('idle')
      setEndSignal((n) => n + 1)
      src.current.rest.markRead(id).catch(() => {})
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'This conversation is not available.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const loadOlder = useCallback(() => {
    if (!before || olderBusy.current) return
    olderBusy.current = true
    setOlder('loading')
    src.current
      .getPage(id, { before, limit: PAGE })
      .then((page) => {
        setMessages((prev) => {
          const held = new Set(prev.map((m) => m.id))
          return [...[...page.rows].reverse().filter((m) => !held.has(m.id)), ...prev]
        })
        setBefore(page.nextBefore)
        setOlder('idle')
      })
      .catch(() => setOlder('failed'))
      .finally(() => {
        olderBusy.current = false
      })
  }, [id, before])

  const upsert = useCallback((m: MessageDto) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      if (i === -1) return [...prev, m]
      const next = [...prev]
      next[i] = m
      return next
    })
  }, [])

  /** The ack's stored message takes the optimistic one's place (and never sits beside a copy that came over the socket first). */
  const settle = useCallback((clientId: string, real: MessageDto) => {
    setMessages((prev) => {
      const out = prev.filter((x) => x.id !== real.id)
      const i = out.findIndex((x) => x.id === clientId)
      if (i === -1) return [...out, real]
      out[i] = real
      return out
    })
  }, [])

  const socket = useThreadSocket(
    thread ? id : null,
    {
      onMessage: (m) => {
        upsert(m)
        if (!m.mine) {
          setPeerTyping(false)
          socket.markRead()
        }
      },
      onRead: (r) => setMessages((prev) => prev.map((m) => (m.mine && !m.readAt ? { ...m, readAt: r.at } : m))),
      onTyping: (t) => {
        setPeerTyping(t.typing)
        if (peerTimer.current) clearTimeout(peerTimer.current)
        if (t.typing) peerTimer.current = setTimeout(() => setPeerTyping(false), PEER_TYPING_TIMEOUT_MS)
      },
    },
    source.rest,
  )

  function onDraft(v: string) {
    setDraft(v)
    socket.setTyping(v.trim().length > 0)
    if (myTypingTimer.current) clearTimeout(myTypingTimer.current)
    myTypingTimer.current = setTimeout(() => socket.setTyping(false), MY_TYPING_IDLE_MS)
  }

  async function sendText() {
    const body = draft.trim()
    if (!body || busy) return
    const clientMessageId = newClientMessageId()
    const optimistic: MessageDto = {
      id: clientMessageId, mine: true, kind: 'TEXT', systemKind: null, body, attachment: null,
      deliveredAt: null, readAt: null, createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setSending((s) => new Set(s).add(clientMessageId))
    setDraft('')
    setSendError(null)
    setEndSignal((n) => n + 1)
    socket.setTyping(false)
    setBusy(true)
    try {
      const { message } = await socket.send({ body, clientMessageId })
      settle(clientMessageId, message)
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== clientMessageId))
      setDraft(body)
      const f = failureCopy(e, 'That did not send. Try again.')
      setSendError(f.text)
      if (f.refused) load()
    } finally {
      setSending((s) => {
        const next = new Set(s)
        next.delete(clientMessageId)
        return next
      })
      setBusy(false)
    }
  }

  async function sendFile(file: ChatFile) {
    if (busy) return
    setBusy(true)
    setSendError(null)
    setUploading(0)
    try {
      const attachment = await uploadChatAttachment(file, (f) => setUploading(Math.round(f * 100)))
      const { message } = await socket.send({ attachment, clientMessageId: newClientMessageId() })
      upsert(message)
      setEndSignal((n) => n + 1)
    } catch (e) {
      const f = failureCopy(e, `${file.name} did not send. Try again.`)
      setSendError(f.text)
      if (f.refused) load()
    } finally {
      setBusy(false)
      setUploading(null)
    }
  }

  /** Pick a photo or a document, hold it to the admin's size limit (when known), then upload and send it. */
  async function attach(kind: 'image' | 'document', maxBytes: number | null) {
    setSendError(null)
    try {
      const file = kind === 'image' ? await pickChatImage() : await pickChatDocument()
      if (!file) return
      if (maxBytes && file.size > maxBytes) {
        setSendError(`${file.name} is over ${fmtBytes(maxBytes)}. Choose a smaller file.`)
        return
      }
      await sendFile(file)
    } catch (e) {
      setSendError(e instanceof Error && e.message ? e.message : 'The file did not attach.')
    }
  }

  return {
    thread, messages, sending, error, load,
    hasOlder: !!before, older, loadOlder,
    peerTyping, connected: socket.connected,
    draft, onDraft, busy, sendError, uploading, sendText, attach,
    endSignal,
  }
}

export type ChatThread = ReturnType<typeof useChatThread>
