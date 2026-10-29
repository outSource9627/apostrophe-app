import { answeredCount, clockSync, closedState, mmss, remainingMs, sectionRuns } from '../src/lib/interviewer/screening'
import { forgetScreening, isOpen, keepScreening, patchScreening, readScreening } from '../src/lib/interviewer/screeningStore'
import { isScreeningOffer, screeningRefusal } from '../src/lib/api/screening'
import { ApiClientError, ErrorCode } from '../src/lib/api/types'
import type { ScreeningQuestion, ScreeningState } from '../src/lib/api/screening'

const q = (index: number, section: ScreeningQuestion['section']): ScreeningQuestion => ({ index, section, domain: null, text: `Q${index}`, options: ['a', 'b', 'c', 'd'] })

describe('the clock', () => {
  it('counts from the server’s own now, not the phone’s date', () => {
    // The phone's clock is a day off; only the difference since the fetch matters.
    const at = Date.parse('2026-10-30T10:00:00Z')
    const sync = clockSync('2026-10-29T10:45:00Z', '2026-10-29T10:00:00Z', at)
    expect(remainingMs(sync, at)).toBe(45 * 60 * 1000)
    expect(remainingMs(sync, at + 6 * 60 * 1000 + 48 * 1000)).toBe(38 * 60 * 1000 + 12 * 1000)
    expect(remainingMs(sync, at + 50 * 60 * 1000)).toBe(0)
  })
  it('reads a bad date as no time left', () => {
    expect(remainingMs(clockSync('nope', '2026-10-29T10:00:00Z', 0), 0)).toBe(0)
  })
  it('formats mm:ss, rounding up', () => {
    expect(mmss(45 * 60 * 1000)).toBe('45:00')
    expect(mmss(4 * 60 * 1000 + 58 * 1000)).toBe('04:58')
    expect(mmss(1)).toBe('00:01')
    expect(mmss(0)).toBe('00:00')
    expect(mmss(-5)).toBe('00:00')
  })
})

describe('sections', () => {
  const qs = [q(0, 'TECHNICAL'), q(1, 'TECHNICAL'), q(2, 'REASONING'), q(3, 'GK')]
  it('groups in order, skips an empty section and counts answers', () => {
    const runs = sectionRuns(qs, [1, null, 0, null])
    expect(runs.map((r) => [r.section, r.positions, r.answered])).toEqual([
      ['TECHNICAL', [0, 1], 1],
      ['REASONING', [2], 1],
      ['GK', [3], 0],
    ])
    expect(answeredCount([1, null, 0, null])).toBe(2)
  })
})

describe('closed states', () => {
  const base: ScreeningState = {
    status: 'ISSUED', firstName: 'Priya', domains: [], counts: { TECHNICAL: 15, REASONING: 5, IQ: 5, GK: 5 }, total: 30,
    timeLimitMinutes: 45, expiresAt: '2026-11-03T00:00:00Z', startedAt: null, deadlineAt: null, submittedAt: null,
    autoSubmitted: false, answeredCount: 0, serverNow: '2026-10-29T00:00:00Z',
  }
  it('is open while issued or in progress', () => {
    expect(closedState(base)).toBeNull()
    expect(closedState({ ...base, status: 'IN_PROGRESS' })).toBeNull()
  })
  it('lands out of time, submitted or expired', () => {
    expect(closedState({ ...base, status: 'SUBMITTED', autoSubmitted: true, answeredCount: 27 })).toEqual({ k: 'timeup', answered: 27, total: 30 })
    expect(closedState({ ...base, status: 'SUBMITTED', submittedAt: '2026-10-27T05:00:00Z' })).toEqual({ k: 'already', on: '2026-10-27T05:00:00Z' })
    expect(closedState({ ...base, status: 'EXPIRED' })).toEqual({ k: 'expired', until: '2026-11-03T00:00:00Z' })
  })
})

describe('the apply response and refusals', () => {
  it('tells an offer from a repeat and from null', () => {
    expect(isScreeningOffer({ token: 't', expiresAt: 'x', timeLimitMinutes: 45, counts: { TECHNICAL: 15, REASONING: 5, IQ: 5, GK: 5 }, total: 30 })).toBe(true)
    expect(isScreeningOffer({ repeat: true })).toBe(false)
    expect(isScreeningOffer(null)).toBe(false)
    expect(isScreeningOffer(undefined)).toBe(false)
  })
  it('reads the reason from details or meta, on a conflict only', () => {
    expect(screeningRefusal(new ApiClientError(ErrorCode.CONFLICT, 'm', 409, undefined, undefined, { reason: 'PREPARING' }))).toBe('PREPARING')
    expect(screeningRefusal(new ApiClientError(ErrorCode.CONFLICT, 'm', 409, undefined, undefined, undefined, { reason: 'EXPIRED' }))).toBe('EXPIRED')
    expect(screeningRefusal(new ApiClientError(ErrorCode.NOT_FOUND, 'm', 404))).toBeNull()
    expect(screeningRefusal(new TypeError('Network request failed'))).toBeNull()
  })
})

describe('the test kept on this phone', () => {
  const offer = { token: 'tok', expiresAt: '2026-11-03T00:00:00Z', timeLimitMinutes: 45, counts: { TECHNICAL: 15, REASONING: 5, IQ: 5, GK: 5 }, total: 30 }
  it('keeps, patches and forgets only its own token', async () => {
    await keepScreening(offer, 'priya@example.com')
    expect((await readScreening())?.email).toBe('priya@example.com')
    await patchScreening('other', { deadlineAt: '2026-10-29T10:45:00Z' })
    expect((await readScreening())?.deadlineAt).toBeUndefined()
    await patchScreening('tok', { deadlineAt: '2026-10-29T10:45:00Z', pending: { 3: 1 } })
    expect(await readScreening()).toMatchObject({ deadlineAt: '2026-10-29T10:45:00Z', pending: { 3: 1 } })
    await forgetScreening('other')
    expect(await readScreening()).not.toBeNull()
    await forgetScreening('tok')
    expect(await readScreening()).toBeNull()
  })
  it('is offered until the link expires, then until the deadline once started', () => {
    const kept = { ...offer, email: 'e' }
    expect(isOpen(kept, Date.parse('2026-11-02T00:00:00Z'))).toBe(true)
    expect(isOpen(kept, Date.parse('2026-11-04T00:00:00Z'))).toBe(false)
    expect(isOpen({ ...kept, deadlineAt: '2026-10-29T10:45:00Z' }, Date.parse('2026-10-29T11:00:00Z'))).toBe(false)
  })
})
