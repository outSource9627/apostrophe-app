/**
 * SP-03/SP-04 — the student's own videos: they can watch, edit and remove each one, what an edit costs is said
 * before and reported after, and every number comes from /config.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { editOutcome, refusePicked, VideosScreen } from '../src/screens/VideosScreen'
import { ApiClientError } from '../src/lib/api/types'
import type { PickedMedia, UploadRule } from '../src/lib/api/uploads'
import type { SelfVideo, SelfVideoEdit } from '../src/lib/api/student'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
// The native player has no JS implementation under Jest: a host element stands in, carrying its props.
jest.mock('react-native-video', () => ({ __esModule: true, default: 'Video' }))

const mockApiGet = jest.fn()
jest.mock('../src/lib/api', () => ({ api: { get: (p: string) => mockApiGet(p), patch: jest.fn(), post: jest.fn() } }))

const mockList = jest.fn()
const mockEdit = jest.fn()
const mockDelete = jest.fn()
const mockAdd = jest.fn()
jest.mock('../src/lib/api/student', () => ({
  listSelfVideos: () => mockList(),
  editSelfVideo: (id: string, patch: unknown) => mockEdit(id, patch),
  deleteSelfVideo: (id: string) => mockDelete(id),
  addSelfVideo: (input: unknown) => mockAdd(input),
  getVideoResume: () => Promise.resolve({ status: 'NONE', live: false, held: false }),
}))

const mockPick = jest.fn()
const mockUpload = jest.fn()
jest.mock('../src/lib/api/uploads', () => ({
  ...jest.requireActual('../src/lib/api/uploads'),
  pickVideo: () => mockPick(),
  uploadMedia: (...a: unknown[]) => mockUpload(...a),
}))

const RULE: UploadRule = { contentTypes: ['video/mp4'], maxBytes: 5 * 1048576, label: 'an MP4 video' }
// Deliberately not the production numbers: the screen must read the config, not remember it.
const config = (over: { max?: number; seconds?: number; rule?: UploadRule | null } = {}) => ({
  limits: { selfVideoMaxCount: over.max ?? 4, selfVideoMaxSeconds: over.seconds ?? 45 },
  ...(over.rule === null ? {} : { uploads: { SELF_VIDEO: over.rule ?? RULE } }),
})

const video = (over: Partial<SelfVideo>): SelfVideo => ({
  id: 'v1', slot: 1, kind: 'INTRO', title: null, durationSec: 30, sizeBytes: 1000, status: 'PENDING',
  rejectionReason: null, url: 'https://cdn.example/v1.mp4', createdAt: '2026-09-20T09:00:00.000Z', editedAt: null, ...over,
})

const settle = async () => { await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) }) }
const textsOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))

async function render(videos: SelfVideo[], cfg = config()) {
  mockList.mockResolvedValue({ videos })
  mockApiGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/config' ? cfg : { hiddenFromFeed: false }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <VideosScreen onBack={jest.fn()} />
      </QueryClientProvider>,
    )
  })
  open.push({ tree, client })
  for (let i = 0; i < 20 && !textsOf(tree).includes('Say a bit more.'); i++) await settle()
  await settle()
  return tree
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, match: (n: ReactTestRenderer.ReactTestInstance) => boolean) {
  const hit = tree.root.findAll((n) => match(n) && typeof n.props.onPress === 'function')
  expect(hit.length).toBeGreaterThan(0)
  await act(async () => { hit[0].props.onPress() })
  await settle()
}
const pressLabel = (tree: ReactTestRenderer.ReactTestRenderer, label: string) =>
  press(tree, (n) => n.props.accessibilityLabel === label)
const pressButton = (tree: ReactTestRenderer.ReactTestRenderer, label: string) =>
  press(tree, (n) => n.props.label === label)
const players = (tree: ReactTestRenderer.ReactTestRenderer) => tree.root.findAll((n) => (n.type as unknown) === 'Video')

const open: { tree: ReactTestRenderer.ReactTestRenderer; client: QueryClient }[] = []
// Unmount and drop every cache, so no query timer outlives its test.
afterEach(async () => {
  for (const { tree, client } of open.splice(0)) {
    await act(async () => { tree.unmount() })
    client.clear()
  }
})

beforeEach(() => {
  ;[mockApiGet, mockList, mockEdit, mockDelete, mockAdd, mockPick, mockUpload].forEach((m) => m.mockReset())
})

describe('VideosScreen rows', () => {
  it('marks every self-uploaded clip Unverified and says what its state means, without inventing a time', async () => {
    const tree = await render([
      video({ id: 'a', status: 'APPROVED', title: 'My robot' }),
      video({ id: 'p', status: 'PENDING', kind: 'SKILL' }),
      video({ id: 'r', status: 'REJECTED', rejectionReason: 'The audio is missing.' }),
    ])
    const texts = textsOf(tree)
    expect(texts.filter((t) => t === 'Unverified')).toHaveLength(3)
    expect(texts).toContain('Shown on your full profile to employers, marked not verified.')
    expect(texts).toContain('We will tell you when it has been reviewed.')
    expect(texts).toContain('The audio is missing.')
    expect(texts).toContain('My robot')
    expect(texts.join(' ')).not.toMatch(/hour|minutes|soon|within/i)
    expect(texts).not.toContain('Edited · back in review')
  })

  it('says "Edited · back in review" when a pending clip has been edited', async () => {
    const tree = await render([video({ status: 'PENDING', editedAt: '2026-09-25T09:00:00.000Z' })])
    expect(textsOf(tree)).toContain('Edited · back in review')
  })

  it('shows an empty state, and the count and slots from the config', async () => {
    const tree = await render([], config({ max: 4 }))
    const texts = textsOf(tree)
    expect(texts).toContain('No videos yet.')
    expect(texts.join(' ')).toContain('0 OF 4')
    expect(texts).toContain('4 slots left')
  })

  it('says why there is no add card at the cap, using the config number', async () => {
    const tree = await render([video({ id: 'a' }), video({ id: 'b', slot: 2 })], config({ max: 2 }))
    const texts = textsOf(tree)
    expect(texts).toContain('That is all 2. Delete one to add another.')
    expect(texts).not.toContain('Choose a video from your gallery')
  })

  it('gives Edit and Delete an accessible name with the title and kind', async () => {
    const tree = await render([video({ title: 'My robot', kind: 'PROJECT' })])
    const labels = tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel)
    expect(labels).toContain('Edit My robot, A project')
    expect(labels).toContain('Delete My robot, A project')
  })
})

describe('remove', () => {
  it('asks first, then deletes only that video', async () => {
    const tree = await render([video({ id: 'a', title: 'My robot' })])
    await pressLabel(tree, 'Delete My robot, Introduction')
    expect(mockDelete).not.toHaveBeenCalled()
    expect(textsOf(tree)).toEqual(expect.arrayContaining(['Remove this video?', 'This cannot be undone.']))
    mockDelete.mockResolvedValue({ deleted: true })
    mockList.mockResolvedValue({ videos: [] })
    await pressLabel(tree, 'Remove My robot')
    expect(mockDelete).toHaveBeenCalledWith('a')
    expect(mockList.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(textsOf(tree)).toContain('No videos yet.')
  })

  it('says so when it fails, and the row stays', async () => {
    const tree = await render([video({ id: 'a', title: 'My robot' })])
    await pressLabel(tree, 'Delete My robot, Introduction')
    mockDelete.mockRejectedValue(new ApiClientError('INTERNAL', 'The video could not be removed right now.', 500))
    await pressLabel(tree, 'Remove My robot')
    const texts = textsOf(tree)
    expect(texts).toContain('The video could not be removed right now.')
    expect(texts).toContain('My robot')
    expect(texts).not.toContain('No videos yet.')
  })
})

describe('edit', () => {
  const edited = (over: Partial<SelfVideoEdit>): SelfVideoEdit => ({
    id: 'a', title: 'New title', kind: 'INTRO', status: 'PENDING', changed: true, resubmitted: false, ...over,
  })
  const typeTitle = async (tree: ReactTestRenderer.ReactTestRenderer, value: string) => {
    const input = tree.root.findAll((n) => n.props.accessibilityLabel === 'Video title' && typeof n.props.onChangeText === 'function')
    await act(async () => { input[0].props.onChangeText(value) })
  }

  it('APPROVED: says plainly that editing sends it back for review, and reports that it did', async () => {
    const tree = await render([video({ id: 'a', status: 'APPROVED', title: 'My robot' })])
    await pressLabel(tree, 'Edit My robot, Introduction')
    expect(textsOf(tree)).toContain('Editing sends this video back for review. Employers will not see it until it is approved again.')
    await typeTitle(tree, '  New title ')
    mockEdit.mockResolvedValue(edited({ status: 'PENDING', resubmitted: true }))
    await pressButton(tree, 'Save')
    expect(mockEdit).toHaveBeenCalledWith('a', { title: 'New title', kind: 'INTRO' })
    expect(textsOf(tree)).toContain('Saved. This video is back in review. Employers will not see it until it is approved again.')
  })

  it('REJECTED: shows the reason and the action is Edit and resubmit', async () => {
    const tree = await render([video({ id: 'a', status: 'REJECTED', rejectionReason: 'The audio is missing.' })])
    await pressLabel(tree, 'Edit Introduction, Introduction')
    const texts = textsOf(tree)
    expect(texts.filter((t) => t === 'The audio is missing.').length).toBeGreaterThanOrEqual(2)
    expect(texts).not.toContain('Editing sends this video back for review. Employers will not see it until it is approved again.')
    mockEdit.mockResolvedValue(edited({ title: null, status: 'PENDING', resubmitted: true }))
    await pressButton(tree, 'Edit and resubmit')
    expect(mockEdit).toHaveBeenCalledWith('a', { title: null, kind: 'INTRO' })
  })

  it('PENDING: no warning, and a no-op says nothing changed', async () => {
    const tree = await render([video({ id: 'a', status: 'PENDING', title: 'My robot' })])
    await pressLabel(tree, 'Edit My robot, Introduction')
    expect(textsOf(tree).join(' ')).not.toMatch(/back for review/)
    mockEdit.mockResolvedValue(edited({ title: 'My robot', changed: false }))
    await pressButton(tree, 'Save')
    expect(textsOf(tree)).toContain('Nothing changed.')
  })

  it('keeps the sheet open and says why when the server refuses', async () => {
    const tree = await render([video({ id: 'a', status: 'PENDING', title: 'My robot' })])
    await pressLabel(tree, 'Edit My robot, Introduction')
    mockEdit.mockRejectedValue(new ApiClientError('VALIDATION', 'Keep the title under 80 characters.', 400))
    await pressButton(tree, 'Save')
    expect(textsOf(tree)).toContain('Keep the title under 80 characters.')
  })

  it('reports the edit outcome from the server reply', () => {
    expect(editOutcome(edited({ changed: false }))).toBe('Nothing changed.')
    expect(editOutcome(edited({ resubmitted: true, status: 'PENDING' }))).toMatch(/back in review/)
    expect(editOutcome(edited({}))).toBe('Saved.')
  })
})

describe('play', () => {
  it('plays a clip that has an address, and renews it from the list once when the player errors', async () => {
    const tree = await render([video({ id: 'a', title: 'My robot', url: 'https://cdn.example/old.mp4' })])
    expect(players(tree)).toHaveLength(0)
    await pressLabel(tree, 'Play My robot')
    expect(players(tree)).toHaveLength(1)
    expect(players(tree)[0].props.source).toEqual({ uri: 'https://cdn.example/old.mp4' })

    mockList.mockClear()
    mockList.mockResolvedValue({ videos: [video({ id: 'a', title: 'My robot', url: 'https://cdn.example/new.mp4' })] })
    await act(async () => { players(tree)[0].props.onError() })
    await settle()
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(players(tree)[0].props.source).toEqual({ uri: 'https://cdn.example/new.mp4' })

    // A second error is not asked for again: it says so.
    await act(async () => { players(tree)[0].props.onError() })
    await settle()
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(textsOf(tree)).toContain('This video could not be played. Check your connection and try again.')
  })

  it('offers no play on a clip with no address', async () => {
    const tree = await render([video({ id: 'a', title: 'My robot', url: null })])
    const play = tree.root.findAll((n) => n.props.accessibilityLabel === 'Play My robot')
    expect(play).toHaveLength(0)
  })
})

describe('upload checks', () => {
  const picked = (over: Partial<PickedMedia> = {}): PickedMedia => ({
    uri: 'file:///v.mp4', name: 'v.mp4', type: 'video/mp4', size: 1048576, durationSec: 30, ...over,
  })

  it('refuses a wrong type or an oversize file from the config rule, and an over-long one from the config seconds', () => {
    expect(refusePicked(picked({ type: 'video/quicktime' }), RULE, 45)).toBe('Choose an MP4 video.')
    expect(refusePicked(picked({ size: 6 * 1048576 }), RULE, 45)).toBe('That video is 6 MB. The limit is 5 MB.')
    expect(refusePicked(picked({ durationSec: 61 }), RULE, 45)).toBe('That video is 61 seconds. Keep it under 45.')
    expect(refusePicked(picked(), RULE, 45)).toBeNull()
  })

  it('does not block, and does not invent a length, when the rule is missing or the length is unknown', () => {
    expect(refusePicked(picked({ type: 'video/quicktime', size: 900 * 1048576 }), undefined, 45)).toBeNull()
    expect(refusePicked(picked({ durationSec: 0 }), RULE, 45)).toBeNull()
    expect(refusePicked(picked({ durationSec: Number.NaN }), RULE, 45)).toBeNull()
  })

  it('sends NO length when the picker could not read one, and never a made-up 1', async () => {
    const tree = await render([])
    mockPick.mockResolvedValue(picked({ durationSec: 0 }))
    mockUpload.mockResolvedValue('uploads/key-1')
    mockAdd.mockResolvedValue({ id: 'n', slot: 1, status: 'PENDING' })
    await pressButton(tree, 'Choose a video from your gallery')
    expect(mockAdd).toHaveBeenCalledTimes(1)
    const sent = mockAdd.mock.calls[0][0]
    expect(sent).toMatchObject({ kind: 'INTRO', key: 'uploads/key-1', sizeBytes: 1048576 })
    expect('durationSec' in sent).toBe(false)
  })

  it('sends the length when the picker did read one', async () => {
    const tree = await render([])
    mockPick.mockResolvedValue(picked({ durationSec: 30 }))
    mockUpload.mockResolvedValue('uploads/key-2')
    mockAdd.mockResolvedValue({ id: 'n', slot: 1, status: 'PENDING' })
    await pressButton(tree, 'Choose a video from your gallery')
    expect(mockAdd.mock.calls[0][0].durationSec).toBe(30)
  })

  it('refuses a known over-long clip before uploading anything', async () => {
    const tree = await render([])
    mockPick.mockResolvedValue(picked({ durationSec: 61 }))
    await pressButton(tree, 'Choose a video from your gallery')
    expect(mockUpload).not.toHaveBeenCalled()
    expect(textsOf(tree)).toContain('That video is 61 seconds. Keep it under 45.')
  })

  it('says the server will check when the file rules did not load, and still lets the upload go ahead', async () => {
    const tree = await render([], config({ rule: null }))
    expect(textsOf(tree).join(' ')).toMatch(/checked when you upload/)
    mockPick.mockResolvedValue(picked({ type: 'video/quicktime' }))
    mockUpload.mockResolvedValue('uploads/key-3')
    mockAdd.mockResolvedValue({ id: 'n', slot: 1, status: 'PENDING' })
    await pressButton(tree, 'Choose a video from your gallery')
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })
})
