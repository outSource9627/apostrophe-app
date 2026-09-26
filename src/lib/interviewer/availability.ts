import type { AvailabilityBlockDto, AvailabilityOverviewDto, AvailabilityRuleDto } from '../api/interviewer'
import { addDays, dayOfKey, istDateKey, monthOfKey, monthShort, weekdayOfKey } from './state'

/**
 * The weekly availability pattern's arithmetic (the web's availabilityGrid,
 * for the phone). All IST. A slot is one `slotMinutes` step of the day, keyed
 * `${weekday}-${startMin}` with weekday 0 = Sunday — the numbering the rules
 * use. The server stores merged blocks, so everything goes through slot sets.
 */

export const slotKey = (weekday: number, startMin: number) => `${weekday}-${startMin}`
export const parseKey = (key: string) => {
  const [d, m] = key.split('-')
  return { weekday: Number(d), startMin: Number(m) }
}

export function rulesToSlotSet(rules: AvailabilityRuleDto[], slotMinutes: number): Set<string> {
  const set = new Set<string>()
  for (const rule of rules) for (const b of rule.blocks) for (let m = b.startMin; m < b.endMin; m += slotMinutes) set.add(slotKey(rule.weekday, m))
  return set
}

/** Merges each weekday's consecutive slots back into blocks — the shape the API stores. */
export function slotSetToRules(slots: Set<string>, slotMinutes: number): AvailabilityRuleDto[] {
  const byDay = new Map<number, number[]>()
  for (const key of slots) {
    const { weekday, startMin } = parseKey(key)
    byDay.set(weekday, [...(byDay.get(weekday) ?? []), startMin])
  }
  const rules: AvailabilityRuleDto[] = []
  for (let day = 0; day < 7; day++) {
    const minutes = (byDay.get(day) ?? []).sort((a, b) => a - b)
    const blocks: AvailabilityBlockDto[] = []
    for (const m of minutes) {
      const last = blocks[blocks.length - 1]
      if (last && last.endMin === m) last.endMin = m + slotMinutes
      else blocks.push({ startMin: m, endMin: m + slotMinutes })
    }
    if (blocks.length) rules.push({ weekday: day, blocks })
  }
  return rules
}

/** Cells that differ between two slot sets — what "unsaved" means. */
export function changedCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const k of a) if (!b.has(k)) n++
  for (const k of b) if (!a.has(k)) n++
  return n
}

export interface WeekDay { dateKey: string; weekday: number; day: number; month: number }

/** Monday to Sunday of this IST week. */
export function thisWeek(nowMs: number): WeekDay[] {
  const today = istDateKey(nowMs)
  const w = weekdayOfKey(today)
  const monday = addDays(today, w === 0 ? -6 : 1 - w)
  return Array.from({ length: 7 }, (_, i) => {
    const dateKey = addDays(monday, i)
    return { dateKey, weekday: weekdayOfKey(dateKey), day: dayOfKey(dateKey), month: monthOfKey(dateKey) }
  })
}

/** '21–27 SEP', or '29 SEP–5 OCT' across a month. */
export function weekRange(week: WeekDay[]): string {
  const a = week[0]
  const b = week[week.length - 1]
  if (!a || !b) return ''
  return (a.month === b.month ? `${a.day}–${b.day} ${monthShort(b.month)}` : `${a.day} ${monthShort(a.month)}–${b.day} ${monthShort(b.month)}`).toUpperCase()
}

/** The week's booked cells from the overview: key → the candidate's short name. */
export function bookedFromOverview(o: AvailabilityOverviewDto | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const d of o?.days ?? []) for (const c of d.cells) if (c.status === 'BOOKED') map.set(slotKey(d.weekday, c.startMin), c.interview?.candidateShortName ?? 'Booked')
  return map
}

/** '7 PM', '9:30 AM' */
export function timeOfDay(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const p = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m ? `${hh}:${String(m).padStart(2, '0')} ${p}` : `${hh} ${p}`
}

/** '3', '2.5' — slots to hours. */
export function hoursOf(slots: number, slotMinutes: number): string {
  const h = (slots * slotMinutes) / 60
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

/** The hours the page shows: the design's 8 AM – 10 PM, widened to whole hours around any open slot. */
export function hourRange(slots: Set<string>, booked: Map<string, string>, base = { from: 8, to: 22 }) {
  let from = base.from
  let to = base.to
  for (const key of [...slots, ...booked.keys()]) {
    const h = Math.floor(parseKey(key).startMin / 60)
    from = Math.min(from, h)
    to = Math.max(to, h + 1)
  }
  return Array.from({ length: to - from }, (_, i) => from + i)
}
