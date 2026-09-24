import { ApiClientError } from '../api'
import { getFeedback, listInterviews, type Feedback, type StudentInterview } from '../api/interviews'
import { getAudience, getVideoResume, type Audience, type VideoResume, type VideoResumeStatus } from '../api/student'
import { istDayKey, splitByTime } from '../interviews/slots'

/**
 * What the paid Home is drawn from — the same rules as the web dashboard, so the
 * two surfaces tell one story. Every field is something the API sent; the screen
 * derives words from them ("in 2 days") and never a fact.
 */
export interface DashboardData {
  audience: Audience
  interviews: StudentInterview[]
  /** Null when the video resume's state could not be read; `filmStateOf` then infers it. */
  film: VideoResume | null
  /** 'awaiting' is the 404 the scorecard screen also treats as a state; null is "could not tell". */
  feedback: Feedback | 'awaiting' | null
}

/** Which film card Home draws. The API reports the student's one video resume. */
export type FilmState = 'none' | 'processing' | 'published' | 'failed' | 'unpublished'

const FILM_STATE: Record<VideoResumeStatus, FilmState> = {
  NONE: 'none',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  UNPUBLISHED: 'unpublished',
}

/** The film's own status when the API gave it; otherwise what the audience and interviews imply. */
export function filmStateOf(film: VideoResume | null, audience: Audience, done: StudentInterview | undefined): FilmState {
  if (film) return FILM_STATE[film.status]
  return audience.published ? 'published' : done ? 'processing' : 'none'
}

/** No profile document yet reads as "not live", the way the visibility screen reads it. */
const NOT_LIVE: Audience = { shortlistCount: 0, profileViews: 0, openInterests: 0, hiddenFromFeed: false, published: false }

/** The newest COMPLETED interview: the one a film and a scorecard can exist for. */
export const latestCompleted = (interviews: StudentInterview[]): StudentInterview | undefined =>
  interviews
    .filter((iv) => iv.status === 'COMPLETED')
    .sort((a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime())[0]

/** The soonest interview still to come — the rule the interviews list draws its Upcoming section by. */
export const nextUpcoming = (interviews: StudentInterview[], now: number): StudentInterview | undefined =>
  splitByTime(interviews, new Date(now)).upcoming[0]

/**
 * A paywall or a lapsed session is thrown for the caller to route on; the
 * audience's 404, the film's state and the scorecard being unreadable are
 * answers the screen can draw around.
 */
export async function loadDashboard(): Promise<DashboardData> {
  const [audience, interviews, film] = await Promise.all([
    getAudience().catch((e: unknown) => {
      if (e instanceof ApiClientError && e.status === 404) return NOT_LIVE
      throw e
    }),
    listInterviews().then((r) => r.interviews),
    getVideoResume().catch(() => null),
  ])
  const done = latestCompleted(interviews)
  const feedback = done
    ? await getFeedback(done.id).catch((e: unknown) =>
        e instanceof ApiClientError && e.status === 404 ? ('awaiting' as const) : null,
      )
    : null
  return { audience, interviews, film, feedback }
}

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Whole IST calendar days from one instant's date to another's. */
const calendarDaysBetween = (fromMs: number, toIso: string) => {
  const asUtc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
  return Math.round((asUtc(istDayKey(toIso)) - asUtc(istDayKey(new Date(fromMs).toISOString()))) / DAY)
}

/**
 * 'Join open', 'In 25 min', 'In 3 hours', 'In 2 days'. Under a day it counts the
 * clock; past a day it counts IST calendar days.
 */
export function untilLabel(iv: Pick<StudentInterview, 'slotStart' | 'roomReady' | 'status'>, now: number): string {
  if (iv.roomReady || iv.status === 'IN_PROGRESS') return 'Join open'
  const ms = new Date(iv.slotStart).getTime() - now
  if (ms <= 0) return 'Starting now'
  if (ms < HOUR) return `In ${Math.max(1, Math.floor(ms / MIN))} min`
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR)
    return `In ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const days = Math.max(1, calendarDaysBetween(now, iv.slotStart))
  return `In ${days} ${days === 1 ? 'day' : 'days'}`
}

/** 'Good morning' before noon, 'Good afternoon' until five, 'Good evening' after — by the device's clock. */
export const greetingFor = (hour: number) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 'Thursday, 24 September' — the device's own date. Hermes has no Intl guarantee, so it is spelled out. */
export const longDate = (d: Date) => `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`
