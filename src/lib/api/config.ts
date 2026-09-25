import { api } from './index'

/**
 * Runtime configuration from the platform core.
 *
 * Every option list, limit and label the profile wizard renders comes from
 * here. The client keeps no copy: a price, a step order or a file-size limit
 * baked into a released build survives in the wild for months after an admin
 * changes it, and then the app and the server disagree about what is allowed.
 */
export interface AppConfig {
  tiers: { tier: string; amountPaise: number; durationMin: number }[]
  qualifications: { value: string; tier: string }[]
  auth: {
    otpLength: number
    otpTtlMinutes: number
    otpResendCooldownSeconds: number
    /** Codes a number may be sent per hour. Absent on an older backend — then say nothing about it. */
    otpMaxSendsPerHour?: number
    /** Wrong tries a single code allows. Absent on an older backend. */
    otpMaxAttempts?: number
  }
  booking: {
    windowMinHours: number
    windowMaxDays: number
    minProfileCompletionPct: number
    joinOpensMinutesBefore: number
    /** The free-reschedule cutoff, in hours before the slot. Admin-controlled. */
    rescheduleCutoffHours: number
    /** How long after the start a no-show is called. Absent on an older backend. */
    noShowMinutesAfter?: number
    /** Cancelling at least this many hours before the slot is refundable. Absent on an older backend. */
    freeCancellationHours?: number
  }
  /** Interviewer chats: how long before the interview a thread opens, and how long after it turns read-only. */
  chat?: { opensHoursBefore?: number; readOnlyHoursAfter?: number }
  /** How long an interviewer has to submit a scorecard, in hours. */
  scorecard?: { windowHours?: number }
  /** The film-processing target, in minutes. */
  recording?: { processingSlaMinutes?: number }
  /** How long a data-export request takes, in days. */
  privacy?: { dataExportSlaDays?: number }
  limits: {
    selfVideoMaxSeconds: number
    selfVideoMaxCount: number
    minSkills: number
    chatImageMaxMb: number
    chatDocumentMaxMb: number
  }
  uploads: Record<string, { contentTypes: string[]; maxBytes: number; label: string }>
  profile: {
    steps: { key: string; step: number; label: string }[]
    genders: string[]
    scoreTypes: string[]
    availability: string[]
    documentKinds: string[]
    employmentTypes: string[]
  }
  masterData: {
    skills: { name: string; slug: string }[]
    cities: { name: string; slug: string }[]
    languages: { name: string; slug: string }[]
    industries: { name: string; slug: string }[]
    jobCategories: { name: string; slug: string }[]
    /** EM-11 "Field of study" — the DOMAIN list. Absent on an older server. */
    domains?: { name: string; slug: string }[]
  }
  /**
   * Interviewer web's admin-controlled numbers. Settings-backed numbers are omitted when the server has
   * no such setting; `scorecard`, `slotMinutes` and `notesMaxChars` are the limits the server validates.
   */
  interviewer?: {
    joinOpensMinutesBefore?: number
    noShowMinutesAfter?: number
    scorecardWindowHours?: number
    scorecardReminderHoursBefore?: number
    /** A session shorter than this % of its scheduled length is not completed (and not payable). */
    completionThresholdPct?: number
    /** The trailing window `stats` on GET /interviewers/me is computed over. */
    statsWindowDays?: number
    /** Platform defaults; an interviewer's own caps are `profile.loadCaps`. */
    defaultWeeklyCap?: number
    defaultDailyCap?: number
    availabilityHorizonDays?: number
    minWithdrawalPaise?: number
    /** Longest date range an earnings statement may cover. */
    statementMaxDays?: number
    slotMinutes: number
    notesMaxChars: number
    scorecard: {
      scoreMin: number
      scoreMax: number
      competencies: { key: 'communication' | 'domainKnowledge' | 'confidence' | 'problemSolving' | 'overall'; label: string }[]
      /** Characters after trimming (not words). */
      strengthsMinChars: number
      improvementsMinChars: number
      textMaxChars: number
      internalNoteMaxChars: number
      recommendations: { value: 'STRONG' | 'SUITABLE' | 'NEEDS_IMPROVEMENT'; label: string }[]
    }
  }
  /** Employer web's admin-controlled numbers. Each is omitted when the server does not enforce it. */
  employer?: {
    verificationTargetHours?: number
    jobModerationTargetHours?: number
    feedDailyCardLimit?: number
    feedDailyVideoPlayLimit?: number
    passHideDays?: number
    interestExpiryDays?: number
    interestCooldownDays?: number
    documentMaxMb?: number
    jobVideoMaxSeconds?: number
    interestMessageMaxChars?: number
    rejectReasonMaxChars?: number
    shortlistNoteMaxChars?: number
    notificationRetentionDays?: number
    /** EM-11 — the ten filter rows and their option lists, as the server defines them. */
    feed?: {
      filters: { key: string; label: string; any: string; fields: string[] }[]
      listMax: number
      tiers: { value: string; label: string }[]
      locationModes: { value: string; label: string }[]
      interviewRecencyDays: { value: number; label: string }[]
      availability: string[]
      employmentTypes: string[]
      suppressionDays: number
      fullVideoRendition: string
    }
    interest?: {
      cooldownDays: number
      expiryDays: number
      messageMaxLength: number
      outcomes: { value: string; label: string }[]
    }
  }
}

let cached: Promise<AppConfig> | null = null

/** Fetched once per page load — it changes when an admin changes it, not per render. */
export const getConfig = () =>
  (cached ??= api.get<AppConfig>('/config').catch((e: unknown) => {
    // A failed load must not be remembered: one dropped request would otherwise
    // break every screen that reads the config until the tab is reloaded.
    cached = null
    throw e
  }))
