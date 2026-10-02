import { deletionConfirmMatches, hasChanges, mobileLabel, profileChanges, validateProfileDraft, webUrl } from '../src/lib/interviewer/profile'

const base = { name: 'Ravi Kumar', languages: ['English', 'Hindi'], bio: '' }

describe('validateProfileDraft', () => {
  it('accepts the saved profile', () => expect(validateProfileDraft(base)).toEqual({}))
  it('applies the server limits', () => {
    const e = validateProfileDraft({ name: ' R ', languages: [], bio: 'x'.repeat(281) })
    expect(Object.keys(e).sort()).toEqual(['bio', 'languages', 'name'])
    expect(validateProfileDraft({ ...base, name: 'x'.repeat(81) }).name).toMatch('at most 80')
    expect(validateProfileDraft({ ...base, languages: Array(13).fill('a') }).languages).toMatch('at most 12')
  })
})

describe('profileChanges', () => {
  it('is empty when nothing changed (language order is not a change)', () => {
    expect(hasChanges(profileChanges(base, { ...base, languages: ['Hindi', 'English'] }))).toBe(false)
  })
  it('sends only what changed, name trimmed', () => {
    expect(profileChanges(base, { ...base, name: '  Ravi K. Kumar ', bio: 'Hi' })).toEqual({ name: 'Ravi K. Kumar', bio: 'Hi' })
  })
  it('clears the bio with an empty string and the photo with null', () => {
    expect(profileChanges({ ...base, bio: 'Hi' }, base, null)).toEqual({ bio: '', avatarKey: null })
  })
})

describe('formatters', () => {
  it('formats a ten-digit mobile', () => {
    expect(mobileLabel('9800000001')).toBe('+91 98000 00001')
    expect(mobileLabel('abc')).toBe('abc')
  })
  it('matches the deletion confirmation against name, mobile or email', () => {
    const who = { name: 'Ravi Kumar', mobile: '+91 98000 00001', email: 'ravi.kumar@example.com' }
    expect(deletionConfirmMatches(' ravi kumar ', who)).toBe(true)
    expect(deletionConfirmMatches('+919800000001', who)).toBe(true)
    expect(deletionConfirmMatches('RAVI.KUMAR@EXAMPLE.COM', who)).toBe(true)
    expect(deletionConfirmMatches('Ravi', who)).toBe(false)
    expect(deletionConfirmMatches('', who)).toBe(false)
  })
  it('builds web URLs', () => expect(webUrl('/terms')).toMatch(/:3000\/terms$/))
})
