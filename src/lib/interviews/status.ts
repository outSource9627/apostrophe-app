import type { InterviewStatus } from '../api/interviews'
import type { Tone } from '../../components/ui/status'

/**
 * One status → one label and one tone, shared by the list and the detail, and
 * matched to the web (apostrophe-user lib/interviews/status.ts). IN_PROGRESS is
 * the single status that earns the accent — it is live/recording — so it is
 * flagged `live` and drawn with the accent dot; everything else stays low-chroma.
 */
export interface StatusMark {
  label: string
  tone: Tone
  live?: boolean
}

export function statusMark(status: InterviewStatus): StatusMark {
  switch (status) {
    case 'BOOKED':
      return { label: 'Booked', tone: 'neutral' }
    case 'IN_PROGRESS':
      return { label: 'In progress', tone: 'accent', live: true }
    case 'COMPLETED':
      return { label: 'Completed', tone: 'success' }
    case 'INCOMPLETE':
      return { label: 'Under review', tone: 'info' }
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' }
    case 'RESCHEDULED':
      return { label: 'Rescheduled', tone: 'neutral' }
    case 'STUDENT_NO_SHOW':
    case 'INTERVIEWER_NO_SHOW':
      return { label: 'No show', tone: 'danger' }
  }
}
