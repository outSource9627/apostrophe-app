/**
 * The employer derivation against the canvas's own fixtures
 * (docs/design/canvas/employer-onboarding: Copperleaf Logistics, times in
 * Asia/Kolkata). The web runs the same file, so these strings are the parity
 * contract between the two surfaces.
 */
import {
  checkEmployerFile, megabytes, resolveContentType,
  type EmployerState, type Requirement,
} from '../src/lib/api/employer'
import {
  formatCountdown, formatIst, promptCopy, promptRoute, promptState, requirementPill, verificationPrompt,
} from '../src/lib/employer/state'

// 16 Sep 2026, 11:42 AM IST is 06:12 UTC.
const SUBMITTED = '2026-09-16T06:12:00.000Z'
const TARGET = '2026-09-17T06:12:00.000Z'
const REVIEWED = '2026-09-16T11:35:00.000Z'

const email: Requirement = {
  key: 'WORK_EMAIL', kinds: [], status: 'APPROVED', document: null, reason: null,
  email: 'shalini.gupta@copperleaf.test', domain: 'copperleaf.test', matchesWebsite: true, confirmedAt: SUBMITTED,
}

function employer(patch: Partial<EmployerState> & { requirements: Requirement[] }): EmployerState {
  return {
    id: 'e1',
    company: {
      name: 'Copperleaf Logistics', industry: 'Logistics', size: '11-50', website: 'https://copperleaf.test',
      officeLocation: 'Pune', authorisedPerson: { name: 'Shalini Gupta', designation: 'Founder' },
    },
    contact: { email: 'shalini.gupta@copperleaf.test', mobile: '9800000003' },
    documents: [],
    verification: {
      status: 'PENDING', submittedAt: null, reviewedAt: null, approvedAt: null, reason: null,
      requestedDocumentKinds: [], resubmissionCount: 0, slaHours: 24, decisionTargetAt: null,
    },
    verified: false,
    message: null,
    missingDocumentKinds: [],
    missingRequirements: [],
    status: 'ACTIVE',
    ...patch,
  }
}

const doc = (kind: 'GST' | 'PHOTO_ID', status: 'SUBMITTED' | 'APPROVED' | 'REJECTED', reason: string | null = null) => ({
  kind, uploadedAt: SUBMITTED, status, reason, reviewedAt: status === 'SUBMITTED' ? null : REVIEWED,
})

describe('formatIst', () => {
  it('reads a UTC instant in Asia/Kolkata, the way every row stamps it', () => {
    expect(formatIst(SUBMITTED)).toBe('16 Sep 2026 · 11:42 AM IST')
    expect(formatIst('2026-09-16T18:30:00.000Z')).toBe('17 Sep 2026 · 12:00 AM IST')
    expect(formatIst('not a date')).toBe('')
  })

  it('counts a resend down in mono digits, never below zero', () => {
    expect(formatCountdown(19)).toBe('00:19')
    expect(formatCountdown(-3)).toBe('00:00')
  })
})

describe('the verification prompt', () => {
  it('todo · names what is outstanding and the server’s decision window', () => {
    const s = employer({
      missingRequirements: ['COMPANY_PROOF', 'PHOTO_ID'],
      requirements: [
        { key: 'COMPANY_PROOF', kinds: ['GST', 'CIN', 'PAN'], status: 'MISSING', document: null, reason: null },
        { key: 'PHOTO_ID', kinds: ['PHOTO_ID'], status: 'MISSING', document: null, reason: null },
        email,
      ],
    })
    expect(promptState(s)).toBe('todo')
    const p = promptCopy(s, 'todo')
    expect(p.tone).toBe('neutral')
    expect(p.title).toBe('Verification · 2 of 3 still needed')
    expect(p.body).toBe('Company proof and your photo ID. A reviewer decides within 24 hours of you submitting.')
    expect(p.href).toBe('EmployerDocuments')
  })

  it('review · the target is a time in IST', () => {
    const s = employer({
      verification: { ...employer({ requirements: [] }).verification, submittedAt: SUBMITTED, decisionTargetAt: TARGET },
      requirements: [
        { key: 'COMPANY_PROOF', kinds: ['GST', 'CIN', 'PAN'], status: 'SUBMITTED', document: doc('GST', 'SUBMITTED'), reason: null },
        { key: 'PHOTO_ID', kinds: ['PHOTO_ID'], status: 'SUBMITTED', document: doc('PHOTO_ID', 'SUBMITTED'), reason: null },
        email,
      ],
    })
    expect(promptState(s)).toBe('review')
    expect(promptCopy(s, 'review').body).toBe('Both documents are with a reviewer. We aim to decide by 11:42 AM IST on 17 Sep.')
    expect(promptRoute('review')).toBe('EmployerStatus')
  })

  it('rejected · names the document, keeps what passed, and is never crimson', () => {
    const s = employer({
      verification: { ...employer({ requirements: [] }).verification, status: 'REJECTED', submittedAt: SUBMITTED, reviewedAt: REVIEWED },
      requirements: [
        { key: 'COMPANY_PROOF', kinds: ['GST', 'CIN', 'PAN'], status: 'APPROVED', document: doc('GST', 'APPROVED'), reason: null },
        { key: 'PHOTO_ID', kinds: ['PHOTO_ID'], status: 'REJECTED', document: doc('PHOTO_ID', 'REJECTED', 'Too blurred.'), reason: 'Too blurred.' },
        email,
      ],
    })
    const p = verificationPrompt(s)!
    expect(p.state).toBe('rejected')
    expect(p.tone).toBe('danger')
    expect(p.title).toBe('Photo ID not accepted')
    expect(p.body).toBe('Upload a new copy to finish. Your GST certificate is approved.')
    expect(requirementPill(s.requirements[1])).toEqual({ label: 'Rejected', tone: 'danger' })
  })

  it('moreInfo · a request, not a refusal', () => {
    const s = employer({
      verification: {
        ...employer({ requirements: [] }).verification,
        status: 'MORE_INFO', reviewedAt: REVIEWED, requestedDocumentKinds: ['GST', 'CIN'],
      },
      requirements: [email],
    })
    const p = verificationPrompt(s)!
    expect(p.tone).toBe('warning')
    expect(p.title).toBe('One more document requested')
    expect(p.body).toBe('Add a GST certificate or CIN. Nothing you sent was refused.')
  })

  it('verified · drawn once on the screen that watched, then gone', () => {
    const s = employer({ verified: true, requirements: [email] })
    expect(promptState(s, { justVerified: true })).toBe('verified')
    expect(promptState(s)).toBeNull()
    expect(verificationPrompt(s, { justVerified: true })!.title).toBe('Verified just now')
  })
})

describe('upload faults are named before anything is sent', () => {
  it('refuses a Word document by type', () => {
    const e = checkEmployerFile({ name: 'aadhaar.docx', type: 'application/msword', size: 20_000 })
    expect(e?.fault).toBe('type')
  })

  it('refuses a 14.2 MB scan with its real size', () => {
    const e = checkEmployerFile({ name: 'aadhaar-scan.pdf', type: 'application/pdf', size: Math.round(14.2 * 1048576) })
    expect(e?.fault).toBe('size')
    expect(e?.message).toBe('aadhaar-scan.pdf is 14.2 MB, over the 10 MB limit.')
  })

  it('takes an untyped Android PDF by its extension', () => {
    expect(resolveContentType({ name: 'copperleaf-gst-reg06.pdf', type: '' })).toBe('application/pdf')
    expect(checkEmployerFile({ name: 'copperleaf-gst-reg06.pdf', type: '', size: 4_800_000 })).toBeNull()
    expect(megabytes(4_823_449)).toBe('4.6 MB')
  })
})
