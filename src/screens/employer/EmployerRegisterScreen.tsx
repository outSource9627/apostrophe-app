import React, { useCallback, useRef, useState } from 'react'
import {
  AccessibilityInfo, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, useWindowDimensions, type TextInputProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Banner, Body, Button, Chip, ErrorState, Input, Sheet, Skeleton, text } from '../../components/ui'
import { EmBar, EmFoot, EmMono, EmTitle } from '../../components/employer/em'
import { Glyph, TextAction } from '../../components/employer'
import { api, ApiClientError, ErrorCode } from '../../lib/api'
import {
  COMPANY_SIZES, retryAfterSeconds, sendRegisterCodes,
  type CodeChannel, type CompanySize, type EmployerRegistrationDraft, type RegisterOtpResult,
} from '../../lib/api/employer'
import { COMPANY_SIZE_LABEL } from '../../lib/employer/state'

export interface EmployerRegisterScreenProps {
  onBack: () => void
  onSignIn: () => void
  /** Both codes are on their way. The draft carries the password: it goes to EmployerVerify in memory only. */
  onCodesSent: (p: { registration: EmployerRegistrationDraft; sent: RegisterOtpResult }) => void
}

/*
  ── EM-02 ⇄ EM-03 ───────────────────────────────────────────────────────────
  What the two registration screens share, the app half of the web's
  lib/employer/registration.ts and app/employers/register/form.ts. It lives in
  this file because EM-02 and EM-03 are its only readers; the verify screen
  imports it from here.

  MEMORY ONLY. The form itself travels to EM-03 as route params (it carries the
  password); what is kept here is each channel's progress — a proof is a signed
  30-minute credential for an address, and the phone's storage is not where a
  credential belongs. An app restart loses it, and that is the right trade.

  Progress is keyed by the address it was issued for. Changing the email or the
  mobile on EM-02 simply stops matching, so that row opens again on EM-03 — the
  server refuses a proof for any other address, and it is better to ask again
  than to fail at account creation.
*/

export type FieldKey =
  | 'companyName'
  | 'industry'
  | 'companySize'
  | 'website'
  | 'officeLocation'
  | 'name'
  | 'designation'
  | 'email'
  | 'mobile'
  | 'password'

export type FieldErrors = Partial<Record<FieldKey, string>>

/** Reading order on the screen: the company, then the person. Focus and the summary follow it. */
export const FIELD_ORDER: readonly FieldKey[] = [
  'companyName', 'industry', 'companySize', 'website', 'officeLocation',
  'name', 'designation', 'email', 'mobile', 'password',
]

export interface ChannelProgress {
  /** The normalised address or number this progress belongs to. */
  value: string
  /** Set once this row's code is confirmed. */
  proof: string | null
  expiresAt: string | null
  /** Epoch ms from which this row may ask for another code. Null: never sent. */
  resendAt: number | null
  /** Epoch ms until which the server refuses sends (the hourly limit). */
  blockedUntil: number | null
  /** The server's own sentence for that limit — its 5 is a server setting. */
  limitNote: string | null
}

const CHANNELS: readonly CodeChannel[] = ['EMAIL', 'MOBILE']
const progress: Record<CodeChannel, ChannelProgress | null> = { EMAIL: null, MOBILE: null }

/** Ten digits from whatever was typed or pasted — '+91 98000 00003' included. */
export function mobileDigits(v: string): string {
  const d = v.replace(/\D/g, '')
  return d.length > 10 ? d.slice(-10) : d
}

/** '+91 98000 00003' — how the number is read back on EM-03. */
export const displayMobile = (m: string) => `+91 ${m.slice(0, 5)} ${m.slice(5)}`

const normalised = (channel: CodeChannel, value: string) =>
  channel === 'EMAIL' ? value.trim().toLowerCase() : mobileDigits(value)

/** This channel's progress for exactly this address, or a fresh row when it was for another. */
export function channelProgress(channel: CodeChannel, value: string): ChannelProgress {
  const v = normalised(channel, value)
  const p = progress[channel]
  return p && p.value === v
    ? p
    : { value: v, proof: null, expiresAt: null, resendAt: null, blockedUntil: null, limitNote: null }
}

export function updateChannel(
  channel: CodeChannel,
  value: string,
  patch: Partial<Omit<ChannelProgress, 'value'>>,
): ChannelProgress {
  const next = { ...channelProgress(channel, value), ...patch }
  progress[channel] = next
  return next
}

/** Record a send — EM-02's first one, or one row's resend. */
export function markCodeSent(channel: CodeChannel, value: string, result: RegisterOtpResult, now = Date.now()) {
  const sent = channel === 'EMAIL' ? result.email : result.mobile
  if (!sent) return
  updateChannel(channel, value, {
    resendAt: now + sent.resendAfterSeconds * 1000,
    blockedUntil: null,
    limitNote: null,
  })
}

/** A proof that is present and will still be accepted a minute from now. */
export function proofValid(p: ChannelProgress, now = Date.now()): boolean {
  return Boolean(p.proof && p.expiresAt && new Date(p.expiresAt).getTime() - now > 60_000)
}

/**
 * A resend cooldown and the hourly allowance are both 429s. Only the hourly
 * limit carries `retryAt`, and only it runs past a couple of minutes; the
 * cooldown is drawn as the row's own countdown, the limit as an inert row.
 */
const isHourlyLimit = (e: ApiClientError) =>
  (e.meta?.retryAt ?? e.details?.retryAt) != null || (retryAfterSeconds(e) ?? 0) > 120

/** Applies a refused send to that channel alone. True when it was a rate limit and the row now carries it. */
export function applySendLimit(channel: CodeChannel, value: string, e: unknown, now = Date.now()): boolean {
  if (!(e instanceof ApiClientError) || e.code !== ErrorCode.RATE_LIMITED) return false
  const seconds = retryAfterSeconds(e)
  if (seconds === null) return false
  if (isHourlyLimit(e)) {
    updateChannel(channel, value, { blockedUntil: now + seconds * 1000, limitNote: e.message })
  } else {
    updateChannel(channel, value, { resendAt: now + seconds * 1000 })
  }
  return true
}

/** After the account exists: forget the proofs and anything waiting for the form. */
export function forgetRegistration() {
  progress.EMAIL = null
  progress.MOBILE = null
  returned = null
}

/** A request that never reached the server has no message of its own. */
export const CONNECTION_DROPPED = 'The connection dropped before that went through. Try again.'

export const messageOf = (e: unknown) => (e instanceof ApiClientError ? e.message : CONNECTION_DROPPED)

/** The register body's paths, as the server's validation names them, onto the form's fields. */
const SERVER_FIELD: Record<string, FieldKey> = {
  companyName: 'companyName',
  industry: 'industry',
  companySize: 'companySize',
  website: 'website',
  officeLocation: 'officeLocation',
  'authorisedPerson.name': 'name',
  'authorisedPerson.designation': 'designation',
  email: 'email',
  mobile: 'mobile',
  password: 'password',
}

export function formErrorsFrom(fields: Record<string, string> | undefined): FieldErrors {
  const errors: FieldErrors = {}
  for (const [path, message] of Object.entries(fields ?? {})) {
    const key = SERVER_FIELD[path]
    if (key) errors[key] = message
  }
  return errors
}

/** 409 on register: the message names the email address or the mobile number. */
export function conflictField(message: string): FieldKey {
  return /mobile/i.test(message) && !/email/i.test(message) ? 'mobile' : 'email'
}

/** 'An account already uses that email address. Sign in instead.' loses its tail; the Sign in action says it. */
export const withoutSignInTail = (message: string) => message.replace(/\s*Sign in instead\.?\s*$/i, '')

/**
 * What EM-03 hands back when the server refuses the form itself — an industry
 * no longer in the list, an address that already has an account — or when the
 * employer presses a row's Edit. EM-02 reads it once as it regains focus and
 * lands on the field, with the server's sentence under it.
 */
export interface ReturnedToForm {
  errors: FieldErrors
  /** The field whose error carries a Sign in action — an account already uses it. */
  signIn: FieldKey | null
  focus: FieldKey | null
}

let returned: ReturnedToForm | null = null

export function returnToForm(r: ReturnedToForm) {
  returned = r
}

function takeReturned(): ReturnedToForm | null {
  const r = returned
  returned = null
  return r
}

// ── The form ─────────────────────────────────────────────────────────────────
interface Form {
  companyName: string
  /** A master-data industry NAME. */
  industry: string
  companySize: CompanySize | ''
  website: string
  officeLocation: string
  name: string
  designation: string
  email: string
  /** Ten digits, no +91 — the prefix is furniture on the field, not part of the value. */
  mobile: string
  password: string
}

const EMPTY_FORM: Form = {
  companyName: '',
  industry: '',
  companySize: '',
  website: '',
  officeLocation: '',
  name: '',
  designation: '',
  email: '',
  mobile: '',
  password: '',
}

/** How the summary names a field inside its sentence. */
const SUMMARY_NAME: Record<FieldKey, string> = {
  companyName: 'company name',
  industry: 'industry',
  companySize: 'company size',
  website: 'website',
  officeLocation: 'office location',
  name: 'your name',
  designation: 'designation',
  email: 'work email',
  mobile: 'mobile',
  password: 'password',
}

/** '4 fields need an answer' / 'Company name, industry, company size and office location.' */
function summarise(errors: FieldErrors): { title: string; body: string } | null {
  const names = FIELD_ORDER.filter((k) => errors[k]).map((k) => SUMMARY_NAME[k])
  if (!names.length) return null
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return {
    title: `${names.length} ${names.length === 1 ? 'field needs' : 'fields need'} an answer`,
    body: `${list[0].toUpperCase()}${list.slice(1)}.`,
  }
}

const without = (errors: FieldErrors, key: FieldKey): FieldErrors => {
  const next = { ...errors }
  delete next[key]
  return next
}

/**
 * Mirrored from apostrophe-admin src/contracts/employer.ts PUBLIC_EMAIL_DOMAINS,
 * which is what the server refuses. It is checked here as well so the refusal
 * lands when the field loses focus, before a code is sent anywhere.
 */
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'live.com', 'rediffmail.com', 'protonmail.com',
  'proton.me', 'icloud.com', 'aol.com', 'zoho.com', 'mail.com', 'yandex.com',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * The host a website names, without a leading www. Null when it is not one.
 * A pattern rather than `new URL`, whose React Native polyfill accepts any
 * string without complaint.
 */
function websiteHost(website: string): string | null {
  const v = website.trim()
  if (!v) return null
  const m = (HAS_SCHEME.test(v) ? v : `https://${v}`).match(
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^\s@/]+@)?([^\s:/?#@]+)(?::\d+)?(?:[/?#]\S*)?$/i,
  )
  return m ? m[1].toLowerCase().replace(/^www\./, '') || null : null
}

/** 'copperleaf.test' becomes 'https://copperleaf.test'; the server stores a link, not a host. */
function normaliseWebsite(website: string): string {
  const v = website.trim()
  return !v || HAS_SCHEME.test(v) ? v : `https://${v}`
}

/**
 * The webmail refusal, naming the domain that WOULD work when the website gives
 * one: 'Use your work email address, not a personal one. An address at
 * copperleaf.test works.'
 */
function webmailRefusal(email: string, website: string): string | null {
  const domain = (email.trim().split('@')[1] ?? '').toLowerCase()
  if (!PUBLIC_EMAIL_DOMAINS.includes(domain)) return null
  const host = websiteHost(website)
  return `Use your work email address, not a personal one.${host ? ` An address at ${host} works.` : ''}`
}

/** Everything the server would refuse, checked before a code is sent. The contract's own messages. */
const COMPANY_KEYS: FieldKey[] = ['companyName', 'industry', 'companySize', 'website', 'officeLocation']

function validateForm(form: Form): FieldErrors {
  const errors: FieldErrors = {}
  if (form.companyName.trim().length < 2) errors.companyName = 'Enter the registered company name'
  if (!form.industry) errors.industry = 'Choose an industry'
  if (!form.companySize) errors.companySize = 'Choose a company size'
  if (form.website.trim() && !websiteHost(form.website)) errors.website = 'Enter the address of your website'
  if (form.officeLocation.trim().length < 2) errors.officeLocation = 'Where is the office?'
  if (form.name.trim().length < 2) errors.name = 'Enter your full name'
  if (form.designation.trim().length < 2) errors.designation = 'Enter your designation'
  if (!form.email.trim()) errors.email = 'Enter your work email'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address'
  else {
    const refusal = webmailRefusal(form.email, form.website)
    if (refusal) errors.email = refusal
  }
  if (!/^[6-9]\d{9}$/.test(form.mobile)) errors.mobile = 'Enter a valid 10-digit Indian mobile number'
  if (form.password.length < 10) errors.password = 'Use at least 10 characters'
  return errors
}

function draftOf(form: Form): EmployerRegistrationDraft {
  return {
    companyName: form.companyName.trim(),
    industry: form.industry,
    companySize: form.companySize as CompanySize,
    website: normaliseWebsite(form.website),
    officeLocation: form.officeLocation.trim(),
    authorisedPerson: { name: form.name.trim(), designation: form.designation.trim() },
    email: form.email.trim(),
    mobile: form.mobile,
    password: form.password,
  }
}

type Industry = { name: string; slug: string }

type TextInputRef = React.ComponentRef<typeof TextInput>
type ViewRef = React.ComponentRef<typeof View>

/**
 * EM-02 · Create account. ONE screen, two labelled blocks: the company, then
 * the person. No wizard and no progress dots, because a free product should
 * not read like a credit application.
 *
 * Create account checks everything the server would refuse — the summary names
 * the fields and focus moves to the first — then sends a code to each channel
 * and opens EM-03. The work email's webmail refusal lands earlier, when the
 * field loses focus, before anything is sent.
 *
 * Each channel is sent as its own request, as the web does. The rows on EM-03
 * fail on their own, and a send that carried both would come back as one
 * refusal naming neither — a mobile at its hourly limit would stop the email
 * code too. A channel that already has a code on the way for the same address,
 * or a live proof, is not sent again: returning here with Edit and coming
 * straight back must not spend the allowance twice.
 */
export function EmployerRegisterScreen({ onBack, onSignIn, onCodesSent }: EmployerRegisterScreenProps) {
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()

  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  /** The field whose error carries a Sign in action. */
  const [signIn, setSignIn] = useState<FieldKey | null>(null)
  /** The summary names what a Create account found. Server refusals are shown on their fields alone. */
  const [summaryOn, setSummaryOn] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [passwordShown, setPasswordShown] = useState(false)
  /** The design's two steps: the company (1 of 2), then the person (2 of 2). One form, one submit. */
  const [step, setStep] = useState<1 | 2>(1)

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const contentRef = useRef<ViewRef>(null)
  const summaryRef = useRef<ViewRef>(null)
  const blocks = useRef<Partial<Record<FieldKey, ViewRef | null>>>({})
  const inputs = useRef<Partial<Record<FieldKey, TextInputRef | null>>>({})

  // The list normally arrives before the picker is opened; the sheet asks again if it did not.
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<{ masterData: { industries: Industry[] } }>('/config', { anonymous: true }),
  })
  const industries = config.data?.masterData?.industries ?? []

  const summary = summaryOn ? summarise(errors) : null

  /**
   * Scrolls a field into view and gives it the caret. When the summary is up
   * and the field sits under it, the summary stays in view too — it is what
   * says why focus moved.
   */
  const focusField = useCallback((key: FieldKey, withSummary = false) => {
    const block = blocks.current[key]
    const content = contentRef.current
    if (block && content) {
      block.measureLayout(content, (_x, fieldY) => {
        const scrollTo = (y: number) =>
          scrollRef.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true })
        const summaryBlock = summaryRef.current
        if (!withSummary || !summaryBlock) return scrollTo(fieldY)
        summaryBlock.measureLayout(
          content,
          (_sx, summaryY) => scrollTo(fieldY - summaryY < viewport.height / 2 ? summaryY : fieldY),
          () => scrollTo(fieldY),
        )
      })
    }
    inputs.current[key]?.focus()
  }, [viewport.height])

  // EM-03 coming back: a row's Edit, or the server refusing the form itself.
  useFocusEffect(
    useCallback(() => {
      const r = takeReturned()
      if (!r) return
      setErrors((e) => ({ ...e, ...r.errors }))
      setSignIn(r.signIn)
      setSummaryOn(false)
      setFailure(null)
      const target = r.focus
      if (target) {
        setStep(COMPANY_KEYS.includes(target) ? 1 : 2)
        requestAnimationFrame(() => focusField(target))
      }
    }, [focusField]),
  )

  /** A change clears that field's error: a refusal about a value that is gone is a lie. */
  function change(key: FieldKey, patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }))
    if (errors[key]) setErrors((e) => without(e, key))
    if (signIn === key) setSignIn(null)
  }

  async function submit() {
    if (sending) return

    const found = validateForm(form)
    setErrors(found)
    setSignIn(null)
    setFailure(null)
    const first = FIELD_ORDER.find((k) => found[k])
    if (first) {
      if (COMPANY_KEYS.includes(first)) setStep(1)
      setSummaryOn(true)
      const s = summarise(found)
      if (s) AccessibilityInfo.announceForAccessibility(`${s.title}. ${s.body}`)
      // After the summary has rendered, so it can be measured and kept in view.
      requestAnimationFrame(() => focusField(first, true))
      return
    }

    setSummaryOn(false)
    setSending(true)
    Keyboard.dismiss()

    const draft = draftOf(form)
    const valueOf = (channel: CodeChannel) => (channel === 'EMAIL' ? draft.email : draft.mobile)
    const now = Date.now()
    const due = CHANNELS.filter((channel) => {
      const p = channelProgress(channel, valueOf(channel))
      return !proofValid(p, now) && p.resendAt === null && !(p.blockedUntil && p.blockedUntil > now)
    })

    const outcomes = await Promise.allSettled(
      due.map((channel) => sendRegisterCodes(channel === 'EMAIL' ? { email: draft.email } : { mobile: draft.mobile })),
    )

    const sent: RegisterOtpResult = { sent: true }
    const refused: FieldErrors = {}
    let stopped: string | null = null
    for (const [i, outcome] of outcomes.entries()) {
      const channel = due[i]
      if (outcome.status === 'fulfilled') {
        markCodeSent(channel, valueOf(channel), outcome.value, now)
        if (outcome.value.email) sent.email = outcome.value.email
        if (outcome.value.mobile) sent.mobile = outcome.value.mobile
        continue
      }
      // A limit is the row's to show on EM-03, with when to ask again.
      if (applySendLimit(channel, valueOf(channel), outcome.reason, now)) continue
      const key: FieldKey = channel === 'EMAIL' ? 'email' : 'mobile'
      const err = outcome.reason
      if (err instanceof ApiClientError && err.code === ErrorCode.VALIDATION) {
        refused[key] =
          (key === 'email' ? webmailRefusal(draft.email, draft.website ?? '') : null) ?? err.fields?.[key] ?? err.message
      } else {
        stopped = messageOf(err)
      }
    }

    setSending(false)
    const firstRefused = FIELD_ORDER.find((k) => refused[k])
    if (firstRefused || stopped) {
      setErrors(refused)
      setFailure(stopped)
      if (firstRefused) requestAnimationFrame(() => focusField(firstRefused))
      return
    }

    onCodesSent({ registration: draft, sent })
  }

  /** Step 1's Next: the company fields only. */
  function goNext() {
    const found = validateForm(form)
    const companyErrors: FieldErrors = {}
    for (const k of COMPANY_KEYS) if (found[k]) companyErrors[k] = found[k]
    setErrors((e) => ({ ...e, ...companyErrors }))
    const first = COMPANY_KEYS.find((k) => companyErrors[k])
    if (first) {
      requestAnimationFrame(() => focusField(first))
      return
    }
    Keyboard.dismiss()
    setStep(2)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const blockRef = (key: FieldKey) => (node: ViewRef | null) => {
    blocks.current[key] = node
  }
  const inputRef = (key: FieldKey) => (node: TextInputRef | null) => {
    inputs.current[key] = node
  }
  const next = (key: FieldKey) => () => inputs.current[key]?.focus()

  const signInAction = <TextAction label="Sign in" onPress={onSignIn} style={styles.inlineAction} />

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EmBar onBack={step === 2 ? () => setStep(1) : onBack} />

      <ScrollView
        ref={scrollRef}
        style={styles.grow}
        contentContainerStyle={[styles.body, { paddingBottom: space['2xl'] + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View ref={contentRef} collapsable={false} style={styles.content}>
          {step === 1 ? (
            <EmTitle eyebrow="Employer account" title="Create your account" sub="We verify your company before you see candidates." />
          ) : (
            <EmTitle eyebrow="You, the authorised person" title="Who’s vouching?" sub="The person who can vouch that this company is real. Usually whoever is signing up." />
          )}

          {!!summary && (
            <View ref={summaryRef} collapsable={false} accessibilityLiveRegion="assertive">
              <Banner tone="danger" title={summary.title}>
                {summary.body}
              </Banner>
            </View>
          )}

          {/* ── The company ──────────────────────────────────────────── */}
          {step === 1 && (
          <View style={styles.block}>

            <FormField label="Company name" error={errors.companyName} blockRef={blockRef('companyName')}>
              <Input
                inputRef={inputRef('companyName')}
                value={form.companyName}
                onChangeText={(v) => change('companyName', { companyName: v })}
                placeholder="As on your GST certificate or PAN"
                autoCapitalize="words"
                autoComplete="organization"
                textContentType="organizationName"
                accessibilityLabel="Company name"
                invalid={!!errors.companyName}
                editable={!sending}
              />
            </FormField>

            <FormField label="Industry" error={errors.industry} blockRef={blockRef('industry')}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={form.industry ? `Industry, ${form.industry}` : 'Industry, choose an industry'}
                disabled={sending}
                onPress={() => {
                  Keyboard.dismiss()
                  setIndustryOpen(true)
                  if (!industries.length && !config.isFetching) config.refetch()
                }}
                style={({ pressed }) => [
                  styles.box,
                  errors.industry ? styles.boxInvalid : industryOpen ? styles.boxFocus : styles.boxIdle,
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={[text.uiBase, styles.grow, !form.industry && styles.placeholder]}>
                  {form.industry || 'Choose an industry'}
                </Text>
                <Glyph name="chevronDown" tint={color.textSubtle} />
              </Pressable>
            </FormField>

            <FormField
              label="Company size"
              constraint="people on the payroll"
              error={errors.companySize}
              blockRef={blockRef('companySize')}
            >
              <View accessibilityRole="radiogroup" accessibilityLabel="Company size" style={styles.chips}>
                {COMPANY_SIZES.map((size) => (
                  <Chip
                    key={size}
                    label={COMPANY_SIZE_LABEL[size]}
                    selected={form.companySize === size}
                    onPress={sending ? undefined : () => change('companySize', { companySize: size })}
                  />
                ))}
              </View>
            </FormField>

            <FormField label="Website" constraint="optional" error={errors.website} blockRef={blockRef('website')}>
              <Input
                inputRef={inputRef('website')}
                value={form.website}
                onChangeText={(v) => change('website', { website: v })}
                onBlur={() => {
                  const website = normaliseWebsite(form.website)
                  if (website !== form.website) setForm((f) => ({ ...f, website }))
                }}
                placeholder="https://"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="url"
                textContentType="URL"
                returnKeyType="next"
                onSubmitEditing={next('officeLocation')}
                submitBehavior="submit"
                accessibilityLabel="Website, optional"
                invalid={!!errors.website}
                editable={!sending}
              />
            </FormField>

            <FormField label="Office location" error={errors.officeLocation} blockRef={blockRef('officeLocation')}>
              <Input
                inputRef={inputRef('officeLocation')}
                value={form.officeLocation}
                onChangeText={(v) => change('officeLocation', { officeLocation: v })}
                placeholder="City"
                autoCapitalize="words"
                textContentType="addressCity"
                returnKeyType="next"
                onSubmitEditing={next('name')}
                submitBehavior="submit"
                accessibilityLabel="Office location"
                invalid={!!errors.officeLocation}
                editable={!sending}
              />
            </FormField>
          </View>

          )}

          {/* ── The person ───────────────────────────────────────────── */}
          {step === 2 && (
          <View style={styles.block}>

            <FormField label="Your name" error={errors.name} blockRef={blockRef('name')}>
              <Input
                inputRef={inputRef('name')}
                value={form.name}
                onChangeText={(v) => change('name', { name: v })}
                placeholder="Full name"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={next('designation')}
                submitBehavior="submit"
                accessibilityLabel="Your name"
                invalid={!!errors.name}
                editable={!sending}
              />
            </FormField>

            <FormField label="Designation" error={errors.designation} blockRef={blockRef('designation')}>
              <Input
                inputRef={inputRef('designation')}
                value={form.designation}
                onChangeText={(v) => change('designation', { designation: v })}
                placeholder="e.g. Founder, HR Manager"
                autoCapitalize="words"
                textContentType="jobTitle"
                returnKeyType="next"
                onSubmitEditing={next('email')}
                submitBehavior="submit"
                accessibilityLabel="Designation"
                invalid={!!errors.designation}
                editable={!sending}
              />
            </FormField>

            {/* The board sets the work email's error at the sentence step, not the fine print. */}
            <FormField
              label="Work email"
              helper="An address on your company’s domain. A reviewer checks it against your website."
              error={errors.email}
              strongError
              action={signIn === 'email' ? signInAction : undefined}
              blockRef={blockRef('email')}
            >
              <Input
                inputRef={inputRef('email')}
                value={form.email}
                onChangeText={(v) => change('email', { email: v })}
                onBlur={() => {
                  const refusal = form.email.trim() ? webmailRefusal(form.email, form.website) : null
                  if (refusal) setErrors((e) => ({ ...e, email: refusal }))
                }}
                placeholder="you@yourcompany.in"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={next('mobile')}
                submitBehavior="submit"
                accessibilityLabel="Work email"
                invalid={!!errors.email}
                editable={!sending}
              />
            </FormField>

            <FormField
              label="Mobile"
              helper="We send a code by SMS."
              error={errors.mobile}
              strongError={signIn === 'mobile'}
              action={signIn === 'mobile' ? signInAction : undefined}
              blockRef={blockRef('mobile')}
            >
              <AffixInput
                inputRef={inputRef('mobile')}
                prefix="+91"
                value={form.mobile}
                onChangeText={(v) => change('mobile', { mobile: mobileDigits(v) })}
                placeholder="10-digit number"
                keyboardType="number-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessibilityLabel="Mobile, 10 digits"
                invalid={!!errors.mobile}
                editable={!sending}
              />
            </FormField>

            <FormField
              label="Password"
              constraint="at least 10 characters"
              error={errors.password}
              blockRef={blockRef('password')}
            >
              <PasswordInput
                inputRef={inputRef('password')}
                shown={passwordShown}
                onToggle={() => setPasswordShown((s) => !s)}
                value={form.password}
                onChangeText={(v) => change('password', { password: v })}
                placeholder="Choose a password"
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={submit}
                accessibilityLabel="Password, at least 10 characters"
                invalid={!!errors.password}
                editable={!sending}
              />
            </FormField>
          </View>

          )}

          {!!failure && <Banner tone="danger">{failure}</Banner>}
          {step === 2 && (
            <Body size="xs" tone="muted">
              Next, we send a 6-digit code to your work email and another to your mobile.
            </Body>
          )}
        </View>
      </ScrollView>

      <EmFoot>
        {step === 1 ? (
          <>
            <EmMono>1 OF 2</EmMono>
            <View style={styles.grow} />
            <Button variant="secondary" size="lg" label="Next" onPress={goNext} style={styles.next} />
          </>
        ) : (
          <View style={styles.grow}>
            <Button
              variant="primary"
              size="lg"
              full
              busy={sending}
              label={sending ? 'Sending your codes…' : 'Create account'}
              onPress={submit}
            />
          </View>
        )}
      </EmFoot>

      <Sheet open={industryOpen} onClose={() => setIndustryOpen(false)} title="Industry">
        {industries.length ? (
          <ScrollView
            accessibilityRole="radiogroup"
            accessibilityLabel="Industry"
            style={{ maxHeight: viewport.height / 2 }}
          >
            {industries.map((industry) => {
              const on = industry.name === form.industry
              return (
                <Pressable
                  key={industry.slug}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    change('industry', { industry: industry.name })
                    setIndustryOpen(false)
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <Body weight={on ? 'semibold' : 'regular'} style={styles.grow}>
                    {industry.name}
                  </Body>
                  {on && <Glyph name="check" tint={color.text} />}
                </Pressable>
              )
            })}
          </ScrollView>
        ) : config.isError || (config.isSuccess && !config.isFetching) ? (
          <ErrorState
            title="The list of industries didn’t load."
            body="Check your connection, then try again."
            action={
              <Button variant="outline" size="sm" label="Try again" busy={config.isFetching} onPress={() => config.refetch()} />
            }
          />
        ) : (
          <Skeleton lines={6} block={false} />
        )}
      </Sheet>
    </KeyboardAvoidingView>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/**
 * The library Field, with the two things the board adds: a grey constraint on
 * the label row (said before the typing starts), and an error that steps up to
 * a sentence when it is the work email's or when it carries a Sign in action.
 * The error replaces the helper, never joins it.
 */
function FormField({
  label, constraint, helper, error, strongError = false, action, blockRef, children,
}: {
  label: string
  constraint?: string
  helper?: string
  error?: string
  strongError?: boolean
  action?: React.ReactNode
  blockRef?: React.Ref<ViewRef>
  children: React.ReactNode
}) {
  return (
    <View ref={blockRef} collapsable={false} style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={text.uiSmSemi}>{label}</Text>
        {!!constraint && (
          <Body size="xs" tone="subtle" style={styles.shrink}>
            {constraint}
          </Body>
        )}
      </View>
      {children}
      {error ? (
        <View>
          <Body size={strongError ? 'sm' : 'xs'} tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Body>
          {action}
        </View>
      ) : helper ? (
        <Body size="xs" tone="subtle">
          {helper}
        </Body>
      ) : null}
    </View>
  )
}

/**
 * The 52 input shell with something fixed inside it — the +91 before a mobile,
 * the Show action after a password. The library Input is the bare field; this
 * carries the same four states on the shell so the affix sits inside the edge.
 */
function AffixInput({
  prefix, trailing, invalid = false, inputRef, onFocus, onBlur, editable, ...rest
}: {
  prefix?: string
  trailing?: React.ReactNode
  invalid?: boolean
  inputRef?: React.Ref<TextInputRef>
} & Omit<TextInputProps, 'style'>) {
  const [focused, setFocused] = useState(false)
  return (
    <View
      style={[
        styles.box,
        invalid ? styles.boxInvalid : editable === false ? styles.boxOff : focused ? styles.boxFocus : styles.boxIdle,
      ]}
    >
      {!!prefix && (
        <Text style={[text.uiBase, styles.prefix]} accessibilityElementsHidden importantForAccessibility="no">
          {prefix}
        </Text>
      )}
      <TextInput
        ref={inputRef}
        placeholderTextColor={color.textSubtle}
        style={[text.uiBase, styles.affixText]}
        editable={editable}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      {trailing}
    </View>
  )
}

/**
 * The password field on EM-02 and on employer sign-in: the 52 shell with a Show
 * action in its trailing slot. Muted and not underlined, as the board draws it
 * — it changes what the field shows, it goes nowhere.
 */
export function PasswordInput({
  shown, onToggle, ...rest
}: {
  shown: boolean
  onToggle: () => void
  invalid?: boolean
  inputRef?: React.Ref<TextInputRef>
} & Omit<TextInputProps, 'style' | 'secureTextEntry'>) {
  return (
    <AffixInput
      {...rest}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <TextAction
          label={shown ? 'Hide' : 'Show'}
          tone="muted"
          underline={false}
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: shown }}
          onPress={onToggle}
          style={styles.trailingAction}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: opacity.pressed },

  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  brand: { minHeight: height.tap, justifyContent: 'center' },
  barAction: { marginRight: -space.sm },

  body: { paddingHorizontal: space.lg, paddingTop: space.xs },
  content: { gap: spaceHalf['4.5'] },
  next: { paddingHorizontal: space['2xl'] },
  title: { gap: space.sm },

  block: { gap: space.xl },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: borderWidth.thin, backgroundColor: color.border },
  personHead: { gap: space.xs },

  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  inlineAction: { alignSelf: 'flex-start' },

  box: {
    height: height.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    paddingHorizontal: space.lg,
  },
  boxIdle: { borderColor: color.borderStrong, backgroundColor: color.surface },
  boxFocus: { borderColor: color.ink, backgroundColor: color.surface },
  boxInvalid: { borderColor: color.danger, backgroundColor: color.dangerSoft },
  boxOff: { borderColor: color.border, backgroundColor: color.surfaceMuted },
  placeholder: { color: color.textSubtle },
  prefix: { color: color.textSubtle },
  affixText: { flex: 1, height: '100%', paddingVertical: 0, paddingHorizontal: 0 },
  trailingAction: { marginRight: -space.md },

  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },

  actions: { gap: space.sm },

  option: {
    minHeight: height.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
})
