/**
 * The interviewer screening test screen against a stubbed contract: the rules,
 * a pick that is PUT and marked Saved, submit with its dialog, "Getting your
 * test ready…", and the closed states. No score is ever on screen.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { ScreeningTestScreen } from '../src/screens/interviewer/ScreeningTestScreen'
import { ApiClientError, ErrorCode } from '../src/lib/api/types'
import { keepScreening, readScreening } from '../src/lib/interviewer/screeningStore'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
const mockNav = {
  addListener: jest.fn(() => () => {}),
  popTo: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  getState: () => ({ routes: [{ name: 'JoinUs' }, { name: 'InterviewerScreening' }] }),
}
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useNavigation: () => mockNav,
    useRoute: () => ({ params: { token: 'tok' } }),
    useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
  }
})

const mockApi = {
  getScreening: jest.fn(),
  startScreening: jest.fn(),
  getScreeningAttempt: jest.fn(),
  saveScreeningAnswer: jest.fn(),
  submitScreening: jest.fn(),
}
jest.mock('../src/lib/api/screening', () => {
  const actual = jest.requireActual('../src/lib/api/screening')
  return {
    ...actual,
    getScreening: (...a: unknown[]) => mockApi.getScreening(...a),
    startScreening: (...a: unknown[]) => mockApi.startScreening(...a),
    getScreeningAttempt: (...a: unknown[]) => mockApi.getScreeningAttempt(...a),
    saveScreeningAnswer: (...a: unknown[]) => mockApi.saveScreeningAnswer(...a),
    submitScreening: (...a: unknown[]) => mockApi.submitScreening(...a),
  }
})

const state = (over: Record<string, unknown> = {}) => ({
  status: 'ISSUED', firstName: 'Priya', domains: ['Software Engineering', 'Data Science'],
  counts: { TECHNICAL: 1, REASONING: 1, IQ: 0, GK: 0 }, total: 2, timeLimitMinutes: 45,
  expiresAt: '2026-11-03T06:00:00Z', startedAt: null, deadlineAt: null, submittedAt: null,
  autoSubmitted: false, answeredCount: 0, serverNow: '2026-10-29T10:00:00Z', ...over,
})
const attempt = {
  status: 'IN_PROGRESS', deadlineAt: '2026-10-29T10:45:00Z', serverNow: '2026-10-29T10:00:00Z',
  questions: [
    { index: 0, section: 'TECHNICAL', domain: 'Software Engineering', text: 'Which status for a valid token without permission?', options: ['401', '403', '404', '409'] },
    { index: 1, section: 'REASONING', domain: null, text: 'Next in 2, 4, 8?', options: ['10', '12', '16', '18'] },
  ],
  answers: [null, null],
}

const trees: ReactTestRenderer.ReactTestRenderer[] = []
afterEach(async () => {
  // Unmounting clears the screen's timers (the second hand, "getting ready" retries).
  await act(async () => { trees.splice(0).forEach((t) => t.unmount()) })
})

const flush = () => act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 0)) })

async function mount() {
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => { tree = ReactTestRenderer.create(<ScreeningTestScreen />) })
  trees.push(tree)
  for (let i = 0; i < 5; i++) await flush()
  const texts = () => tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))
  const press = async (label: string) => {
    const node = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === label))[0]
    if (!node) throw new Error(`no button "${label}" in: ${texts().join(' | ')}`)
    await act(async () => { node.props.onPress() })
    for (let i = 0; i < 5; i++) await flush()
  }
  return { tree, texts, press }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockApi.saveScreeningAnswer.mockResolvedValue({ answeredCount: 1 })
})

describe('ScreeningTestScreen', () => {
  it('rules → start → pick (saved) → submit → submitted, never a score', async () => {
    mockApi.getScreening.mockResolvedValue(state())
    mockApi.startScreening.mockResolvedValue(attempt)
    mockApi.submitScreening.mockResolvedValue({ status: 'SUBMITTED', answered: 1, total: 2 })
    const { texts, press } = await mount()

    expect(texts()).toContain('Screening test')
    expect(texts()).toContain('2 questions in 45 minutes. Pick one answer for each.')
    expect(texts()).toContain('Technical questions cover the domains you picked: Software Engineering, Data Science.')
    await press('Start · 45:00')

    expect(texts()).toContain('Question 1 of 2')
    expect(texts()).toContain('45:00')
    expect(texts()).toContain('Technical 0/1')
    await press('403')
    expect(mockApi.saveScreeningAnswer).toHaveBeenCalledWith('tok', 0, 1)
    expect(texts()).toContain('Saved')
    expect(texts()).toContain('Technical 1/1')

    await press('Next')
    expect(texts()).toContain('Question 2 of 2')
    await press('Submit test')
    expect(texts()).toContain('You’ve answered 1 of 2. After you submit, you can’t change any answer.')
    await press('Submit')
    expect(mockApi.submitScreening).toHaveBeenCalledWith('tok')
    expect(texts()).toContain('Test submitted.')
    expect(texts().join(' ')).not.toMatch(/score|%/i)
  })

  it('PREPARING shows "Getting your test ready…" with the clock not started', async () => {
    mockApi.getScreening.mockResolvedValue(state())
    mockApi.startScreening.mockRejectedValue(new ApiClientError(ErrorCode.CONFLICT, 'Not yet', 409, undefined, undefined, { reason: 'PREPARING' }))
    const { texts, press } = await mount()
    await press('Start · 45:00')
    expect(texts()).toContain('Getting your test ready…')
    expect(texts()).toContain('Usually under a minute. The clock hasn’t started.')
  })

  it('resumes an attempt in progress at the first unanswered question', async () => {
    mockApi.getScreening.mockResolvedValue(state({ status: 'IN_PROGRESS', deadlineAt: attempt.deadlineAt }))
    mockApi.getScreeningAttempt.mockResolvedValue({ ...attempt, serverNow: '2026-10-29T10:41:00Z', answers: [2, null] })
    const { texts } = await mount()
    expect(texts()).toContain('Question 2 of 2')
    expect(texts()).toContain('04:00')
  })

  it('keeps a pick the server never got on this phone, and sends it when the test is opened again', async () => {
    await keepScreening({ token: 'tok', expiresAt: '2026-11-03T06:00:00Z', timeLimitMinutes: 45, counts: { TECHNICAL: 1, REASONING: 1, IQ: 0, GK: 0 }, total: 2 }, 'priya@example.com')
    mockApi.getScreening.mockResolvedValue(state({ status: 'IN_PROGRESS', deadlineAt: attempt.deadlineAt }))
    mockApi.getScreeningAttempt.mockResolvedValue(attempt)
    mockApi.saveScreeningAnswer.mockRejectedValue(new TypeError('Network request failed'))
    const first = await mount()
    await first.press('403')
    expect(first.texts()).not.toContain('Saved')
    expect((await readScreening())?.pending).toEqual({ 0: 1 })
    await act(async () => { first.tree.unmount() })

    mockApi.saveScreeningAnswer.mockResolvedValue({ answeredCount: 1 })
    const again = await mount()
    expect(mockApi.saveScreeningAnswer).toHaveBeenLastCalledWith('tok', 0, 1)
    expect(again.texts()).toContain('Question 2 of 2') // the first one without an answer
    await again.press('Previous')
    expect(again.texts()).toContain('Saved')
    expect((await readScreening())?.pending).toEqual({})
  })

  it('a pick refused after the deadline lands on Time’s up', async () => {
    mockApi.getScreening
      .mockResolvedValueOnce(state({ status: 'IN_PROGRESS', deadlineAt: attempt.deadlineAt }))
      .mockResolvedValue(state({ status: 'SUBMITTED', autoSubmitted: true, answeredCount: 0 }))
    mockApi.getScreeningAttempt.mockResolvedValue(attempt)
    mockApi.saveScreeningAnswer.mockRejectedValue(new ApiClientError(ErrorCode.CONFLICT, 'Too late', 409, undefined, undefined, { reason: 'DEADLINE_PASSED' }))
    const { texts, press } = await mount()
    await press('403')
    expect(texts()).toContain('Time’s up')
    expect(texts()).toContain('Your answers were submitted for you. 0 of 2 were answered.')
  })

  it('lands on the closed states', async () => {
    mockApi.getScreening.mockResolvedValue(state({ status: 'EXPIRED' }))
    expect((await mount()).texts()).toContain('It worked until 3 Nov. Write to us at support@lenient.in.')

    mockApi.getScreening.mockResolvedValue(state({ status: 'SUBMITTED', submittedAt: '2026-10-27T05:00:00Z' }))
    expect((await mount()).texts()).toContain('You took this test on 27 Oct. Each application gets one attempt.')

    mockApi.getScreening.mockResolvedValue(state({ status: 'SUBMITTED', autoSubmitted: true, answeredCount: 1 }))
    expect((await mount()).texts()).toContain('Your answers were submitted for you. 1 of 2 were answered.')

    mockApi.getScreening.mockRejectedValue(new ApiClientError(ErrorCode.NOT_FOUND, 'Not found.', 404))
    expect((await mount()).texts()).toContain('Write to us at support@lenient.in.')
  })
})
