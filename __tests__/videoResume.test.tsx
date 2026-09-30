/**
 * SP-07 — the student's video-resume screen draws the film in whichever state the
 * API reports it, and never a player for a film that is not there.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideoResumeScreen } from '../src/screens/profile/VideoResumeScreen'
import { ApiClientError } from '../src/lib/api/types'
import type { InterviewVideoRow, InterviewVideos, PrimaryInterviewResult, VideoResume } from '../src/lib/api/student'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
// The native player has no JS implementation under Jest: a host element stands in, carrying its props.
jest.mock('react-native-video', () => ({ __esModule: true, default: 'Video' }))
const mockGet = jest.fn()
const mockList = jest.fn()
const mockPrimary = jest.fn()
jest.mock('../src/lib/api/student', () => ({
  getVideoResume: (opts?: { interviewId?: string }) => mockGet(opts),
  getInterviewVideos: () => mockList(),
  setPrimaryInterview: (id: string) => mockPrimary(id),
}))

const film = (over: Partial<VideoResume>): VideoResume => ({
  status: 'NONE', publishedAt: null, interviewedAt: null, url: null, posterUrl: null,
  expiresAt: null, durationSec: null, reason: null, pipelinePending: false, live: false, held: false, ...over,
})

const playable = (over: Partial<VideoResume> = {}) => film({
  status: 'PUBLISHED', url: 'https://cdn.example/x.m3u8', posterUrl: 'https://cdn.example/p.jpg', durationSec: 46,
  publishedAt: '2026-09-26T10:00:00.000Z', interviewedAt: '2026-09-26T09:00:00.000Z', live: true, ...over,
})

const row = (over: Partial<InterviewVideoRow>): InterviewVideoRow => ({
  interviewId: 'iv1', interviewedAt: '2026-09-26T09:00:00.000Z', durationSec: 46, status: 'READY',
  primary: false, selectable: true, reason: null, ...over,
})

/** Two READY interviews, the newest primary: the smallest list the section draws. */
const twoInterviews = (over: Partial<InterviewVideos> = {}): InterviewVideos => ({
  videos: [
    row({ interviewId: 'iv2', interviewedAt: '2026-09-26T09:00:00.000Z', primary: true, selectable: false }),
    row({ interviewId: 'iv1', interviewedAt: '2026-09-20T09:00:00.000Z', durationSec: 61 }),
  ],
  pinned: false,
  ...over,
})

const settle = async () => { await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) }) }

/** Presses the element carrying this accessibility label — the app's own Button puts it on its Pressable. */
async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const hit = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
  expect(hit.length).toBeGreaterThan(0)
  await act(async () => { hit[0].props.onPress() })
  await settle()
}

const textsOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))

const open: { tree: ReactTestRenderer.ReactTestRenderer; client: QueryClient }[] = []
// Unmount and drop every cache, so no query timer outlives its test.
afterEach(async () => {
  for (const { tree, client } of open.splice(0)) {
    await act(async () => { tree.unmount() })
    client.clear()
  }
})

beforeEach(() => {
  mockGet.mockReset()
  mockList.mockReset()
  mockPrimary.mockReset()
  mockList.mockResolvedValue({ videos: [], pinned: false })
})

async function render(f: VideoResume, interviews?: InterviewVideos, watched?: VideoResume) {
  // The primary film unless an interview is asked for by id.
  mockGet.mockImplementation((opts?: { interviewId?: string }) => Promise.resolve(opts?.interviewId && watched ? watched : f))
  if (interviews) mockList.mockResolvedValue(interviews)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onBook = jest.fn()
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <VideoResumeScreen onBack={jest.fn()} onBook={onBook} />
      </QueryClientProvider>,
    )
  })
  // The query settles on a later tick than the first render: wait for the skeleton to give way.
  for (let i = 0; i < 20 && tree.root.findAllByType(Text).length === 0; i++) {
    await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) })
  }
  open.push({ tree, client })
  // The interview list is a second request: give it a turn too.
  await settle()
  const texts = textsOf(tree)
  const players = tree.root.findAll((n) => (n.type as unknown) === 'Video')
  return { texts, players, tree, onBook }
}

describe('VideoResumeScreen', () => {
  it('PUBLISHED: plays the film in a player and says when it was made and how long it runs', async () => {
    const { texts, players } = await render(playable({ expiresAt: '2026-09-26T10:15:00.000Z' }))
    expect(players).toHaveLength(1)
    expect(players[0].props.source).toEqual({ uri: 'https://cdn.example/x.m3u8' })
    expect(players[0].props.poster).toMatchObject({ source: { uri: 'https://cdn.example/p.jpg' } })
    expect(texts).toContain('Your video resume')
    expect(texts).toContain('The film from your interview. Employers watch this first; any videos you add yourself appear below it, marked as not verified.')
    expect(texts.join(' ')).not.toMatch(/only video employers see/)
    expect(texts).toContain('0:46')
    expect(texts.join(' ')).toMatch(/26 September 2026/)
    expect(texts).not.toContain('Processing')
    // Live, and only one interview: no notice and no list.
    expect(texts.join(' ')).not.toMatch(/not live yet|previewing/i)
    expect(texts).not.toContain('Your interview videos')
  })

  it('PROCESSING: says it is being prepared and offers Check again — no player, no promised time', async () => {
    const { texts, players } = await render(film({ status: 'PROCESSING' }))
    expect(players).toHaveLength(0)
    expect(texts).toContain('Your film is being prepared')
    expect(texts).toContain('Check again')
    expect(texts.join(' ')).not.toMatch(/hour|minutes|soon/i)
  })

  it('PROCESSING with no pipeline behind it: says it cannot say when', async () => {
    const { texts } = await render(film({ status: 'PROCESSING', pipelinePending: true }))
    expect(texts).toContain('Your film is not ready yet')
  })

  it('FAILED: says it could not be made and sends the student to support — not a guess about money or fault', async () => {
    const { texts, players } = await render(film({ status: 'FAILED' }))
    expect(players).toHaveLength(0)
    expect(texts).toContain('Your film could not be made')
    expect(texts).toContain('Talk to support')
    expect(texts.join(' ')).not.toMatch(/charged|refund|free/i)
  })

  it('UNPUBLISHED: says it is down and shows the reason the admin gave', async () => {
    const { texts, players } = await render(film({ status: 'UNPUBLISHED', reason: 'Contains another person’s details.' }))
    expect(players).toHaveLength(0)
    expect(texts).toContain('Your film has been taken down')
    expect(texts).toContain('REASON GIVEN')
    expect(texts).toContain('Contains another person’s details.')
  })

  it('NONE: says there is no film yet and books an interview', async () => {
    const { texts, tree, onBook } = await render(film({ status: 'NONE' }))
    expect(texts).toContain('You do not have a video resume yet')
    const book = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Book an interview'
      || (n.props.onPress === onBook))
    expect(book.length).toBeGreaterThan(0)
  })

  it('a PUBLISHED film that somehow has no address is not drawn as a player', async () => {
    const { texts, players } = await render(film({ status: 'PUBLISHED', url: null }))
    expect(players).toHaveLength(0)
    expect(texts).toContain('Your film is being prepared')
  })

  it('HELD: a published film that is not live says a top-up is outstanding and that employers cannot see it', async () => {
    const { texts, players } = await render(playable({ live: false, held: true }))
    expect(players).toHaveLength(1)
    expect(texts).toContain('Your video resume is not live yet. A top-up on your interview is outstanding — employers cannot see it until it is settled.')
  })

  it('a published film that is live shows no notice', async () => {
    const { texts } = await render(playable({ live: true, held: false }))
    expect(texts.join(' ')).not.toMatch(/not live yet|previewing/i)
  })

  describe('your interview videos', () => {
    it('is not drawn for a single interview', async () => {
      const { texts } = await render(playable(), { videos: [row({ primary: true, selectable: false })], pinned: false })
      expect(texts).not.toContain('Your interview videos')
    })

    it('lists each interview with its date, length and state, and offers Make primary only where the API says selectable', async () => {
      const { texts, tree } = await render(playable(), {
        videos: [
          row({ interviewId: 'iv3', interviewedAt: '2026-09-26T09:00:00.000Z', primary: true, selectable: false }),
          row({ interviewId: 'iv2', interviewedAt: '2026-09-20T09:00:00.000Z', durationSec: 61 }),
          row({ interviewId: 'iv1', interviewedAt: '2026-09-10T09:00:00.000Z', status: 'UNPUBLISHED', selectable: false, reason: 'An admin took this video down.' }),
        ],
        pinned: false,
      })
      expect(texts).toContain('Your interview videos')
      expect(texts).toContain('Employers see the video marked Primary. Your most recent interview is primary until you choose another.')
      expect(texts).toContain('26 September 2026')
      expect(texts).toContain('20 September 2026')
      expect(texts).toContain('10 September 2026')
      expect(texts).toContain('1:01')
      expect(texts.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining(['primary', 'ready', 'taken down']))
      // The reason is shown for a video that is neither primary nor selectable.
      expect(texts).toContain('An admin took this video down.')
      const make = tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && /^Make the interview of/.test(n.props.accessibilityLabel) && typeof n.props.onPress === 'function')
      expect(make.length).toBeGreaterThan(0)
      expect(make.every((n) => n.props.accessibilityLabel.includes('20 September 2026'))).toBe(true)
      // Watch is offered for a video that can be watched, not for one that was taken down.
      const watch = (d: string) => tree.root.findAll((n) => n.props.accessibilityLabel === `Watch the interview of ${d}`)
      expect(watch('20 September 2026').length).toBeGreaterThan(0)
      expect(watch('10 September 2026')).toHaveLength(0)
    })

    it('says a newer interview will not replace an older primary, when the API says pinned', async () => {
      const { texts } = await render(playable(), twoInterviews({ pinned: true }))
      expect(texts).toContain('A newer interview will not replace this one until you choose it.')
    })

    it('Make primary calls the API for that interview, then says what it means when held and pinned', async () => {
      mockPrimary.mockResolvedValue({ primaryInterviewId: 'iv1', pinned: true, live: false, held: true } satisfies PrimaryInterviewResult)
      const { tree } = await render(playable(), twoInterviews())
      await press(tree, 'Make the interview of 20 September 2026 your primary video')
      expect(mockPrimary).toHaveBeenCalledTimes(1)
      expect(mockPrimary).toHaveBeenCalledWith('iv1')
      const texts = textsOf(tree)
      expect(texts).toContain('This is now your primary video.')
      expect(texts).toContain('Your profile stays off the feed until your top-up is settled.')
      expect(texts).toContain('A newer interview will not replace this one until you choose it.')
      // The list and the film are read again.
      expect(mockList.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('shows the API\'s refusal inline and says nothing became primary', async () => {
      mockPrimary.mockRejectedValue(new ApiClientError('VALIDATION', 'That video is not ready yet, so it cannot be your video resume.', 400))
      const { tree } = await render(playable(), twoInterviews())
      await press(tree, 'Make the interview of 20 September 2026 your primary video')
      const texts = textsOf(tree)
      expect(texts).toContain('That video is not ready yet, so it cannot be your video resume.')
      expect(texts).not.toContain('This is now your primary video.')
    })

    it('Watch reads THAT interview\'s film into the player, and the player renews the same interview', async () => {
      const watched = playable({ url: 'https://cdn.example/other.m3u8', live: false, interviewedAt: '2026-09-20T09:00:00.000Z' })
      const { tree } = await render(playable(), twoInterviews(), watched)
      expect(mockGet).toHaveBeenLastCalledWith(undefined)

      await press(tree, 'Watch the interview of 20 September 2026')
      expect(mockGet).toHaveBeenLastCalledWith({ interviewId: 'iv1' })
      const player = () => tree.root.findAll((n) => (n.type as unknown) === 'Video')[0]
      expect(player().props.source).toEqual({ uri: 'https://cdn.example/other.m3u8' })
      // Not the primary one: the screen says it is a preview.
      expect(textsOf(tree)).toContain('You are previewing a video that is not your primary one.')

      // A lapsed link: the player asks for a new address — for the same interview, not the primary one.
      mockGet.mockClear()
      await act(async () => { player().props.onError() })
      await settle()
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith({ interviewId: 'iv1' })
    })

    it('a held profile says so before it says it is a preview', async () => {
      const watched = playable({ url: 'https://cdn.example/other.m3u8', live: false, held: true })
      const { tree } = await render(playable({ live: false, held: true }), twoInterviews(), watched)
      await press(tree, 'Watch the interview of 20 September 2026')
      const texts = textsOf(tree)
      expect(texts).toContain('Your video resume is not live yet. A top-up on your interview is outstanding — employers cannot see it until it is settled.')
      expect(texts).not.toContain('You are previewing a video that is not your primary one.')
    })
  })
})
