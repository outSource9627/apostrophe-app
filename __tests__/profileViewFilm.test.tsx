/**
 * SP-01 / SP-02 / SP-04 — the profile page draws its film card from the FILM's own state, not from whether the student
 * is in the feed: a film that is being made, failed or was taken down is never "Book an interview". It carries the
 * INTERVIEW date on its seal, and the student's own videos sit below it marked as unverified.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileViewScreen } from '../src/screens/profile/ProfileViewScreen'
import type { SelfVideo, VideoResume } from '../src/lib/api/student'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockApiGet = jest.fn()
jest.mock('../src/lib/api', () => ({
  api: { get: (path: string) => mockApiGet(path), patch: jest.fn() },
  ApiClientError: class ApiClientError extends Error { status = 0; isPaywall = false },
}))
const mockFilm = jest.fn()
const mockVideos = jest.fn()
jest.mock('../src/lib/api/student', () => ({
  getVideoResume: () => mockFilm(),
  listSelfVideos: () => mockVideos(),
}))

const PROFILE = {
  photoKey: null, dateOfBirth: null, gender: null, city: null, languages: [],
  education: null, experience: [], skills: [], preferences: null, documents: [], portfolioLinks: [],
  publishedAt: '2026-09-20T10:00:00.000Z',
  completion: { pct: 40, canBook: true, missing: [] },
}
const CONFIG = {
  profile: { genders: [], scoreTypes: [], availability: [], employmentTypes: [] },
  limits: { minSkills: 3 },
  masterData: { skills: [], cities: [], languages: [] },
}

const film = (over: Partial<VideoResume>): VideoResume => ({
  status: 'NONE', publishedAt: null, interviewedAt: null, url: null, posterUrl: null,
  expiresAt: null, durationSec: null, reason: null, pipelinePending: false, live: false, held: false, ...over,
})
const selfVideo = (over: Partial<SelfVideo>): SelfVideo => ({
  id: 'v1', slot: 1, kind: 'INTRO', title: null, durationSec: null, sizeBytes: null, status: 'APPROVED',
  rejectionReason: null, url: null, createdAt: '2026-09-21T10:00:00.000Z', editedAt: null, ...over,
})

const textOf = (node: ReactTestRenderer.ReactTestInstance) =>
  node.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join('')

const mounted: { tree: ReactTestRenderer.ReactTestRenderer; client: QueryClient }[] = []

// Nothing may outlive its test: an unmounted tree and a cleared cache leave react-query no timer to hold the process open.
afterEach(() => {
  for (const m of mounted.splice(0)) { act(() => { m.tree.unmount() }); m.client.clear() }
})

async function render(f: VideoResume, videos: SelfVideo[] = [], opts: { audienceFails?: boolean } = {}) {
  mockApiGet.mockImplementation((path: string) => {
    if (path === '/students/me/profile') return Promise.resolve(PROFILE)
    if (path === '/config') return Promise.resolve(CONFIG)
    if (path === '/students/me/audience') {
      return opts.audienceFails ? Promise.reject(new Error('down')) : Promise.resolve({ hiddenFromFeed: false, published: f.status === 'PUBLISHED' })
    }
    if (path === '/students/me') return Promise.resolve({ name: 'Asha', city: 'Pune' })
    return Promise.reject(new Error(`unexpected ${path}`))
  })
  mockFilm.mockResolvedValue(f)
  mockVideos.mockResolvedValue({ videos })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const on = { onBack: jest.fn(), onBook: jest.fn(), onVisibility: jest.fn(), onVideos: jest.fn(), onVideoResume: jest.fn() }
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <ProfileViewScreen {...on} />
      </QueryClientProvider>,
    )
  })
  mounted.push({ tree, client })
  // Everything settles on later ticks than the first render: wait for the film card and the videos section to give way.
  for (let i = 0; i < 30 && !/YOUR VIDEOS/.test(tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join('|')); i++) {
    await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) })
  }
  await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) })
  const texts = tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))
  const press = (label: string) => {
    const hit = tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === label)
    expect(hit.length).toBeGreaterThan(0)
    act(() => { hit[0].props.onPress() })
  }
  return { texts, tree, on, press }
}

describe('ProfileViewScreen film card', () => {
  it('NONE: says the interview becomes the video resume, and books', async () => {
    const { texts, on, press } = await render(film({ status: 'NONE' }))
    expect(texts.join(' ')).toMatch(/The interview you book becomes your video resume/)
    press('Book an interview')
    expect(on.onBook).toHaveBeenCalledTimes(1)
  })

  it('PROCESSING: says it is being prepared and never offers to book — even when the audience call fails', async () => {
    const { texts, on, press } = await render(film({ status: 'PROCESSING' }), [], { audienceFails: true })
    expect(texts).not.toContain('Book an interview')
    expect(texts).toContain('Processing')
    expect(texts.join(' ')).toMatch(/your film is being prepared/)
    expect(texts.join(' ')).not.toMatch(/soon|hour|minute/i)
    press('See details')
    expect(on.onVideoResume).toHaveBeenCalledTimes(1)
    expect(on.onBook).not.toHaveBeenCalled()
  })

  it('PROCESSING with no pipeline behind it: says it cannot say when', async () => {
    const { texts } = await render(film({ status: 'PROCESSING', pipelinePending: true }))
    expect(texts.join(' ')).toMatch(/We cannot say when it will be/)
    expect(texts).not.toContain('Book an interview')
  })

  it('FAILED: says it could not be made, not "book an interview"', async () => {
    const { texts, press, on } = await render(film({ status: 'FAILED' }))
    expect(texts).toContain('Could not be made')
    expect(texts).not.toContain('Book an interview')
    press('See details')
    expect(on.onVideoResume).toHaveBeenCalledTimes(1)
  })

  it('UNPUBLISHED: says it was taken down and gives the admin’s reason', async () => {
    const { texts } = await render(film({ status: 'UNPUBLISHED', reason: 'Shows another person’s details.' }))
    expect(texts).toContain('Taken down')
    expect(texts.join(' ')).toMatch(/Reason: Shows another person’s details\./)
    expect(texts).not.toContain('Book an interview')
  })

  it('PUBLISHED: the seal carries the INTERVIEW date, not the day it was published, and the copy no longer says "the only video"', async () => {
    const { texts, on, press } = await render(film({
      status: 'PUBLISHED', live: true,
      interviewedAt: '2026-09-25T09:00:00.000Z', publishedAt: '2026-09-26T10:00:00.000Z',
    }))
    expect(texts).toContain('Verified · 25 September 2026')
    expect(texts.join(' ')).not.toMatch(/26 September 2026/)
    expect(texts.join(' ')).not.toMatch(/only video employers see/)
    expect(texts).toContain('The film from your interview. Employers watch this first; any videos you add yourself appear below it, marked as not verified.')
    expect(texts).not.toContain('Book an interview')
    press('Watch my film')
    expect(on.onVideoResume).toHaveBeenCalledTimes(1)
  })

  it('PUBLISHED with no interview date falls back to the publish date', async () => {
    const { texts } = await render(film({ status: 'PUBLISHED', publishedAt: '2026-09-26T10:00:00.000Z' }))
    expect(texts).toContain('Verified · 26 September 2026')
  })
})

describe('ProfileViewScreen — your videos', () => {
  it('lists the student’s own videos, each marked Unverified, with a status and a link to manage them', async () => {
    const { texts, on, press } = await render(film({ status: 'NONE' }), [
      selfVideo({ id: 'a', title: 'My first project', kind: 'PROJECT', durationSec: 32, status: 'APPROVED' }),
      selfVideo({ id: 'b', slot: 2, kind: 'INTRO', title: null, status: 'PENDING' }),
      selfVideo({ id: 'c', slot: 3, kind: 'SKILL', title: 'Excel', status: 'REJECTED', rejectionReason: 'Too dark' }),
    ])
    expect(texts).toContain('YOUR VIDEOS')
    expect(texts).toContain('My first project')
    expect(texts).toContain('A PROJECT · 0:32')
    expect(texts).toContain('Introduction')
    expect(texts.filter((t) => t === 'Unverified')).toHaveLength(3)
    expect(texts).toContain('Live on your profile')
    expect(texts).toContain('Waiting for review')
    expect(texts).toContain('Not published')
    expect(texts).not.toContain('No videos yet.')
    press('Manage videos')
    expect(on.onVideos).toHaveBeenCalledTimes(1)
  })

  it('says "No videos yet." when there are none', async () => {
    const { texts } = await render(film({ status: 'NONE' }), [])
    expect(texts).toContain('No videos yet.')
    expect(texts).toContain('Manage videos')
    expect(texts).not.toContain('Unverified')
  })
})
