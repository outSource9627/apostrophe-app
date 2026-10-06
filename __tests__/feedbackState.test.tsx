/**
 * SP-08 — the feedback screen tells "not yet" from "not ever". A 404 while the interviewer still has time is a promise
 * that it is on its way; a 404 once their time has run out is the plain fact that it will not come, with no time
 * promised. The screen reads the interview's own `feedback` field for that, and the hours an interviewer has come from
 * /config (`scorecard.windowHours`), never from the screen.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiClientError as RealApiClientError } from '../src/lib/api'
import { FeedbackScreen } from '../src/screens/room/FeedbackScreen'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockConfig = jest.fn()
jest.mock('../src/lib/api', () => ({
  api: { get: (path: string) => mockConfig(path) },
  ApiClientError: class MockApiClientError extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  },
}))
const mockFeedback = jest.fn()
const mockInterview = jest.fn()
jest.mock('../src/lib/api/interviews', () => ({
  getFeedback: () => mockFeedback(),
  getInterview: () => mockInterview(),
}))

// The mock above stands in for the real class; it only needs a status and a message.
const ApiClientError = RealApiClientError as unknown as new (status: number, message: string) => Error

const iv = (over: Record<string, unknown>) => ({ id: 'iv1', slotStart: '2026-09-25T09:00:00.000Z', status: 'COMPLETED', ...over })

const mounted: { tree: ReactTestRenderer.ReactTestRenderer; client: QueryClient }[] = []

// Nothing may outlive its test: an unmounted tree and a cleared cache leave react-query no timer to hold the process open.
afterEach(() => {
  for (const m of mounted.splice(0)) { act(() => { m.tree.unmount() }); m.client.clear() }
})

async function render(opts: { interview: Record<string, unknown>; windowHours?: number | null; feedback?: 'missing' | 'ready' }) {
  if (opts.feedback === 'ready') {
    mockFeedback.mockResolvedValue({
      interviewId: 'iv1', slotStart: '2026-09-25T09:00:00.000Z', tier: 'T2', status: 'COMPLETED',
      scorecard: { scores: { communication: 7, domainKnowledge: 6, confidence: 8, problemSolving: 7, overall: 7 }, strengths: 'Clear.', improvements: 'Slow down.' },
    })
  } else {
    mockFeedback.mockRejectedValue(new ApiClientError(404, 'Your feedback is not ready yet.'))
  }
  mockInterview.mockResolvedValue(iv(opts.interview))
  mockConfig.mockResolvedValue(opts.windowHours == null ? {} : { scorecard: { windowHours: opts.windowHours } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onBack = jest.fn()
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <FeedbackScreen id="iv1" onBack={onBack} />
      </QueryClientProvider>,
    )
  })
  mounted.push({ tree, client })
  for (let i = 0; i < 30; i++) {
    await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) })
  }
  const texts = tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))
  return { texts, tree, onBack }
}

describe('FeedbackScreen', () => {
  it('UNAVAILABLE: says it will not be available, promises no time and no notification, and offers the way back', async () => {
    const { texts, tree, onBack } = await render({ interview: { feedback: 'UNAVAILABLE' }, windowHours: 24 })
    expect(texts).toContain('Feedback will not be available for this interview.')
    const all = texts.join(' ')
    expect(all).not.toMatch(/on its way|notify|within|usually|hour|day/i)
    const back = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join('') === 'Back to my interviews')
    expect(back.length).toBeGreaterThan(0)
    act(() => { back[0].props.onPress() })
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('a session that was never COMPLETED has no feedback to wait for', async () => {
    const { texts } = await render({ interview: { status: 'CANCELLED' } })
    expect(texts).toContain('Feedback will not be available for this interview.')
    expect(texts.join(' ')).not.toMatch(/on its way/i)
  })

  it('AWAITING: says it is on its way and names the interviewer’s hours from /config, not a number of its own', async () => {
    const { texts } = await render({ interview: { feedback: 'AWAITING' }, windowHours: 48 })
    expect(texts).toContain('Your feedback is on its way.')
    expect(texts.join(' ')).toMatch(/up to 48 hours after the session/)
    expect(texts.join(' ')).not.toMatch(/within a day|24/)
  })

  it('AWAITING with no hours in /config: still on its way, and no number is guessed', async () => {
    const { texts } = await render({ interview: { feedback: 'AWAITING' }, windowHours: null })
    expect(texts).toContain('Your feedback is on its way.')
    expect(texts.join(' ')).not.toMatch(/\d/)
    expect(texts.join(' ')).not.toMatch(/hour|day/i)
  })

  it('READY: draws the scorecard', async () => {
    const { texts } = await render({ interview: { feedback: 'READY' }, feedback: 'ready' })
    expect(texts).toContain('Overall score')
    expect(texts).toContain('Clear.')
  })

  it('a 404 whose interview says READY (it landed in between) offers Try again rather than a promise', async () => {
    const { texts } = await render({ interview: { feedback: 'READY' } })
    expect(texts).toContain('Could not load your feedback.')
    expect(texts).not.toContain('Your feedback is on its way.')
  })
})
