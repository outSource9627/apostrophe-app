import { formatPaise } from '../format/money'
import type { AppConfig } from '../api/config'
import type { WalletDto } from '../api/interviewer'

/**
 * The wallet's rules (the web's lib/interviewer/wallet.ts). Every figure is
 * the server's own; the minimum withdrawal is the wallet's `minWithdrawalPaise`,
 * else `config.interviewer.minWithdrawalPaise` — absent means "print no number".
 */
export const minWithdrawal = (w: WalletDto | null, config: AppConfig | null): number | null =>
  typeof w?.minWithdrawalPaise === 'number' ? w.minWithdrawalPaise : config?.interviewer?.minWithdrawalPaise ?? null

/** Why Withdraw is unavailable, in the order the server decides it; null when it is available. */
export function withdrawBlockedText(w: WalletDto, config: AppConfig | null, suspended: boolean): string | null {
  if (suspended || w.withdrawBlockedReason === 'ACCOUNT_SUSPENDED') return 'Withdrawals are paused while your account is suspended.'
  if (w.openRequest) return 'You already have a withdrawal request being processed.'
  if (w.canWithdraw) return null
  if (w.withdrawBlockedReason === 'NO_BANK_ACCOUNT') return 'Add a payout bank account first.'
  const min = minWithdrawal(w, config)
  return min != null ? `The minimum withdrawal is ${formatPaise(min)}.` : 'Your available balance is below the minimum withdrawal.'
}

export const WITHDRAWAL_STATUS: Record<string, { label: string; tone: 'violet' | 'amber' | 'green' | 'red' }> = {
  REQUESTED: { label: 'Requested', tone: 'violet' },
  APPROVED: { label: 'Approved', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
}
