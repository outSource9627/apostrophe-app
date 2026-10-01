import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Banner } from '../components/ui/Banner'
import {
  A, AButton, AField, AInput, APassword, APhone, ASelect, AuthSub, AuthTitle, AuthTop, BottomBar, CheckRow, Fine,
  Group, GoogleBtn, Link, OrRow, PriceBox, StrengthMeter, Swap, useFieldScroll,
} from '../components/auth/kit'
import { api } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color } from '../theme'

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
const MIN_PASSWORD = 8

/** Fallbacks only — the real fees come from /config (admin master data). */
const QUALIFICATIONS = [
  { value: 'CLASS_12', label: '12th pass', price: '₹99', duration: '20 min' },
  { value: 'GRADUATION', label: 'Graduation', price: '₹199', duration: '20 min' },
  { value: 'POST_GRADUATION', label: 'Post Graduation', price: '₹299', duration: '30 min' },
  { value: 'PHD', label: 'PhD', price: '₹399', duration: '30 min' },
]

type Key = 'name' | 'mobile' | 'email' | 'city' | 'qualification' | 'password' | 'confirm' | 'terms'
const ORDER: Key[] = ['name', 'mobile', 'email', 'city', 'qualification', 'password', 'confirm', 'terms']

export function CreateAccountScreen({ onBack, onSignIn, onJoinUs, onOtpSent }: Props) {
  const insets = useSafeAreaInsets()
  const scroll = useFieldScroll()

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
  const [prices, setPrices] = useState(QUALIFICATIONS)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await api.get<{
          tiers?: { tier: string; amountPaise: number; durationMin: number }[]
          qualifications?: { value: string; tier: string }[]
        }>('/config', { anonymous: true })
        if (res?.tiers && res?.qualifications) {
          setPrices(
            QUALIFICATIONS.map((q) => {
              const tierName = res.qualifications?.find((x) => x.value === q.value)?.tier
              const t = res.tiers?.find((x) => x.tier === tierName)
              return t
                ? { ...q, price: `₹${(t.amountPaise / 100).toLocaleString('en-IN')}`, duration: `${t.durationMin} min` }
                : q
            }),
          )
        }
      } catch {
        // Fallback to the defaults above.
      }
    }
    loadConfig()
  }, [])

  const chosen = prices.find((p) => p.value === form.qualification)

  const set = (k: keyof RegistrationData) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
    setFailure(null)
    if (k === 'mobile') setMobileTaken(false)
  }

  function validate(): Partial<Record<Key, string>> {
    const e: Partial<Record<Key, string>> = {}
    if (form.name.trim().length < 2) e.name = 'Enter your full name'
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile number'
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (form.city.trim().length < 2) e.city = 'Enter your city'
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
      scroll.to(first)
      return
    }
    setPending(true)
    setFailure(null)
    setMobileTaken(false)
    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile: form.mobile, purpose: 'REGISTER' },
        { anonymous: true },
      )
      onOtpSent({
        form: { ...form, email: form.email.trim().toLowerCase() },
        resendAfterSeconds: res.resendAfterSeconds ?? 30,
      })
    } catch (err) {
      if (err instanceof ApiClientError) {
        const m = err.message.toLowerCase()
        if (err.status === 409 || m.includes('already exists') || m.includes('already registered')) {
          setMobileTaken(true)
          setErrors({ mobile: 'This mobile number is already registered.' })
          scroll.to('mobile')
        } else {
          setFailure(err.message)
        }
      } else {
        setFailure('Could not send verification code.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthTop onBack={onBack} />

      <ScrollView ref={scroll.scroller} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.gap} />
        <AuthTitle>Create your account</AuthTitle>
        <AuthSub>Join Apostrophe in a minute.</AuthSub>

        <Group>About you</Group>
        <AField label="Full name" error={errors.name} onLayoutY={scroll.at('name')}>
          <AInput
            value={form.name}
            onChangeText={set('name')}
            placeholder="As on your ID"
            autoCapitalize="words"
            autoComplete="name"
            invalid={!!errors.name}
            editable={!pending}
          />
        </AField>

        <AField
          label="Mobile number"
          error={errors.mobile}
          onLayoutY={scroll.at('mobile')}
        >
          <APhone
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
          onLayoutY={scroll.at('email')}
        >
          <AInput
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            placeholder="you@example.com"
            invalid={!!errors.email}
            editable={!pending}
          />
        </AField>

        <AField label="City" error={errors.city} onLayoutY={scroll.at('city')}>
          <AInput
            value={form.city}
            onChangeText={set('city')}
            placeholder="e.g. Pune"
            autoCapitalize="words"
            invalid={!!errors.city}
            editable={!pending}
          />
        </AField>

        <AField label="Highest qualification" error={errors.qualification} onLayoutY={scroll.at('qualification')}>
          <ASelect
            title="Highest qualification"
            placeholder="Select qualification"
            value={form.qualification}
            options={prices.map((p) => ({ value: p.value, label: p.label, hint: p.price }))}
            invalid={!!errors.qualification}
            onChange={set('qualification')}
          />
        </AField>
        {chosen && <PriceBox label="Interview fee for this level" value={`${chosen.price} · ${chosen.duration}`} />}

        <Group>Secure your account</Group>
        <AField label="Password" error={errors.password} onLayoutY={scroll.at('password')}>
          <APassword
            value={form.password}
            onChangeText={set('password')}
            shown={shown}
            onToggle={() => setShown((v) => !v)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            textContentType="newPassword"
            invalid={!!errors.password}
            editable={!pending}
          />
          <StrengthMeter value={form.password} />
        </AField>

        <AField label="Confirm password" error={errors.confirm} onLayoutY={scroll.at('confirm')}>
          <APassword
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })) }}
            shown={shown}
            onToggle={() => setShown((v) => !v)}
            placeholder="Re-enter password"
            textContentType="newPassword"
            invalid={!!errors.confirm}
            editable={!pending}
          />
        </AField>

        <View onLayout={(e) => scroll.at('terms')(e.nativeEvent.layout.y)}>
          <CheckRow
            on={terms}
            invalid={!!errors.terms}
            onToggle={() => { setTerms((v) => !v); setErrors((e) => ({ ...e, terms: undefined })) }}
          >
            I agree to the <Link>Terms of Service</Link> and <Link>Privacy Policy</Link>
          </CheckRow>
          {!!errors.terms && <Text style={styles.termsError}>{errors.terms}</Text>}
        </View>

        {!!failure && (
          <View style={styles.banner}>
            <Banner tone="danger">{failure}</Banner>
          </View>
        )}

        <OrRow />
        <GoogleBtn label="Sign up with Google" />

        <Fine>
          Want to interview talent? <Link onPress={onJoinUs}>Join us as HR</Link>
        </Fine>
      </ScrollView>

      <BottomBar insetBottom={insets.bottom + 14}>
        <AButton label={pending ? 'Sending verification code…' : 'Continue'} busy={pending} onPress={handleContinue} />
        <Swap lead="Already have an account?" action="Log in" onPress={onSignIn} />
      </BottomBar>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: A.gutter, paddingBottom: 24 },
  gap: { height: 12 },
  banner: { marginTop: 16 },
  signInLine: { marginTop: 6, fontSize: 14 },
  termsError: { color: A.danger, fontSize: 13, marginTop: 6 },
})
