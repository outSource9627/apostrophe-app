import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { ApiClientError } from '../api/types'
import { ownDocumentLink } from '../api/student'
import {
  megabytes, uploadErrorText, uploadMedia, UPLOAD_CANCELLED, type PickedMedia, type UploadPurpose, type UploadRule,
} from '../api/uploads'

/**
 * ST-35 — the profile's own files on the phone: the résumé and certificates
 * today, and any other profile file that is picked from the phone's documents
 * (the qualification document can use the same hook when it is wired). The app
 * half of the web's FileUpload (apostrophe-user components/profile/controls.tsx):
 * pick one file with the system picker, check it against the server's rule
 * (`/config` uploads.RESUME / DOCUMENT / QUALIFICATION_DOC), presign and send
 * it with `uploadMedia`, and hand back the storage key.
 *
 * Nothing here saves the profile. The documents step's shell does (the
 * wizard's autosave, the profile page's sheet), and the profile page's own
 * Replace and Remove send the same PATCH body the step does, built here.
 */
export type ProfileFilePurpose = Extract<UploadPurpose, 'RESUME' | 'DOCUMENT' | 'QUALIFICATION_DOC'>

/** A document as the documents step sends it (PATCH /students/me/profile/documents). */
export interface DocEntry { kind: string; key: string; name?: string }

/** A document as GET /students/me/profile returns it: `id` is what View signs a link for. */
export interface ProfileDocument extends DocEntry {
  id?: string
  contentType?: string | null
  sizeBytes?: number | null
  uploadedAt?: string
}

type DocPicker = typeof import('@react-native-documents/picker')
/** Required lazily: a build whose native module is missing fails on the press, with a sentence, not at launch. */
function loadPicker(): DocPicker | null {
  try { return require('@react-native-documents/picker') as DocPicker } catch { return null }
}

const COULD_NOT_OPEN = 'The file picker could not open on this phone.'

/**
 * What the system picker is asked to show: the rule's own types. Android takes
 * the MIME types as they are; iOS wants the matching UTIs, which the picker
 * resolves. Without a rule nothing is guessed — every file is offered and the
 * server refuses what it must.
 */
function pickTypes(picker: DocPicker, rule: UploadRule | undefined): string[] {
  if (!rule?.contentTypes.length) return [picker.types.allFiles]
  if (Platform.OS !== 'ios') return [...rule.contentTypes]
  const utis = rule.contentTypes
    .map((mime) => picker.isKnownType({ kind: 'mimeType', value: mime }).UTType)
    .filter((u): u is string => !!u)
  return utis.length ? utis : [picker.types.allFiles]
}

/**
 * Some Android document providers hand over no type (or a bare octet-stream)
 * for a perfectly good PDF, so the type is then read from the extension. The
 * resolved type is what gets signed, and storage enforces it.
 */
function resolveType(picker: DocPicker, name: string, type: string | null): string {
  if (type && type !== 'application/octet-stream') return type
  const dot = name.lastIndexOf('.')
  if (dot < 0) return type ?? ''
  try {
    return picker.isKnownType({ kind: 'extension', value: name.slice(dot + 1).toLowerCase() }).mimeType ?? type ?? ''
  } catch {
    return type ?? ''
  }
}

/** Opens the system picker for one document. Resolves null when the person backs out. */
export async function pickProfileFile(rule: UploadRule | undefined): Promise<PickedMedia | null> {
  const picker = loadPicker()
  if (!picker) throw new Error(COULD_NOT_OPEN)
  let picked: Awaited<ReturnType<DocPicker['pick']>>[number]
  try {
    ;[picked] = await picker.pick({ type: pickTypes(picker, rule), mode: 'import', allowMultiSelection: false })
  } catch (e) {
    if (picker.isErrorWithCode(e) && e.code === picker.errorCodes.OPERATION_CANCELED) return null
    throw new Error(COULD_NOT_OPEN)
  }
  const name = picked.name || decodeURIComponent(picked.uri.split('/').pop() || '') || 'document'
  let size = picked.size ?? 0
  if (!size) {
    try { size = (await (await fetch(picked.uri)).blob()).size } catch { size = 0 }
  }
  return { uri: picked.uri, name, type: resolveType(picker, name, picked.type), size, durationSec: 0 }
}

/**
 * The fault with a picked file, in the web's words, or null when it may go.
 * Every number is the server's, from `/config`; without a rule nothing is
 * refused here and the server decides.
 */
export function refuseProfileFile(file: Pick<PickedMedia, 'name' | 'type' | 'size'>, rule: UploadRule | undefined): string | null {
  if (!rule) return null
  if (!rule.contentTypes.includes(file.type)) return `${file.name} is not a file we accept. Choose ${rule.label}.`
  if (file.size > rule.maxBytes) {
    return `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${megabytes(rule.maxBytes)}.`
  }
  return null
}

/** The line under a file field: the server's own rule ("A PDF or Word document up to 10 MB."). */
export function ruleSentence(rule: UploadRule | undefined): string {
  if (!rule?.label) return 'The file type and size are checked when you upload.'
  return `${rule.label.charAt(0).toUpperCase()}${rule.label.slice(1)}.`
}

/**
 * The documents with `entry` as THE résumé. The server keeps one (a second is
 * refused), so an existing résumé is swapped in its place rather than kept
 * beside it — and a profile saved before that rule, with two, ends up with one.
 */
export function withResume<T extends DocEntry>(docs: readonly T[], entry: DocEntry): DocEntry[] {
  const out: DocEntry[] = []
  let placed = false
  for (const d of docs) {
    if (d.kind !== 'RESUME') out.push(d)
    else if (!placed) {
      out.push(entry)
      placed = true
    }
  }
  if (!placed) out.push(entry)
  return out
}

/** The documents without the one stored under `key`. */
export const withoutDocument = <T extends DocEntry>(docs: readonly T[], key: string): T[] => docs.filter((d) => d.key !== key)

/** The documents step's PATCH body — only what the step accepts, with no empty name. */
export function documentsBody(docs: readonly DocEntry[], portfolioLinks: readonly string[]) {
  return {
    documents: docs.map(({ kind, key, name }) => ({ kind, key, ...(name ? { name } : {}) })),
    portfolioLinks: [...portfolioLinks],
  }
}

/**
 * What to tell the student when a save is refused. A refused field carries the
 * server's sentence ("Keep one résumé. Remove the old one, or replace it."),
 * which says more than the request's "Some fields need attention."
 */
export function saveErrorText(e: unknown): string {
  if (e instanceof ApiClientError) {
    const field = e.fields ? Object.values(e.fields).find(Boolean) : undefined
    return field ?? e.message
  }
  return 'Could not save. Try again.'
}

/** View: the student's own file through its 15-minute link, in the phone's browser or PDF viewer. */
export async function openOwnDocument(docId: string): Promise<string | null> {
  try {
    const r = await ownDocumentLink(docId)
    await Linking.openURL(r.url)
    return null
  } catch (e) {
    return e instanceof ApiClientError ? e.message : 'The document did not open. Try again.'
  }
}

/**
 * Pick, check and upload one profile file, with the progress and the refusal
 * a file field draws. `run` resolves with the storage key and the file's name
 * for the caller to save, or null when nothing was uploaded (backed out,
 * refused, cancelled, failed — `error` says which needs saying). Leaving the
 * screen mid-upload aborts it, so a closed sheet stops using mobile data.
 */
export function useProfileUpload() {
  const [file, setFile] = useState<PickedMedia | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      abort.current?.abort()
    }
  }, [])

  const run = useCallback(async (purpose: ProfileFilePurpose, rule: UploadRule | undefined): Promise<{ key: string; name: string } | null> => {
    if (busy.current) return null
    busy.current = true
    setError(null)
    try {
      let picked: PickedMedia | null
      try { picked = await pickProfileFile(rule) } catch (e) { if (alive.current) setError(uploadErrorText(e)); return null }
      if (!picked || !alive.current) return null
      const refusal = refuseProfileFile(picked, rule)
      if (refusal) { setError(refusal); return null }
      const ctl = new AbortController()
      abort.current = ctl
      setFile(picked)
      setProgress(0)
      try {
        const key = await uploadMedia(purpose, picked, { onProgress: (f) => { if (alive.current) setProgress(f) }, signal: ctl.signal })
        return { key, name: picked.name }
      } catch (e) {
        // A cancel is not a refusal: the field goes back to the picker, with nothing to say.
        if (alive.current && !(e instanceof Error && e.message === UPLOAD_CANCELLED)) setError(uploadErrorText(e))
        return null
      }
    } finally {
      busy.current = false
      abort.current = null
      if (alive.current) {
        setFile(null)
        setProgress(null)
      }
    }
  }, [])

  const cancel = useCallback(() => abort.current?.abort(), [])

  return { file, progress, uploading: progress !== null, error, setError, run, cancel }
}
