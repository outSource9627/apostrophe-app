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
}
export const getVideoResume = () => api.get<VideoResume>('/students/me/video-resume')
