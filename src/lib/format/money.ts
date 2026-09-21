/**
 * Money formatting in Indian numbering system (Decision D1 / 18 Sep 2026).
 *
 * Rules:
 * - Integer paise input (1 rupee = 100 paise)
 * - en-IN grouping (e.g. ₹1,50,000)
 * - Negative numbers use mathematical minus U+2212 '−'
 * - Clean rupee format without decimal paise unless non-zero
 */

const MINUS_SIGN = '\u2212'

export function formatPaise(paise: number, options: { showZeroPaise?: boolean } = {}): string {
  const isNegative = paise < 0
  const absPaise = Math.abs(paise)
  const rupees = Math.floor(absPaise / 100)
  const remainderPaise = absPaise % 100

  // Indian number grouping
  const rupeeStr = rupees.toLocaleString('en-IN')

  let formatted = `₹${rupeeStr}`
  if (options.showZeroPaise || remainderPaise > 0) {
    formatted += `.${remainderPaise.toString().padStart(2, '0')}`
  }

  return isNegative ? `${MINUS_SIGN}${formatted}` : formatted
}

export function formatRupees(rupees: number): string {
  return formatPaise(rupees * 100)
}
