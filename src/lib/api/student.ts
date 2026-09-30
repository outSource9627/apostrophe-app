import { api } from './index'

/**
 * What employers can see of the student, and whether they are in the feed at
 * all. `published` is false until a video resume is live — until then the
 * visibility switch has nothing to switch.
 */
export interface Audience {
  shortlistCount: number
  profileViews: number
  openInterests: number
  hiddenFromFeed: boolean
  published: boolean
}
export const getAudience = () => api.get<Audience>('/students/me/audience')
export const setFeedVisibility = (hiddenFromFeed: boolean) => api.patch('/students/me/profile', { hiddenFromFeed })

/**
 * The student's own video resume as a state machine. `url` and `posterUrl` are
 * short-lived signatures and exist only while the film is PUBLISHED.
 *
 *   NONE         no completed interview yet
 *   PROCESSING   the interview happened; the film is not playable yet
 *   PUBLISHED    live in the employer feed and playable
 *   FAILED       the pipeline could not produce a playable film
 *   UNPUBLISHED  an admin took it down; `reason` says why
 */
export type VideoResumeStatus = 'NONE' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'UNPUBLISHED'

export interface VideoResume {
  status: VideoResumeStatus
  publishedAt: string | null
  interviewedAt: string | null
  url: string | null
  posterUrl: string | null
  expiresAt: string | null
  durationSec: number | null
  reason: string | null
  pipelinePending: boolean
  /**
   * The profile is published with THIS film leading and nothing holds it back. `status === 'PUBLISHED'` alone no
   * longer means employers see it: read this. False for a film read with `interviewId` that is not the primary one.
   */
  live: boolean
  /** An outstanding top-up on the interview keeps the profile off the feed until it is settled. */
  held: boolean
}

/**
 * The student's film. With `interviewId` it is THAT completed interview's film instead of the primary one (owner
 * only; 404 when it is not theirs). Wrapped rather than passed as a query function directly, so react-query's
 * context object can never be read as options.
 */
export const getVideoResume = (opts?: { interviewId?: string }) =>
  api.get<VideoResume>('/students/me/video-resume', opts?.interviewId ? { query: { interviewId: opts.interviewId } } : undefined)

/**
 * What became of the video of each completed interview (`GET /students/me/interview-videos`), newest first.
 *
 *   READY        playable, and can be made primary
 *   PROCESSING   still being made
 *   FAILED       could not be made
 *   UNPUBLISHED  an admin took it down
 *   ARCHIVED     past its retention period
 */
export type InterviewVideoStatus = 'READY' | 'PROCESSING' | 'FAILED' | 'UNPUBLISHED' | 'ARCHIVED'

export interface InterviewVideoRow {
  interviewId: string
  interviewedAt: string
  durationSec: number | null
  status: InterviewVideoStatus
  /** Employers see the primary one. */
  primary: boolean
  /** Can be made primary now. */
  selectable: boolean
  /** Why it cannot be made primary — set when the row is neither primary nor selectable. */
  reason: string | null
}

export interface InterviewVideos {
  videos: InterviewVideoRow[]
  /** The student chose an older video, so a newer interview will not take the lead until they choose the newest again. */
  pinned: boolean
}
export const getInterviewVideos = () => api.get<InterviewVideos>('/students/me/interview-videos')

export interface PrimaryInterviewResult {
  primaryInterviewId: string
  pinned: boolean
  live: boolean
  /** The profile stays off the feed until the student's top-up is settled. */
  held: boolean
}
/** Refused with a 400 whose `message` is fit to show (not READY, an admin takedown stands); 404 when not theirs. */
export const setPrimaryInterview = (interviewId: string) =>
  api.put<PrimaryInterviewResult>('/students/me/primary-interview', { interviewId })

/**
 * The student's own short videos (SP-03/SP-04) — self-recorded, never verified. `url` is signed for about fifteen
 * minutes and may be null; ask again (`listSelfVideos`) when it lapses.
 */
export type SelfVideoKind = 'INTRO' | 'PROJECT' | 'SKILL'
export type SelfVideoStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface SelfVideo {
  id: string
  slot: number
  kind: SelfVideoKind
  title: string | null
  durationSec: number | null
  sizeBytes: number | null
  status: SelfVideoStatus
  rejectionReason: string | null
  url: string | null
  createdAt: string
  /** Set once the student has edited it; with status PENDING it means "edited, back in review". */
  editedAt: string | null
}
export const listSelfVideos = () => api.get<{ videos: SelfVideo[] }>('/students/me/videos')

export interface SelfVideoEdit {
  id: string
  title: string | null
  kind: SelfVideoKind
  status: SelfVideoStatus
  /** False when the edit changed nothing. */
  changed: boolean
  /** An APPROVED or REJECTED video went (back) to review because of this edit. */
  resubmitted: boolean
}
/** Title and kind are shown to employers, so editing an approved video sends it back to review. */
export const editSelfVideo = (id: string, patch: { title?: string | null; kind?: SelfVideoKind }) =>
  api.patch<SelfVideoEdit>(`/students/me/videos/${id}`, patch)
export const deleteSelfVideo = (id: string) => api.del<{ deleted: true }>(`/students/me/videos/${id}`)

export interface SelfVideoInput {
  kind: SelfVideoKind
  title?: string
  key: string
  /** Advisory: the server reads the real length from the file and only falls back to this. Omit when unknown. */
  durationSec?: number
  sizeBytes?: number
}
/** 409 = the same file is already registered, or the cap is reached. */
export const addSelfVideo = (input: SelfVideoInput) => api.post<{ id: string; slot: number; status: SelfVideoStatus }>('/students/me/videos', input)
