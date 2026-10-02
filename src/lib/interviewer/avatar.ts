import { ApiClientError } from '../api/types'
import { AVATAR_MAX_BYTES, getAvatarUploadUrl, type AvatarContentType } from '../api/interviewer'

/**
 * The interviewer's profile photo on the phone: pick one (gallery or camera),
 * check it against the server's limits, then presign (POST
 * /interviewers/me/profile/avatar-upload), PUT the bytes to storage with the
 * headers verbatim, and hand back the key for PATCH avatarKey.
 */
export interface AvatarFile { uri: string; type: AvatarContentType; size: number }

type ImagePicker = typeof import('react-native-image-picker')
const picker = (): ImagePicker | null => {
  try { return require('react-native-image-picker') as ImagePicker } catch { return null }
}

const TYPES: AvatarContentType[] = ['image/jpeg', 'image/png', 'image/webp']

/** Null when the person backs out; throws a sentence when the photo is unusable. */
export async function pickAvatar(source: 'library' | 'camera'): Promise<AvatarFile | null> {
  const p = picker()
  if (!p) throw new Error('The photo picker could not open on this phone.')
  const opts = { mediaType: 'photo' as const, selectionLimit: 1, maxWidth: 1024, maxHeight: 1024, quality: 0.8 as const }
  const res = source === 'camera' ? await p.launchCamera(opts) : await p.launchImageLibrary(opts)
  if (res.didCancel) return null
  if (res.errorCode) throw new Error(res.errorMessage || 'The photo picker could not open on this phone.')
  const a = res.assets?.[0]
  if (!a?.uri) return null
  const type = (a.type ?? 'image/jpeg').toLowerCase() as AvatarContentType
  if (!TYPES.includes(type)) throw new Error('Use a JPG, PNG or WebP photo.')
  let size = a.fileSize ?? 0
  if (!size) { try { size = (await (await fetch(a.uri)).blob()).size } catch { size = 0 } }
  if (size > AVATAR_MAX_BYTES) throw new Error('That photo is over 5 MB. Pick a smaller one.')
  return { uri: a.uri, type, size }
}

/** Presign and upload; resolves with the key to PATCH. Throws the server's sentence or ours. */
export async function uploadAvatar(file: AvatarFile): Promise<string> {
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new Error('That photo could not be read from this phone.')
  }
  const sizeBytes = body.size || file.size
  let presigned: Awaited<ReturnType<typeof getAvatarUploadUrl>>
  try {
    presigned = await getAvatarUploadUrl({ contentType: file.type, sizeBytes })
  } catch (e) {
    throw new Error(e instanceof ApiClientError ? e.message : 'The connection dropped before the upload started.')
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(presigned.method, presigned.url)
    let typed = false
    for (const [k, v] of Object.entries(presigned.headers ?? {})) {
      if (k.toLowerCase() === 'content-length') continue
      if (k.toLowerCase() === 'content-type') typed = true
      xhr.setRequestHeader(k, v)
    }
    if (!typed) xhr.setRequestHeader('Content-Type', file.type)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload was refused. Try again.')))
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection.'))
    xhr.send(body)
  })
  return presigned.key
}
