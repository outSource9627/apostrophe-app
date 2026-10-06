import React, { useState } from 'react'
import { Keyboard, StyleSheet, Text, View } from 'react-native'
import { Banner } from '../components/ui/Banner'
import { Skeleton } from '../components/ui'
import {
  AButton, AField, AInput, APassword, APhone, ASelect, ATiles, BrandScreen, Fine, Link, Section, StrengthMeter, Swap,
  TermsCheck, strengthHelper, useFieldFocus,
} from '../components/auth/kit'
import { readSendRefusal, tierFigures, useAuthConfig } from '../components/auth/config'
import { api } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { label } from '../lib/profile/labels'
import { fontSize, space } from '../theme'

export interface RegistrationData {
  name: string
  mobile: string
  email: string
  city: string
  qualification: string
  /** Lets this account also sign in by email. Sent to /auth/register with the OTP. */
  password: string
}

interface Props {
  onBack: () => void
  onSignIn: () => void
  /** Interviewers have no self-signup; this opens the HR application. */
  onJoinUs: () => void
  onOtpSent: (data: { form: RegistrationData; resendAfterSeconds: number }) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** contracts/auth.ts registerMobileInput — `password: z.string().min(8)`. */
const MIN_PASSWORD = 8

/**
 * The values /auth/register accepts (the server's QUALIFICATIONS enum), for
 * when /config has not answered. When it has, its own list is the one shown.
 * No prices or lengths here: a tile shows those only once /config sends them.
 */
const QUALIFICATION_VALUES = ['CLASS_12', 'GRADUATION', 'POST_GRADUATION', 'PHD']

type Key = 'name' | 'mobile' | 'email' | 'city' | 'qualification' | 'password' | 'confirm' | 'terms'
const ORDER: Key[] = ['name', 'mobile', 'email', 'city', 'qualification', 'password', 'confirm', 'terms']

/**
 * ST-01 · Create account, drawn as direction C (docs/registration-mockups.html
 * ?dir=C&flow=student): About you, Your interview, Secure your account.
 *
 * Email is required: the account gets a password here, and the server only
 * accepts a password with an email ("An email is required to set a password").
 * The cities, the qualification list and each tier's price and length are the
 * admin's, from /config. Continue checks everything, lands on the first field
 * that needs an answer, then sends the code and opens VerifyMobile.
 */
export function CreateAccountScreen({ onBack, onSignIn, onJoinUs, onOtpSent }: Props) {
  const ff = useFieldFocus<Key>()
  const config = useAuthConfig()
  const cfg = config.data

  const [form, setForm] = useState<RegistrationData>({
    name: '', mobile: '', email: '', city: '', qualification: '', password: '',
  })
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [mobileTaken, setMobileTaken] = useState(false)
  const [pending, setPending] = useState(false)

  const cities = cfg?.masterData?.cities ?? []
  // The list did not come, or came empty: the city is typed instead.
  const cityAsText = config.isError || (config.isSuccess && cities.length === 0)
  const qualificationValues = cfg?.qualifications?.length ? cfg.qualifications.map((q) => q.value) : QUALIFICATION_VALUES
  const tiles = qualificationValues.map((value) => {
    const { price, minutes } = tierFigures(cfg, value)
    const sub = [price, minutes ? `${minutes} min` : null].filter(Boolean).join(' · ')
    return { value, title: label(value), sub: sub || undefined }
  })

  const clear = (k: Key) => {
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
    setFailure(null)
  }
  const set = (k: keyof RegistrationData) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    clear(k)
    if (k === 'mobile') setMobileTaken(false)
  }

  function validate(): Partial<Record<Key, string>> {
    const e: Partial<Record<Key, string>> = {}
    if (form.name.trim().length < 2) e.name = 'Enter your full name'
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile number'
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (form.city.trim().length < 2) e.city = cityAsText ? 'Enter your city' : 'Choose your city'
    if (!form.qualification) e.qualification = 'Select your highest qualification'
    if (form.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters`
    if (!confirm || confirm !== form.password) e.confirm = 'Passwords don’t match'
    if (!terms) e.terms = 'Agree to continue'
    return e
  }

  async function handleContinue() {
    if (pending) return
    const found = validate()
    setErrors(found)
    const first = ORDER.find((k) => found[k])
    if (first) {
      requestAnimationFrame(() => ff.to(first))
      return
    }
    Keyboard.dismiss()
    setPending(true)
    setFailure(null)
    setMobileTaken(false)
    const registration = { ...form, email: form.email.trim().toLowerCase(), city: form.city.trim() }
    const cooldown = cfg?.auth?.otpResendCooldownSeconds ?? 0
    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile: form.mobile, purpose: 'REGISTER' },
        { anonymous: true },
      )
      onOtpSent({ form: registration, resendAfterSeconds: res.resendAfterSeconds ?? cooldown })
    } catch (err) {
      const refusal = readSendRefusal(err, cooldown)
      if (refusal?.kind === 'cooldown') {
        // A code went to this number moments ago and is still live: the code screen opens on the wait.
        onOtpSent({ form: registration, resendAfterSeconds: refusal.seconds })
      } else if (refusal?.kind === 'hourly') {
        setFailure(refusal.message)
        requestAnimationFrame(() => ff.toEnd())
      } else if (err instanceof ApiClientError) {
        const m = err.message.toLowerCase()
        if (err.status === 409 || m.includes('already exists') || m.includes('already registered')) {
          setMobileTaken(true)
          setErrors({ mobile: 'This mobile number is already registered.' })
          requestAnimationFrame(() => ff.to('mobile'))
        } else {
          setFailure(err.message)
          requestAnimationFrame(() => ff.toEnd())
        }
      } else {
        setFailure('Could not send the verification code.')
        requestAnimationFrame(() => ff.toEnd())
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <BrandScreen
      title="Create your account"
      sub="Join Apostrophe in a minute."
      onBack={onBack}
      scrollRef={ff.scroller}
      contentRef={ff.content}
      footer={
        <>
          <AButton label={pending ? 'Sending verification code…' : 'Continue'} busy={pending} onPress={handleContinue} />
          <Swap lead="Already have an account?" action="Log in" onPress={onSignIn} />
        </>
      }
    >
      <Section title="About you" first>
        <AField label="Full name" error={errors.name} anchorRef={ff.anchor('name')}>
          <AInput
            icon="user"
            inputRef={ff.input('name')}
            value={form.name}
            onChangeText={set('name')}
            placeholder="As on your ID"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => ff.focusInput('mobile')}
            submitBehavior="submit"
            invalid={!!errors.name}
            editable={!pending}
          />
        </AField>

        <AField label="Mobile number" error={errors.mobile} anchorRef={ff.anchor('mobile')}>
          <APhone
            inputRef={ff.input('mobile')}
            value={form.mobile}
            onChangeText={(v) => set('mobile')(v.replace(/\D/g, ''))}
            invalid={!!errors.mobile}
            editable={!pending}
          />
          {mobileTaken && (
            <Text style={styles.signInLine}>
              <Link onPress={onSignIn}>Log in instead</Link>
            </Text>
          )}
        </AField>

        <AField
          label="Email"
          helper="We’ll email a verification link. It won’t hold you up."
          error={errors.email}
          anchorRef={ff.anchor('email')}
        >
          <AInput
            icon="mail"
            inputRef={ff.input('email')}
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
            invalid={!!errors.email}
            editable={!pending}
          />
        </AField>
      </Section>

      <Section title="Your interview">
        <AField label="City" error={errors.city} anchorRef={ff.anchor('city')}>
          {cityAsText ? (
            <AInput
              icon="pin"
              inputRef={ff.input('city')}
              value={form.city}
              onChangeText={set('city')}
              placeholder="Your city"
              autoCapitalize="words"
              textContentType="addressCity"
              maxLength={60}
              invalid={!!errors.city}
              editable={!pending}
            />
          ) : (
            <ASelect
              icon="pin"
              title="City"
              placeholder="Select your city"
              value={form.city}
              options={cities.map((c) => ({ value: c.name, label: c.name }))}
              invalid={!!errors.city}
              onChange={set('city')}
              onOpen={() => {
                Keyboard.dismiss()
                if (!cities.length && !config.isFetching) config.refetch()
              }}
              empty={<Skeleton lines={6} block={false} />}
            />
          )}
        </AField>

        <AField
          label="Highest qualification"
          helper="This sets your interview length and what it costs. You pay only when you book."
          error={errors.qualification}
          anchorRef={ff.anchor('qualification')}
        >
          <ATiles
            options={tiles}
            value={form.qualification}
            onChange={set('qualification')}
            invalid={!!errors.qualification}
          />
        </AField>
      </Section>

      <Section title="Secure your account">
        <AField
          label="Password"
          helper={strengthHelper(form.password, MIN_PASSWORD)}
          error={errors.password}
          anchorRef={ff.anchor('password')}
        >
          <APassword
            icon="lock"
            inputRef={ff.input('password')}
            value={form.password}
            onChangeText={set('password')}
            shown={shown}
            onToggle={() => setShown((v) => !v)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => ff.focusInput('confirm')}
            submitBehavior="submit"
            invalid={!!errors.password}
            editable={!pending}
          />
          <StrengthMeter value={form.password} min={MIN_PASSWORD} />
        </AField>

        <AField label="Confirm password" error={errors.confirm} anchorRef={ff.anchor('confirm')}>
          <APassword
            icon="lock"
            inputRef={ff.input('confirm')}
            value={confirm}
            onChangeText={(v) => { setConfirm(v); clear('confirm') }}
            shown={shown}
            onToggle={() => setShown((v) => !v)}
            placeholder="Re-enter password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            invalid={!!errors.confirm}
            editable={!pending}
          />
        </AField>

        <TermsCheck
          on={terms}
          error={errors.terms}
          anchorRef={ff.anchor('terms')}
          onToggle={() => { setTerms((v) => !v); clear('terms') }}
        />
      </Section>

      {!!failure && (
        <View style={styles.banner}>
          <Banner tone="danger">{failure}</Banner>
        </View>
      )}

      <Fine>
        Want to interview talent? <Link onPress={onJoinUs}>Join us as HR</Link>
      </Fine>
    </BrandScreen>
  )
}

const styles = StyleSheet.create({
  banner: { marginTop: space.lg },
  signInLine: { fontSize: fontSize['ui-md'] },
})
