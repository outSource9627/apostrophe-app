import { useEffect, useState } from 'react'
import { ApiClientError } from '../api/types'
import { api } from '../api/index'
import { getConfig } from '../api/config'
import type { EmployerJobRow, ApplicationStatus } from '../api/employerJobs'
import type { PickedMedia } from '../api/uploads'
import { employmentLabel } from '../jobs/format'
import type { EmTone } from '../../components/employer/em'

/**
 * EM-17..EM-21 on the phone — the web's jobParts rules, once: how a post's
 * state reads, the meta line, IST stamps, and the job video's checks and upload.
 */

/**
 * A post a moderator turned down is a DRAFT carrying `moderation.reason` — there
 * is no REJECTED status — so "Not approved" is derived, never fetched.
 */
export type JobView = 'LIVE' | 'IN_REVIEW' | 'NOT_APPROVED' | 'DRAFT' | 'PAUSED' | 'CLOSED'

export const JOB_VIEW_LABEL: Record<JobView, string> = {
  LIVE: 'Live', IN_REVIEW: 'In review', NOT_APPROVED: 'Not approved', DRAFT: 'Draft', PAUSED: 'Paused', CLOSED: 'Closed',
}
export const JOB_VIEW_TONE: Record<JobView, EmTone> = {
  LIVE: 'green', IN_REVIEW: 'amber', NOT_APPROVED: 'red', DRAFT: 'gray', PAUSED: 'violet', CLOSED: 'gray',
}

export function jobView(job: Pick<EmployerJobRow, 'status' | 'moderation'>): JobView {
  switch (job.status) {
    case 'PUBLISHED': return 'LIVE'
    case 'PENDING_MODERATION': return 'IN_REVIEW'
    case 'PAUSED': return 'PAUSED'
    case 'CLOSED': return 'CLOSED'
    default: return job.moderation.reason ? 'NOT_APPROVED' : 'DRAFT'
  }
}

export const APPLICATION_TONE: Record<ApplicationStatus, EmTone> = {
  APPLIED: 'gray', VIEWED: 'violet', SHORTLISTED: 'amber', REJECTED: 'red', CONNECTED: 'green',
}

/** 'PUNE · REMOTE · FULL-TIME · VIDEO POST'. */
export function jobMeta(job: Pick<EmployerJobRow, 'location' | 'remote' | 'employmentType' | 'hasVideo'>): string {
  return [
    job.location,
    job.remote && !/remote/i.test(job.location ?? '') ? 'Remote' : null,
    job.employmentType ? employmentLabel(job.employmentType as Parameters<typeof employmentLabel>[0]) : null,
    job.hasVideo ? 'Video post' : null,
  ].filter(Boolean).join(' · ').toUpperCase()
}

// ── IST ──────────────────────────────────────────────────────────────────────
const IST_MS = 330 * 60_000
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function ist(iso: string | number | Date) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const d = new Date(t + IST_MS)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }
}
/** '21 Sep' */
export const istDay = (iso: string) => { const p = ist(iso); return p ? `${p.d} ${MON[p.mo]}` : '' }
/** '30 Sep 2026' */
export const istDayYear = (iso: string) => { const p = ist(iso); return p ? `${p.d} ${MON[p.mo]} ${p.y}` : '' }
/** '9:40 AM' */
export const istClock = (iso: string) => {
  const p = ist(iso)
  return p ? `${p.h % 12 === 0 ? 12 : p.h % 12}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}` : ''
}
/** '20 Sep, 10:02 AM' */
export const istStamp = (iso: string) => `${istDay(iso)}, ${istClock(iso)}`

/** The end of an IST day, as the ISO instant a deadline is sent as. */
export function endOfIstDay(y: number, mo: number, d: number): string {
  return new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - IST_MS).toISOString()
}

/** True once the deadline's IST day is over. */
export function deadlinePassed(iso: string | null): boolean {
  if (!iso) return false
  const p = ist(iso)
  if (!p) return false
  return Date.UTC(p.y, p.mo, p.d, 23, 59, 59, 999) - IST_MS < Date.now()
}

/** '0:52' */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

export const hoursPhrase = (h: number) => `${h} ${h === 1 ? 'hour' : 'hours'}`

/** The moderation target in hours, and the job video's rules — from the admin's settings; absent means say nothing. */
export function useJobConfig() {
  const [cfg, setCfg] = useState<{ moderationHours?: number; video: VideoRule; rejectMax?: number }>({ video: {} })
  useEffect(() => {
    let live = true
    getConfig()
      .then((c) => {
        if (!live) return
        const rule = c.uploads?.JOB_VIDEO
        setCfg({
          moderationHours: c.employer?.jobModerationTargetHours,
          rejectMax: c.employer?.rejectReasonMaxChars,
          video: { contentTypes: rule?.contentTypes, maxBytes: rule?.maxBytes, maxSeconds: c.employer?.jobVideoMaxSeconds },
        })
      })
      .catch(() => {})
    return () => { live = false }
  }, [])
  return cfg
}

// ── the job video ────────────────────────────────────────────────────────────
export interface VideoRule {
  contentTypes?: readonly string[]
  maxBytes?: number
  maxSeconds?: number
}

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

/** A sentence naming what is wrong with a picked video, or null when it may go. */
export function checkJobVideo(file: PickedMedia, rule: VideoRule): string | null {
  if (rule.contentTypes?.length && !rule.contentTypes.includes(file.type)) return 'Not a video type we accept. Choose an MP4 or MOV.'
  if (rule.maxBytes != null && file.size > rule.maxBytes) return `${megabytes(file.size)}. Upload up to ${Math.round(rule.maxBytes / 1048576)} MB.`
  if (file.width && file.height && file.width > file.height) return 'This video is landscape. Record it vertically, in 9:16.'
  if (rule.maxSeconds != null && file.durationSec > rule.maxSeconds) return `${clock(file.durationSec)} long. Trim to ${rule.maxSeconds} s.`
  return null
}

interface Presigned { key: string; url: string; method: 'PUT'; headers: Record<string, string> }

export const VIDEO_CANCELLED = 'Cancelled.'

/** Presign for JOB_VIDEO, then PUT the bytes with XHR (real progress, and a cancel that stops the data). */
export async function uploadJobVideo(
  file: PickedMedia,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<string> {
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new Error(`${file.name} could not be read from this phone.`)
  }
  if (opts.signal?.aborted) throw new Error(VIDEO_CANCELLED)
  let presigned: Presigned
  try {
    presigned = await api.post<Presigned>('/employers/me/uploads', {
      purpose: 'JOB_VIDEO',
      contentType: file.type,
      sizeBytes: body.size || file.size,
      fileName: file.name,
    })
  } catch (e) {
    if (e instanceof ApiClientError) throw new Error(e.message)
    throw new Error('The connection dropped before the upload started and nothing was saved.')
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
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total) }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 403 ? 'The upload link expired before the video finished. Try again.' : 'Storage did not accept the video. Try again.'))
    xhr.onerror = () => reject(new Error('The connection dropped and nothing was saved.'))
    xhr.onabort = () => reject(new Error(VIDEO_CANCELLED))
    if (opts.signal) {
      if (opts.signal.aborted) return reject(new Error(VIDEO_CANCELLED))
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })
  return presigned.key
}
