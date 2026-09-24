import { api } from './index'

/**
 * Payment wire shapes, mirrored from apostrophe-admin and kept in step with the
 * web. The SERVER (via the Razorpay webhook) is the only authority on `paid`:
 * POST /order starts a payment, the gateway captures it, the webhook activates
 * the entitlement, and GET /status is the ONLY confirmation the client trusts.
 */
export interface Order {
  paymentId: string
  /** null when Razorpay is unconfigured — treat as "checkout unavailable", not an error. */
  orderId: string | null
  keyId?: string
  tier: string
  amountPaise: number
  durationMin: number
}

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED'

export interface PaymentState {
  status: PaymentStatus
  tier: string
  amountPaise: number
  paidAt: string | null
  failureReason: string | null
}

/**
 * Create — or re-return — the order for the signed-in student, amount derived
 * server-side from their tier. After a FAILED attempt this returns a BRAND-NEW
 * paymentId/orderId, so always re-call this before retrying rather than
 * reopening the old order.
 */
export const createOrder = () => api.post<Order>('/payments/order')

export const getPaymentStatus = (paymentId: string) =>
  api.get<PaymentState>(`/payments/status/${paymentId}`)

/**
 * Local/dev settle — activates the entitlement without a live Razorpay webhook.
 * Used when Razorpay is unconfigured (orderId null) or the native SDK is not yet
 * linked; production goes through the real gateway + webhook instead.
 */
export const mockSettle = (paymentId?: string) =>
  api.post<{ success: boolean; paymentId: string }>('/payments/mock-settle', paymentId ? { paymentId } : {})

/** One settled payment and, once issued, its numbered GST receipt. */
export interface PaymentRow {
  id: string
  status: 'SUCCESS' | 'REFUNDED'
  tier: string
  amountPaise: number
  method: string | null
  gatewayPaymentId: string | null
  paidAt: string | null
  createdAt: string
  receipt: {
    id: string
    number: string
    breakdown: { basePaise: number; gstPaise: number; totalPaise: number; ratePct: number }
    issuedAt: string
    /** A signed PDF link good for about fifteen minutes; null until the PDF exists. */
    url: string | null
  } | null
}

/** ST-25/ST-26 — the student's own payments, newest first. */
export const listPayments = () => api.get<{ payments: PaymentRow[] }>('/payments')

/**
 * DEV ONLY — stand in for the Razorpay webhook, which cannot reach a server on
 * a laptop. Called after the gateway reports a captured payment, exactly as the
 * web does (apostrophe-user app/pay/usePayment.ts `devSettle`). In a release
 * build this is a no-op: the real webhook settles, and /status reports it.
 * A failure is swallowed — the Confirming screen's poll and timeout take over.
 */
export async function settleInDev(paymentId: string): Promise<void> {
  if (!__DEV__) return
  try { await mockSettle(paymentId) } catch { /* the poll will time out and show support */ }
}
