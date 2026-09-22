import { useEffect, useSyncExternalStore } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import {
  getInterviewerMe,
  listInterviewerInterviews,
  getInterviewerAvailability,
  getInterviewerWallet,
  listInterviewerLedger,
  getInterviewerBankAccount,
  listInterviewerNotifications,
  type InterviewerMeDto,
  type InterviewerInterviewDto,
  type AvailabilityPayload,
  type InterviewerWalletSummaryDto,
  type LedgerEntryDto,
  type BankAccountDto,
  type InterviewerNotificationDto,
} from '../api/interviewer'
import { isSuspended, isDeactivated } from './state'

const POLL_MS = 30_000
const FRESH_MS = 5_000

export interface InterviewerWalletFull extends InterviewerWalletSummaryDto {
  balancePaise: number
  lockedPaise: number
  lifetimePaise: number
  ledger: LedgerEntryDto[]
  bankAccount: BankAccountDto | null
}

interface Snapshot {
  interviewer: InterviewerMeDto | null
  interviews: InterviewerInterviewDto[]
  availability: AvailabilityPayload | null
  wallet: InterviewerWalletFull | null
  notifications: InterviewerNotificationDto[]
  unreadNotifications: number
  error: Error | null
  loading: boolean
}

const EMPTY: Snapshot = {
  interviewer: null,
  interviews: [],
  availability: null,
  wallet: null,
  notifications: [],
  unreadNotifications: 0,
  error: null,
  loading: true,
}

let snap: Snapshot = EMPTY
let fetchedAt = 0
let inflight: Promise<any> | null = null
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function set(patch: Partial<Snapshot>) {
  snap = { ...snap, ...patch }
  listeners.forEach((l) => l())
}

async function load(): Promise<Snapshot> {
  if (inflight) return inflight

  const read = (async () => {
    try {
      const [
        meRes,
        interviewsRes,
        availRes,
        walletRes,
        ledgerRes,
        bankRes,
        notificationsRes,
      ] = await Promise.allSettled([
        getInterviewerMe(),
        listInterviewerInterviews(),
        getInterviewerAvailability(),
        getInterviewerWallet(),
        listInterviewerLedger(),
        getInterviewerBankAccount(),
        listInterviewerNotifications(),
      ])

      const interviewer = meRes.status === 'fulfilled' ? meRes.value : null
      const interviews = interviewsRes.status === 'fulfilled' ? interviewsRes.value.interviews || [] : []
      const availability = availRes.status === 'fulfilled' ? availRes.value : null
      const walletSummary = walletRes.status === 'fulfilled' ? walletRes.value : null
      const ledger = ledgerRes.status === 'fulfilled' ? ledgerRes.value.items || [] : []
      const bankAccount =
        bankRes.status === 'fulfilled'
          ? bankRes.value.bank || bankRes.value.account || null
          : null
      const notifications = notificationsRes.status === 'fulfilled' ? notificationsRes.value.notifications || [] : []
      const unreadNotifications = notifications.filter((n) => !n.read).length

      let wallet: InterviewerWalletFull | null = null
      if (walletSummary) {
        wallet = {
          ...walletSummary,
          balancePaise: walletSummary.availablePaise,
          lockedPaise: walletSummary.pendingPaise,
          lifetimePaise: (walletSummary.availablePaise || 0) + (walletSummary.withdrawnPaise || 0),
          ledger,
          bankAccount,
        }
      }

      fetchedAt = Date.now()
      set({
        interviewer,
        interviews,
        availability,
        wallet,
        notifications,
        unreadNotifications,
        error: null,
        loading: false,
      })
      return snap
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Could not load interviewer state.')
      set({ error, loading: false })
      return snap
    } finally {
      inflight = null
    }
  })()

  inflight = read
  return read
}

function onAppStateChange(status: AppStateStatus) {
  if (status === 'active') {
    if (Date.now() - fetchedAt >= FRESH_MS) {
      void load()
    }
  }
}

export function useInterviewer() {
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      if (listeners.size === 1) {
        timer = setInterval(() => {
          if (AppState.currentState === 'active') void load()
        }, POLL_MS)
        const sub = AppState.addEventListener('change', onAppStateChange)
        void load()
        return () => {
          if (timer) clearInterval(timer)
          sub.remove()
          listeners.delete(onStoreChange)
        }
      }
      return () => {
        listeners.delete(onStoreChange)
      }
    },
    () => snap,
  )

  const suspended = isSuspended(state.interviewer)
  const deactivated = isDeactivated(state.interviewer)

  const now = new Date()
  const upcomingInterviews = state.interviews.filter((i) => {
    return (
      (i.status === 'BOOKED' || (i.status as string) === 'SCHEDULED') &&
      new Date(i.slotEnd).getTime() > now.getTime()
    )
  })

  const owedScorecards = state.interviews.filter((i) => {
    const isCompleted = i.status === 'COMPLETED' || !!i.sessionEndedAt
    const notSubmitted = !i.scorecard?.submittedAt && !i.scorecardSubmittedAt
    return isCompleted && notSubmitted
  })

  const pastInterviews = state.interviews.filter((i) => {
    return (
      i.status === 'COMPLETED' ||
      i.status === 'CANCELLED' ||
      i.status === 'STUDENT_NO_SHOW' ||
      i.status === 'INTERVIEWER_NO_SHOW'
    )
  })

  return {
    profile: state.interviewer,
    interviewer: state.interviewer,
    upcomingInterviews,
    owedScorecards,
    pastInterviews,
    availability: state.availability,
    wallet: state.wallet,
    notifications: state.notifications,
    unreadNotifications: state.unreadNotifications,
    loading: state.loading,
    error: state.error,
    isSuspended: suspended,
    isDeactivated: deactivated,
    refresh: () => load(),
  }
}
