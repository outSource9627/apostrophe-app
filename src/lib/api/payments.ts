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
