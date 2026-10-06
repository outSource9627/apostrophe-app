/**
 * ST-35 — résumés. A student can upload, view, replace and remove their résumé (one of them: a replacement swaps the old
 * one in place, never sits beside it), add a certificate, and the file rules are the server's. Employers open any
 * document through one hook, and a candidate's portfolio links — plain strings on the wire — are drawn again.
 */
import React from 'react'
import { Linking, Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiClientError } from '../src/lib/api/types'
import type { UploadRule } from '../src/lib/api/uploads'
import {
  documentsBody, refuseProfileFile, ruleSentence, saveErrorText, withoutDocument, withResume,
} from '../src/lib/profile/upload'
import { DocumentsStep, type Config } from '../src/screens/profile/wizardSteps'
import { ProfileViewScreen } from '../src/screens/profile/ProfileViewScreen'
import { ProfileResume } from '../src/components/employer/profile'
import { useCandidateDocument } from '../src/lib/employer/useCandidateDocument'
import type { CandidateDetail } from '../src/lib/api/employerFeed'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('react-native-video', () => ({ __esModule: true, default: 'Video' }))

const mockApiGet = jest.fn()
const mockApiPatch = jest.fn()
jest.mock('../src/lib/api', () => ({
  api: { get: (p: string) => mockApiGet(p), patch: (p: string, b: unknown) => mockApiPatch(p, b) },
  ApiClientError: jest.requireActual('../src/lib/api/types').ApiClientError,
}))
jest.mock('../src/lib/api/student', () => ({
  ...jest.requireActual('../src/lib/api/student'),
  getVideoResume: () => Promise.resolve({ status: 'NONE', live: false, held: false }),
  listSelfVideos: () => Promise.resolve({ videos: [] }),
}))
const mockUpload = jest.fn()
jest.mock('../src/lib/api/uploads', () => ({
  ...jest.requireActual('../src/lib/api/uploads'),
  uploadMedia: (...a: unknown[]) => mockUpload(...a),
}))
const mockPick = jest.fn()
jest.mock('@react-native-documents/picker', () => ({
  pick: (o: unknown) => mockPick(o),
  types: { allFiles: '*/*' },
  isKnownType: () => ({ isKnown: false, mimeType: null, UTType: null, preferredFilenameExtension: null }),
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}), { virtual: true })
const mockFetchDoc = jest.fn()
jest.mock('../src/lib/api/employerFeed', () => ({
  fetchCandidateDocument: (c: string, d: string) => mockFetchDoc(c, d),
}))

const PDF = 'application/pdf'
// Deliberately not the production numbers: the screens must read the config, not remember it.
const RESUME_RULE: UploadRule = { contentTypes: [PDF], maxBytes: 3 * 1048576, label: 'a PDF up to 3 MB' }
const DOC_RULE: UploadRule = { contentTypes: [PDF, 'image/png'], maxBytes: 4 * 1048576, label: 'a PDF or PNG up to 4 MB' }

const settle = async () => { await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) }) }
const textsOf = (tree: ReactTestRenderer.ReactTestRenderer) => tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))
const textOf = (node: ReactTestRenderer.ReactTestInstance) => node.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join('')
const pressable = (tree: ReactTestRenderer.ReactTestRenderer, match: (n: ReactTestRenderer.ReactTestInstance) => boolean) =>
  tree.root.findAll((n) => typeof n.props.onPress === 'function' && match(n))
const press = async (tree: ReactTestRenderer.ReactTestRenderer, label: string, which = 0) => {
  const hit = pressable(tree, (n) => n.props.accessibilityLabel === label || textOf(n) === label)
  expect(hit.length).toBeGreaterThan(which)
  await act(async () => { await hit[which].props.onPress() })
  await settle()
}

let openUrl: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
})
// Nothing may outlive its test.
const trees: ReactTestRenderer.ReactTestRenderer[] = []
const create = async (el: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => { tree = ReactTestRenderer.create(el) })
  trees.push(tree)
  return tree
}
afterEach(() => {
  for (const t of trees.splice(0)) act(() => { t.unmount() })
})

describe('the documents step body (helpers)', () => {
  const cert = { kind: 'CERTIFICATE', key: 'k/cert.pdf', name: 'cert.pdf' }
  const old = { kind: 'RESUME', key: 'k/old.pdf', name: 'old.pdf' }
  const next = { kind: 'RESUME', key: 'k/new.pdf', name: 'new.pdf' }

  it('swaps a résumé in place, never beside the old one', () => {
    expect(withResume([cert, old], next)).toEqual([cert, next])
    expect(withResume([old, cert], next)).toEqual([next, cert])
  })
  it('adds the résumé when there is none, and folds a legacy second one away', () => {
    expect(withResume([cert], next)).toEqual([cert, next])
    expect(withResume([old, cert, { ...old, key: 'k/older.pdf' }], next)).toEqual([next, cert])
  })
  it('removes by key and sends only what the step accepts', () => {
    expect(withoutDocument([cert, old], old.key)).toEqual([cert])
    expect(documentsBody([{ kind: 'RESUME', key: 'k', name: '' }, { ...cert, id: 'x', sizeBytes: 9 } as never], ['https://a.dev']))
      .toEqual({ documents: [{ kind: 'RESUME', key: 'k' }, cert], portfolioLinks: ['https://a.dev'] })
  })
  it('refuses a file in the web’s words, from the server’s rule — and refuses nothing without one', () => {
    expect(refuseProfileFile({ name: 'cv.docx', type: 'application/msword', size: 10 }, RESUME_RULE)).toBe('cv.docx is not a file we accept. Choose a PDF up to 3 MB.')
    expect(refuseProfileFile({ name: 'cv.pdf', type: PDF, size: 3.5 * 1048576 }, RESUME_RULE)).toBe('That file is 3.5 MB. The limit is 3 MB.')
    expect(refuseProfileFile({ name: 'cv.pdf', type: PDF, size: 10 }, RESUME_RULE)).toBeNull()
    expect(refuseProfileFile({ name: 'cv.zip', type: 'application/zip', size: 10 }, undefined)).toBeNull()
    expect(ruleSentence(RESUME_RULE)).toBe('A PDF up to 3 MB.')
    expect(ruleSentence(undefined)).toBe('The file type and size are checked when you upload.')
  })
  it('says why a save was refused: the field’s sentence over the request’s', () => {
    const e = new ApiClientError('VALIDATION' as never, 'Some fields need attention.', 400, { documents: 'Keep one résumé. Remove the old one, or replace it.' })
    expect(saveErrorText(e)).toBe('Keep one résumé. Remove the old one, or replace it.')
    expect(saveErrorText(new Error('x'))).toBe('Could not save. Try again.')
  })
})

describe('DocumentsStep (the wizard and the edit sheet)', () => {
  const config = { profile: { genders: [], scoreTypes: [], availability: [], employmentTypes: [] }, limits: { minSkills: 3 }, masterData: { skills: [], cities: [], languages: [] }, uploads: { RESUME: RESUME_RULE, DOCUMENT: DOC_RULE } } as Config
  const mount = async (draft: Record<string, unknown>) => {
    const patch = jest.fn()
    const tree = await create(<DocumentsStep draft={draft} patch={patch} config={config} profile={{}} />)
    return { tree, patch }
  }

  it('Replace résumé uploads under RESUME and swaps the old one in place, keeping the certificate', async () => {
    mockPick.mockResolvedValue([{ uri: 'content://x/new.pdf', name: 'new.pdf', type: PDF, size: 2048 }])
    mockUpload.mockResolvedValue('students/u/new.pdf')
    const { tree, patch } = await mount({ documents: [{ kind: 'RESUME', key: 'k/old.pdf', name: 'old.pdf' }, { kind: 'CERTIFICATE', key: 'k/c.pdf', name: 'c.pdf' }], portfolioLinks: [] })
    expect(textsOf(tree)).toContain('A PDF up to 3 MB.')
    expect(textsOf(tree)).toContain('A PDF or PNG up to 4 MB.')
    await press(tree, 'Replace résumé')
    expect(mockUpload).toHaveBeenCalledWith('RESUME', expect.objectContaining({ name: 'new.pdf', type: PDF }), expect.anything())
    expect(patch).toHaveBeenCalledWith({ documents: [{ kind: 'RESUME', key: 'students/u/new.pdf', name: 'new.pdf' }, { kind: 'CERTIFICATE', key: 'k/c.pdf', name: 'c.pdf' }] })
  })

  it('refuses a file over the server’s limit before anything is uploaded', async () => {
    mockPick.mockResolvedValue([{ uri: 'content://x/big.pdf', name: 'big.pdf', type: PDF, size: 3.5 * 1048576 }])
    const { tree, patch } = await mount({ documents: [], portfolioLinks: [] })
    await press(tree, 'Choose a file')
    expect(mockUpload).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
    expect(textsOf(tree)).toContain('That file is 3.5 MB. The limit is 3 MB.')
  })

  it('adds a certificate under DOCUMENT, beside the résumé', async () => {
    mockPick.mockResolvedValue([{ uri: 'content://x/c.png', name: 'c.png', type: 'image/png', size: 2048 }])
    mockUpload.mockResolvedValue('students/u/c.png')
    const { tree, patch } = await mount({ documents: [{ kind: 'RESUME', key: 'k/old.pdf', name: 'old.pdf' }], portfolioLinks: [] })
    await press(tree, 'Add a certificate')
    expect(mockUpload).toHaveBeenCalledWith('DOCUMENT', expect.anything(), expect.anything())
    expect(patch).toHaveBeenCalledWith({ documents: [{ kind: 'RESUME', key: 'k/old.pdf', name: 'old.pdf' }, { kind: 'CERTIFICATE', key: 'students/u/c.png', name: 'c.png' }] })
  })
})

describe('ProfileViewScreen — documents', () => {
  const mounted: { tree: ReactTestRenderer.ReactTestRenderer; client: QueryClient }[] = []
  afterEach(() => {
    for (const m of mounted.splice(0)) { act(() => { m.tree.unmount() }); m.client.clear() }
  })
  const RESUME = { id: 'a'.repeat(32), kind: 'RESUME', key: 'students/u/cv.pdf', name: 'cv.pdf', contentType: PDF, sizeBytes: 1000 }
  const CERT = { id: 'b'.repeat(32), kind: 'CERTIFICATE', key: 'students/u/c.pdf', name: 'c.pdf' }
  const profile = (documents: unknown[]) => ({
    photoKey: null, dateOfBirth: null, gender: null, city: null, languages: [], education: null, experience: [], skills: [],
    preferences: null, documents, portfolioLinks: ['https://github.com/asha'], publishedAt: null, completion: { pct: 40, canBook: true, missing: [] },
  })
  const render = async (documents: unknown[]) => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/students/me/profile') return Promise.resolve(profile(documents))
      if (path === '/config') return Promise.resolve({ profile: { genders: [], scoreTypes: [], availability: [], employmentTypes: [] }, limits: { minSkills: 3 }, masterData: { skills: [], cities: [], languages: [] }, uploads: { RESUME: RESUME_RULE } })
      if (path === '/students/me/audience') return Promise.resolve({ hiddenFromFeed: false, published: false })
      if (path === '/students/me') return Promise.resolve({ name: 'Asha' })
      if (path.startsWith('/students/me/documents/')) return Promise.resolve({ url: `https://signed.example/${path.split('/').pop()}`, expiresAt: '', name: null, contentType: null })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
    mockApiPatch.mockResolvedValue({})
    // No gc timer for the Replace / Remove mutations: nothing may outlive its test.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: Infinity } } })
    let tree!: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      tree = ReactTestRenderer.create(
        <QueryClientProvider client={client}>
          <ProfileViewScreen onBack={jest.fn()} onBook={jest.fn()} onVisibility={jest.fn()} onVideos={jest.fn()} onVideoResume={jest.fn()} />
        </QueryClientProvider>,
      )
    })
    mounted.push({ tree, client })
    for (let i = 0; i < 30 && !textsOf(tree).includes('Documents'); i++) await settle()
    await settle()
    return tree
  }

  it('gives the résumé its own row — View opens the student’s own signed link', async () => {
    const tree = await render([RESUME, CERT])
    const texts = textsOf(tree)
    expect(texts).toContain('cv.pdf')
    expect(texts).toContain('Résumé')
    expect(texts).toContain('Replace')
    expect(texts).toContain('Remove')
    await press(tree, 'View cv.pdf')
    expect(mockApiGet).toHaveBeenCalledWith(`/students/me/documents/${RESUME.id}`)
    expect(openUrl).toHaveBeenCalledWith(`https://signed.example/${RESUME.id}`)
    await press(tree, 'View c.pdf')
    expect(openUrl).toHaveBeenCalledWith(`https://signed.example/${CERT.id}`)
  })

  it('Remove asks first, then saves without the résumé — the certificate and the links go back as they were', async () => {
    const tree = await render([RESUME, CERT])
    await press(tree, 'Remove your résumé')
    expect(textsOf(tree)).toContain('Remove this résumé?')
    expect(mockApiPatch).not.toHaveBeenCalled()
    await press(tree, 'Remove cv.pdf')
    expect(mockApiPatch).toHaveBeenCalledWith('/students/me/profile/documents', {
      documents: [{ kind: 'CERTIFICATE', key: CERT.key, name: 'c.pdf' }],
      portfolioLinks: ['https://github.com/asha'],
    })
  })

  it('Replace uploads a new file and swaps it in place', async () => {
    mockPick.mockResolvedValue([{ uri: 'content://x/new.pdf', name: 'new.pdf', type: PDF, size: 2048 }])
    mockUpload.mockResolvedValue('students/u/new.pdf')
    const tree = await render([CERT, RESUME])
    await press(tree, 'Replace your résumé')
    expect(mockApiPatch).toHaveBeenCalledWith('/students/me/profile/documents', {
      documents: [{ kind: 'CERTIFICATE', key: CERT.key, name: 'c.pdf' }, { kind: 'RESUME', key: 'students/u/new.pdf', name: 'new.pdf' }],
      portfolioLinks: ['https://github.com/asha'],
    })
  })

  it('with no résumé, offers the upload under the server’s rule', async () => {
    const tree = await render([CERT])
    const texts = textsOf(tree)
    expect(texts).toContain('Add a résumé')
    expect(texts).toContain('A PDF up to 3 MB.')
    expect(texts).not.toContain('Replace')
  })
})

describe('employer side', () => {
  it('useCandidateDocument opens the signed link, and hands back the server’s sentence when it is refused', async () => {
    let hook!: ReturnType<typeof useCandidateDocument>
    function Probe() { hook = useCandidateDocument(); return null }
    await create(<Probe />)
    mockFetchDoc.mockResolvedValueOnce({ url: 'https://signed.example/cv', expiresAt: '', name: null, contentType: null })
    let failed: string | null = 'unset'
    await act(async () => { failed = await hook.open('student-1', 'doc-1') })
    expect(mockFetchDoc).toHaveBeenCalledWith('student-1', 'doc-1')
    expect(openUrl).toHaveBeenCalledWith('https://signed.example/cv')
    expect(failed).toBeNull()
    mockFetchDoc.mockRejectedValueOnce(new ApiClientError('NOT_FOUND' as never, 'This document is not available.', 404))
    await act(async () => { failed = await hook.open('student-1', 'doc-1') })
    expect(failed).toBe('This document is not available.')
  })

  it('draws a candidate’s portfolio links, which the server sends as plain strings', async () => {
    const candidate = {
      id: 'c1', name: 'Asha', city: null, qualification: null, tier: null, languages: [], education: null, experience: [], experienceYears: 0,
      skills: [], preferences: null, portfolioLinks: ['https://www.github.com/asha', 'asha.dev/work', ''], photoUrl: null,
      verifiedInterview: { verified: false, at: null }, shortlistCount: 0, shortlisted: false, interest: null, videos: [], documents: [],
    } as CandidateDetail
    const tree = await create(<ProfileResume candidate={candidate} onOpenLink={(u) => { Linking.openURL(u) }} />)
    const texts = textsOf(tree)
    expect(texts).toContain('Links')
    expect(texts).toContain('github.com')
    expect(texts).toContain('asha.dev')
    await press(tree, 'Open asha.dev')
    expect(openUrl).toHaveBeenCalledWith('https://asha.dev/work')
  })
})
