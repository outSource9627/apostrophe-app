import { ApiClientError } from './types'
import { api } from './index'

/**
 * Student uploads — the app half of the web's `uploadFile` (apostrophe-user
 * lib/api/profile.ts). Presign with POST /uploads/sign, then PUT the bytes
 * straight to storage with XHR, which is still the only way to read progress
 * and to abort mid-flight so a cancelled video stops using mobile data.
 *
 * The rules (types, size) are the server's own, read from /config `uploads`,
 * and checked here first so a 300 MB file is refused in the hand.
 */
export type UploadPurpose = 'PROFILE_PHOTO' | 'QUALIFICATION_DOC' | 'RESUME' | 'DOCUMENT' | 'SELF_VIDEO'
export interface UploadRule { contentTypes: string[]; maxBytes: number; label: string }

interface Presigned { key: string; url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string }

/** A file the person chose: a file:// or content:// uri plus what the picker said about it. */
export interface PickedMedia { uri: string; name: string; type: string; size: number; durationSec: number; width?: number; height?: number }

export const UPLOAD_CANCELLED = 'Cancelled.'

export const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(0)} MB`

type ImagePicker = typeof import('react-native-image-picker')
/** Required lazily: a build whose native module is missing fails on the press, with a sentence, not at launch. */
function loadImagePicker(): ImagePicker | null {
  try { return require('react-native-image-picker') as ImagePicker } catch { return null }
}

/**
 * Opens the phone's gallery for one video. Resolves null when the person backs
 * out. Android 13+ uses the system photo picker, which needs no permission.
 */
export async function pickVideo(): Promise<PickedMedia | null> {
  const picker = loadImagePicker()
  if (!picker) throw new Error('The video picker could not open on this phone.')
  const res = await picker.launchImageLibrary({ mediaType: 'video', selectionLimit: 1 })
  if (res.didCancel) return null
  if (res.errorCode) throw new Error(res.errorMessage || 'The video picker could not open on this phone.')
  const a = res.assets?.[0]
  if (!a?.uri) return null
  let size = a.fileSize ?? 0
  if (!size) {
    try { size = (await (await fetch(a.uri)).blob()).size } catch { size = 0 }
  }
  return {
    uri: a.uri,
    name: a.fileName || decodeURIComponent(a.uri.split('/').pop() || 'video'),
    type: a.type || 'video/mp4',
    size,
    durationSec: a.duration ?? 0,
    width: a.width,
    height: a.height,
  }
}

/** Presign, then send the bytes. Resolves with the storage key to attach. */
export async function uploadMedia(
  purpose: UploadPurpose,
  file: PickedMedia,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<string> {
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new Error(`${file.name} could not be read from this phone.`)
  }
  if (opts.signal?.aborted) throw new Error(UPLOAD_CANCELLED)
  // S3 signs Content-Length, so the size signed must be the size of what is sent.
  const sizeBytes = body.size || file.size

  const presigned = await api.post<Presigned>('/uploads/sign', {
    purpose,
    contentType: file.type,
    sizeBytes,
    fileName: file.name,
  })

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
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total) }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 403 ? 'The upload link expired before the video finished. Try again.' : 'The upload was refused. Try again.'))
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection.'))
    xhr.onabort = () => reject(new Error(UPLOAD_CANCELLED))
    if (opts.signal) {
      if (opts.signal.aborted) return reject(new Error(UPLOAD_CANCELLED))
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })

  return presigned.key
}

/** A readable sentence for any failure an upload flow can throw. */
export const uploadErrorText = (e: unknown) =>
  e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : 'The upload failed. Try again.'
