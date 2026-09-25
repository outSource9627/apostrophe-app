import type { RootStackParamList } from '../../App'
import type { IconName } from '../components/ui/Icon'

/**
 * The bottom tab bar is a persistent overlay on top of the existing flat
 * stack (App.tsx), not a nested tab navigator — see the design note in
 * BottomTabBar.tsx for why. This file is the one thing that overlay reads:
 * for every route name that should show a tab bar, which persona's bar and
 * which tab is active. A route with no entry here hides the bar entirely —
 * auth screens, and the shared flows (booking, payment, the room) that are
 * deliberately full-screen regardless of which tab they were entered from.
 */

export type TabKey = 'home' | 'interviews' | 'jobs' | 'interests' | 'chat' | 'account' | 'availability' | 'wallet' | 'feed' | 'shortlist' | 'none'

export type TabDef = {
  key: TabKey
  label: string
  /** The existing top-level route this tab's icon navigates to. Unchanged, already-working `navigate()` — see BottomTabBar.tsx. */
  root: keyof RootStackParamList
  icon: 'home' | 'calendar' | 'briefcase' | 'heart' | 'chat' | 'person' | 'clock' | 'wallet' | 'feed' | 'star'
  /** Draw from the shared design icon set instead of the bar's own glyphs (the employer bar). */
  glyph?: IconName
  /** Locked until the employer is verified (the design's padlock on every tab but Feed). */
  gated?: boolean
}

export const STUDENT_TABS: TabDef[] = [
  { key: 'home', label: 'Home', root: 'Home', icon: 'home' },
  { key: 'interviews', label: 'Interviews', root: 'Interviews', icon: 'calendar' },
  { key: 'jobs', label: 'Jobs', root: 'JobFeed', icon: 'briefcase' },
  { key: 'interests', label: 'Interests', root: 'Interests', icon: 'heart' },
  { key: 'chat', label: 'Chat', root: 'Chats', icon: 'chat' },
]

export const INTERVIEWER_TABS: TabDef[] = [
  { key: 'home', label: 'Home', root: 'InterviewerDashboard', icon: 'home' },
  { key: 'interviews', label: 'Interviews', root: 'InterviewerInterviews', icon: 'calendar' },
  { key: 'availability', label: 'Availability', root: 'InterviewerAvailability', icon: 'clock' },
  { key: 'wallet', label: 'Wallet', root: 'InterviewerWallet', icon: 'wallet' },
  { key: 'account', label: 'Account', root: 'InterviewerAccount', icon: 'person' },
]

/** The Employer Android design's five (EM-04..29): Home lands under Feed; Account and Notifications sit behind the header. */
export const EMPLOYER_TABS: TabDef[] = [
  { key: 'feed', label: 'Feed', root: 'EmployerFeed', icon: 'feed', glyph: 'play' },
  { key: 'shortlist', label: 'Shortlist', root: 'EmployerShortlist', icon: 'star', glyph: 'bookmark', gated: true },
  { key: 'interests', label: 'Interests', root: 'EmployerInterests', icon: 'heart', glyph: 'heart', gated: true },
  { key: 'jobs', label: 'Jobs', root: 'EmployerJobs', icon: 'briefcase', glyph: 'brief', gated: true },
  { key: 'chat', label: 'Chats', root: 'EmployerChats', icon: 'chat', glyph: 'chat', gated: true },
]

type Persona = 'student' | 'interviewer' | 'employer'

const STUDENT_ROUTES: Partial<Record<keyof RootStackParamList, TabKey>> = {
  Home: 'home',
  Interviews: 'interviews',
  InterviewDetail: 'interviews',
  Reschedule: 'interviews',
  Cancel: 'interviews',
  JobFeed: 'jobs',
  JobDetail: 'jobs',
  JobApply: 'jobs',
  SavedJobs: 'jobs',
  Applications: 'jobs',
  Chats: 'chat',
  Thread: 'chat',
  Connections: 'chat',
  Interests: 'interests',
  // The Student bar has no Profile tab (the design's five are Home, Interviews,
  // Jobs, Interests, Chat) — Account is reached from the header avatar, and its
  // routes keep the bar visible with no tab lit.
  Account: 'account',
  ProfileView: 'account',
  Visibility: 'account',
  Videos: 'account',
  Stats: 'account',
  DataRights: 'account',
  Receipts: 'account',
  NotificationSettings: 'account',
  Notifications: 'account',
}

const INTERVIEWER_ROUTES: Partial<Record<keyof RootStackParamList, TabKey>> = {
  InterviewerDashboard: 'home',
  PendingScorecards: 'home',
  InterviewerInterviews: 'interviews',
  InterviewerDetail: 'interviews',
  ScorecardDraft: 'interviews',
  InterviewerAvailability: 'availability',
  InterviewerOverrides: 'availability',
  InterviewerWallet: 'wallet',
  InterviewerLedger: 'wallet',
  InterviewerWithdraw: 'wallet',
  InterviewerBankAccount: 'wallet',
  InterviewerStatements: 'wallet',
  InterviewerAccount: 'account',
  InterviewerNotifications: 'account',
  InterviewerChats: 'account',
}

// Routes the design draws without a tab bar (Account, Notifications, the job
// editor, the applicant, a chat thread, documents and status) are left out, so
// the bar hides there. Company profile draws the bar with nothing lit.
const EMPLOYER_ROUTES: Partial<Record<keyof RootStackParamList, TabKey>> = {
  EmployerHome: 'feed',
  EmployerFeed: 'feed',
  CandidateProfile: 'feed',
  EmployerCompany: 'none',
  EmployerShortlist: 'shortlist',
  EmployerInterests: 'interests',
  EmployerJobs: 'jobs',
  EmployerJobDetail: 'jobs',
  JobApplications: 'jobs',
  EmployerChats: 'chat',
  EmployerConnections: 'chat',
}

/** Which persona's bar, and which tab, a given route name activates — or `null` to hide the bar entirely. */
export function tabBarInfoFor(routeName: string | undefined): { persona: Persona; tabs: TabDef[]; active: TabKey } | null {
  if (!routeName) return null
  const name = routeName as keyof RootStackParamList
  if (STUDENT_ROUTES[name]) return { persona: 'student', tabs: STUDENT_TABS, active: STUDENT_ROUTES[name]! }
  if (INTERVIEWER_ROUTES[name]) return { persona: 'interviewer', tabs: INTERVIEWER_TABS, active: INTERVIEWER_ROUTES[name]! }
  if (EMPLOYER_ROUTES[name]) return { persona: 'employer', tabs: EMPLOYER_TABS, active: EMPLOYER_ROUTES[name]! }
  return null
}
