import type { RootStackParamList } from '../../App'

/**
 * The bottom tab bar is a persistent overlay on top of the existing flat
 * stack (App.tsx), not a nested tab navigator — see the design note in
 * BottomTabBar.tsx for why. This file is the one thing that overlay reads:
 * for every route name that should show a tab bar, which persona's bar and
 * which tab is active. A route with no entry here hides the bar entirely —
 * auth screens, and the shared flows (booking, payment, the room) that are
 * deliberately full-screen regardless of which tab they were entered from.
 */

export type TabKey = 'home' | 'interviews' | 'jobs' | 'interests' | 'chat' | 'account' | 'availability' | 'wallet' | 'feed' | 'shortlist'

export type TabDef = {
  key: TabKey
  label: string
  /** The existing top-level route this tab's icon navigates to. Unchanged, already-working `navigate()` — see BottomTabBar.tsx. */
  root: keyof RootStackParamList
  icon: 'home' | 'calendar' | 'briefcase' | 'heart' | 'chat' | 'person' | 'clock' | 'wallet' | 'feed' | 'star'
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

export const EMPLOYER_TABS: TabDef[] = [
  { key: 'home', label: 'Home', root: 'EmployerHome', icon: 'home' },
  { key: 'feed', label: 'Feed', root: 'EmployerFeed', icon: 'feed' },
  { key: 'jobs', label: 'Jobs', root: 'EmployerJobs', icon: 'briefcase' },
  { key: 'shortlist', label: 'Shortlist', root: 'EmployerShortlist', icon: 'star' },
  { key: 'account', label: 'Account', root: 'EmployerAccount', icon: 'person' },
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

const EMPLOYER_ROUTES: Partial<Record<keyof RootStackParamList, TabKey>> = {
  EmployerHome: 'home',
  EmployerDocuments: 'home',
  EmployerStatus: 'home',
  EmployerCompany: 'home',
  EmployerFeed: 'feed',
  CandidateProfile: 'feed',
  CandidateVideo: 'feed',
  FeedFilters: 'feed',
  SavedSearches: 'feed',
  SendInterest: 'feed',
  EmployerJobs: 'jobs',
  JobEditor: 'jobs',
  EmployerJobDetail: 'jobs',
  JobApplications: 'jobs',
  ApplicantDetail: 'jobs',
  EmployerShortlist: 'shortlist',
  ShortlistEntry: 'shortlist',
  EmployerInterests: 'shortlist',
  EmployerAccount: 'account',
  EmployerConnections: 'account',
  EmployerChats: 'account',
  EmployerThread: 'account',
  EmployerNotifications: 'account',
  EmployerNotificationSettings: 'account',
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
