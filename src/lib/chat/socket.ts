import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '../../config/env'
import { tokenStore } from '../api'
import { sendMessage as restSend, markThreadRead as restMarkRead, type MessageDto, type SendAttachment } from '../api/chat'

/**
 * The student half of CH-10 — the socket gateway, client side. The app twin of
 * apostrophe-user's lib/chat/socket.ts, kept in step so the two surfaces behave
 * identically.
 *
 * ONE GATE, TWO TRANSPORTS. Sending over the socket and over REST hit the same
 * server write path and the same refusals; only the socket BROADCASTS
 * `message:new` to the recipient. So we send over the socket whenever it is
 * connected and fall back to REST when it is not — a REST send still persists,
 * the recipient just sees it on their next refetch.
 *
 * The handshake re-reads the user and runs again on every reconnect, so a fresh
 * access token is fetched per attempt via the auth callback (Keychain-backed).
 */

const EV = {
  join: 'thread:join',
  leave: 'thread:leave',
  send: 'message:send',
  incoming: 'message:new',
  read: 'message:read',
  readReceipt: 'message:read:ack',
  typing: 'typing',
  typingUpdate: 'typing:update',
  error: 'chat:error',
} as const

export interface IncomingMessage { threadId: string; message: MessageDto }
export interface ReadReceipt { threadId: string; by: string; at: string }
export interface TypingUpdate { threadId: string; userId: string; typing: boolean }

let socket: Socket | null = null

/** The lazily-created singleton. One socket per app; every thread multiplexes over it. */
export function getChatSocket(): Socket {
  if (socket) return socket
  socket = io(SOCKET_URL, {
    path: '/socket',
    transports: ['websocket'],
    autoConnect: true,
    auth: (cb) => {
      tokenStore
        .get()
        .then((t) => cb({ token: t?.accessToken ?? '' }))
        .catch(() => cb({ token: '' }))
    },
  })
  return socket
}

export class ChatSendError extends Error {
  constructor(public code: string, message: string, public reason?: string) {
    super(message)
    this.name = 'ChatSendError'
  }
}

type SendInput = { body?: string; attachment?: SendAttachment; clientMessageId?: string }

/**
 * The REST half for one role. The socket is the same for every role; its REST
 * fallback is not (/students/me/messages vs /employers/messages), so a caller
 * that is not a student passes its own.
 */
export interface ThreadRest {
  send: (threadId: string, input: SendInput) => Promise<{ message: MessageDto; duplicate: boolean }>
  markRead: (threadId: string) => Promise<unknown>
}

const STUDENT_REST: ThreadRest = { send: restSend, markRead: restMarkRead }

/** Send over the socket with an ack (5s), or fall back to REST when disconnected. */
function socketSend(threadId: string, input: SendInput, rest: ThreadRest = STUDENT_REST): Promise<{ message: MessageDto; duplicate: boolean }> {
  const s = getChatSocket()
  if (!s.connected) return rest.send(threadId, input)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rest.send(threadId, input).then(resolve, reject)
    }, 5000)
    s.emit(EV.send, { threadId, ...input }, (res: unknown) => {
      clearTimeout(timer)
      const r = res as { ok?: boolean; message?: MessageDto; error?: { code: string; message: string; reason?: string } }
      if (r?.ok && r.message) resolve({ message: r.message, duplicate: false })
      else if (r?.error) reject(new ChatSendError(r.error.code, r.error.message, r.error.reason))
      else reject(new ChatSendError('INTERNAL', 'Message could not be sent.'))
    })
  })
}

export interface ThreadSocketHandlers {
  onMessage?: (m: MessageDto, threadId: string) => void
  onRead?: (r: ReadReceipt) => void
  onTyping?: (t: TypingUpdate) => void
}

export interface ThreadSocket {
  connected: boolean
  send: (input: SendInput) => Promise<{ message: MessageDto; duplicate: boolean }>
  markRead: () => void
  setTyping: (typing: boolean) => void
}

/**
 * Joins one thread's room (needed for `typing:update`, thread-room only) and
 * wires its live events. `message:new` also arrives via the auto-joined user
 * room, so it is delivered even before the join resolves.
 */
export function useThreadSocket(threadId: string | null, handlers: ThreadSocketHandlers, rest: ThreadRest = STUDENT_REST): ThreadSocket {
  const [connected, setConnected] = useState(false)
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    if (!threadId) return
    const s = getChatSocket()
    if (!s.connected) s.connect()

    const onConnect = () => { setConnected(true); s.emit(EV.join, { threadId }) }
    const onDisconnect = () => setConnected(false)
    const onIncoming = (p: IncomingMessage) => { if (p.threadId === threadId) h.current.onMessage?.(p.message, p.threadId) }
    const onReadReceipt = (p: ReadReceipt) => { if (p.threadId === threadId) h.current.onRead?.(p) }
    const onTyping = (p: TypingUpdate) => { if (p.threadId === threadId) h.current.onTyping?.(p) }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on(EV.incoming, onIncoming)
    s.on(EV.readReceipt, onReadReceipt)
    s.on(EV.typingUpdate, onTyping)

    setConnected(s.connected)
    if (s.connected) s.emit(EV.join, { threadId })

    return () => {
      s.emit(EV.leave, { threadId })
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off(EV.incoming, onIncoming)
      s.off(EV.readReceipt, onReadReceipt)
      s.off(EV.typingUpdate, onTyping)
    }
  }, [threadId])

  return {
    connected,
    send: (input) => socketSend(threadId!, input, rest),
    markRead: () => {
      const s = getChatSocket()
      if (s.connected) s.emit(EV.read, { threadId })
      else if (threadId) void rest.markRead(threadId).catch(() => {})
    },
    setTyping: (typing) => {
      const s = getChatSocket()
      if (s.connected && threadId) s.emit(EV.typing, { threadId, typing })
    },
  }
}

/**
 * The list-level subscription: connect and hear `message:new` /
 * `message:read:ack` for ANY thread (via the user room), so the Chats list can
 * bump previews and unread counts without a thread being open.
 */
export function useChatSocketEvents(handlers: { onMessage?: (p: IncomingMessage) => void; onRead?: (p: ReadReceipt) => void }): boolean {
  const [connected, setConnected] = useState(false)
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    const s = getChatSocket()
    if (!s.connected) s.connect()
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onIncoming = (p: IncomingMessage) => h.current.onMessage?.(p)
    const onReadReceipt = (p: ReadReceipt) => h.current.onRead?.(p)
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on(EV.incoming, onIncoming)
    s.on(EV.readReceipt, onReadReceipt)
    setConnected(s.connected)
    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off(EV.incoming, onIncoming)
      s.off(EV.readReceipt, onReadReceipt)
    }
  }, [])

  return connected
}
