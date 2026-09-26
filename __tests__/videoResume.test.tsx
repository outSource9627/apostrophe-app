/**
 * SP-07 — the student's video-resume screen draws the film in whichever state the
 * API reports it, and never a player for a film that is not there.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideoResumeScreen } from '../src/screens/profile/VideoResumeScreen'
import type { VideoResume } from '../src/lib/api/student'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
// The native player has no JS implementation under Jest: a host element stands in, carrying its props.
jest.mock('react-native-video', () => ({ __esModule: true, default: 'Video' }))
const mockGet = jest.fn()
jest.mock('../src/lib/api/student', () => ({ getVideoResume: () => mockGet() }))

const film = (over: Partial<VideoResume>): VideoResume => ({
  status: 'NONE', publishedAt: null, interviewedAt: null, url: null, posterUrl: null,
  expiresAt: null, durationSec: null, reason: null, pipelinePending: false, ...over,
})

async function render(f: VideoResume) {
  mockGet.mockResolvedValue(f)
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
  const texts = tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))
  const players = tree.root.findAll((n) => (n.type as unknown) === 'Video')
  return { texts, players, tree, onBook }
}

describe('VideoResumeScreen', () => {
  it('PUBLISHED: plays the film in a player and says when it was made and how long it runs', async () => {
    const { texts, players } = await render(film({
      status: 'PUBLISHED', url: 'https://cdn.example/x.m3u8', posterUrl: 'https://cdn.example/p.jpg',
      durationSec: 46, publishedAt: '2026-09-26T10:00:00.000Z', interviewedAt: '2026-09-26T09:00:00.000Z',
      expiresAt: '2026-09-26T10:15:00.000Z',
    }))
    expect(players).toHaveLength(1)
    expect(players[0].props.source).toEqual({ uri: 'https://cdn.example/x.m3u8' })
    expect(players[0].props.poster).toMatchObject({ source: { uri: 'https://cdn.example/p.jpg' } })
    expect(texts).toContain('Your video resume')
    expect(texts).toContain('0:46')
    expect(texts.join(' ')).toMatch(/26 September 2026/)
    expect(texts).not.toContain('Processing')
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
})
