import { Platform } from 'react-native'
import { api } from '../api/index'
import { ApiClientError } from '../api/types'
import type { SendAttachment } from '../api/chat'

/**
 * A chat attachment (CH-08) on the phone — the app twin of apostrophe-user
 * lib/chat/upload.ts: presign under the caller's own root (POST /me/uploads),
 * PUT the bytes straight to storage, and hand back what sendMessage wants. The
 * only two kinds are a picture (JPG/PNG) and a document (PDF/Word); their limits
 * are the server's (`config.uploads.CHAT_IMAGE` / `CHAT_DOCUMENT`) and the server
 * enforces them either way.
 */
export interface ChatFile { uri: string; name: string; type: string; size: number }

interface Presigned { key: string; url: string; method: 'PUT'; headers: Record<string, string> }

type DocPicker = typeof import('@react-native-documents/picker')
type ImagePicker = typeof import('react-native-image-picker')
const load = <T,>(name: 'doc' | 'image'): T | null => {
  try {
    return (name === 'doc' ? require('@react-native-documents/picker') : require('react-native-image-picker')) as T
  } catch {
    return null
  }
}

const DOC_TYPES = Platform.select({
  ios: ['com.adobe.pdf', 'com.microsoft.word.doc', 'org.openxmlformats.wordprocessingml.document'],
  default: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
})

async function sizeOf(uri: string, known?: number | null) {
  if (known) return known
  try { return (await (await fetch(uri)).blob()).size } catch { return 0 }
}

/** A photo from the gallery (JPG/PNG). Null when the person backs out. */
export async function pickChatImage(): Promise<ChatFile | null> {
  const picker = load<ImagePicker>('image')
  if (!picker) throw new Error('The photo picker could not open on this phone.')
  const res = await picker.launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 })
  if (res.didCancel) return null
  if (res.errorCode) throw new Error(res.errorMessage || 'The photo picker could not open on this phone.')
  const a = res.assets?.[0]
  if (!a?.uri) return null
  return { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.type || 'image/jpeg', size: await sizeOf(a.uri, a.fileSize) }
}

/** A PDF or Word document. Null when the person backs out. */
export async function pickChatDocument(): Promise<ChatFile | null> {
  const picker = load<DocPicker>('doc')
  if (!picker) throw new Error('The file picker could not open on this phone.')
  try {
    const [p] = await picker.pick({ type: DOC_TYPES, mode: 'import', allowMultiSelection: false })
    const name = p.name || decodeURIComponent(p.uri.split('/').pop() || 'document')
    return { uri: p.uri, name, type: p.type ?? 'application/pdf', size: await sizeOf(p.uri, p.size) }
  } catch (e) {
    if (picker.isErrorWithCode(e) && e.code === picker.errorCodes.OPERATION_CANCELED) return null
    throw new Error('The file picker could not open on this phone.')
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png']
export const isChatImage = (type: string) => IMAGE_TYPES.includes(type)

/** Presign, send the bytes, and return the attachment to send. */
export async function uploadChatAttachment(file: ChatFile, onProgress?: (fraction: number) => void): Promise<SendAttachment> {
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new Error(`${file.name} could not be read from this phone.`)
  }
  const sizeBytes = body.size || file.size
  let presigned: Presigned
  try {
    presigned = await api.post<Presigned>('/me/uploads', {
      purpose: isChatImage(file.type) ? 'CHAT_IMAGE' : 'CHAT_DOCUMENT',
      contentType: file.type,
      sizeBytes,
      fileName: file.name,
    })
  } catch (e) {
    throw new Error(e instanceof ApiClientError ? e.message : 'The connection dropped before the upload started.')
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(presigned.method, presigned.url)
    let typed = false
    for (const [k, v] of Object.entries(presigned.headers)) {
      if (k.toLowerCase() === 'content-length') continue
      if (k.toLowerCase() === 'content-type') typed = true
      xhr.setRequestHeader(k, v)
    }
    if (!typed) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload was refused. Try again.')))
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection.'))
    xhr.send(body)
  })
  return { key: presigned.key, contentType: file.type, sizeBytes, fileName: file.name }
}
