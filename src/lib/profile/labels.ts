/**
 * Display text for the enum VALUES the server sends.
 *
 * The server owns the list of values; this file owns how they read in English.
 * Splitting it that way means adding a value is a server change that shows up
 * immediately (as the raw value, visibly wrong) rather than one that silently
 * disappears from a hard-coded list on the client.
 */
const titleCase = (v: string) =>
  v.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

const OVERRIDES: Record<string, string> = {
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  CGPA: 'CGPA',
  PERCENTAGE: 'Percentage',
  IMMEDIATE: 'Immediately',
  DAYS_15: 'Within 15 days',
  DAYS_30: 'Within 30 days',
  DAYS_60: 'Within 60 days',
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  CLASS_12: 'Class 12',
  POST_GRADUATION: 'Post graduation',
  PHD: 'PhD',
  RESUME: 'Résumé',
}

export const label = (value: string) => OVERRIDES[value] ?? titleCase(value)

export const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`

/** Lakhs read better than rupees for a salary expectation in India. */
export function lakhs(paise: number): string {
  const rs = paise / 100
  if (rs >= 100_000) {
    const l = rs / 100_000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)} LPA`
  }
  return `${rupees(paise)} / year`
}

/**
 * The same expectation as ONE phrase — '₹6 – ₹9 LPA'. The unit is said once at
 * the end, not twice, because the wizard's read-back (ST-17) is a range rather
 * than two amounts: repeating 'LPA' on the minimum makes it read as two
 * separate salaries the student is asking for.
 */
export function lakhsRange(minPaise: number, maxPaise?: number): string {
  const max = maxPaise == null ? null : lakhs(maxPaise)
  const min = lakhs(minPaise)
  if (max == null) return min
  // Both sides share a unit only when both landed in lakhs; below a lakh the
  // two halves are formatted differently and each has to keep its own.
  const unit = ' LPA'
  return min.endsWith(unit) && max.endsWith(unit)
    ? `${min.slice(0, -unit.length)} – ${max}`
    : `${min} – ${max}`
}

/**
 * The pay bar's detail line — what the amount buys, in one breath.
 *
 * It lives here rather than inside PayBar because PayBar is presentational and
 * this is copy assembled from the server's tier and duration; and it lives in
 * one place rather than at each of the three call sites because the boards draw
 * the same sentence on every surface, and three hand-joined versions of it is
 * how the price starts describing itself differently on two screens.
 */
export function payDetail(tierLabel?: string, durationMin?: number): string {
  return [
    'one-time',
    tierLabel && `${tierLabel} tier`,
    durationMin && `${durationMin}-minute interview`,
    'includes your video resume',
  ]
    .filter(Boolean)
    .join(' · ')
}
