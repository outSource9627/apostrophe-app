import React, { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, Input } from '../components/ui/fields'
import { Body } from '../components/ui/Type'
import { Button } from '../components/ui/Button'
import { GoogleButton } from '../components/ui/GoogleButton'
import { BrandMark, OptionTile, PhoneInput, text } from '../components/ui'
import { api } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import {
  borderWidth,
  color,
  height,
  space,
  spaceHalf,
  trackingNative,
} from '../theme'

export interface RegistrationData {
  name: string
  mobile: string
  email: string
  city: string
  qualification: string
}

interface Props {
  onSignIn: () => void
  onOtpSent: (data: { form: RegistrationData; resendAfterSeconds: number }) => void
}

const QUALIFICATIONS = [
  { value: 'CLASS_12', label: 'Class 12', price: '₹99', duration: '20 min' },
  { value: 'GRADUATION', label: 'Graduation', price: '₹199', duration: '20 min' },
  { value: 'POST_GRADUATION', label: 'Post Graduation', price: '₹299', duration: '30 min' },
  { value: 'PHD', label: 'PhD', price: '₹399', duration: '30 min' },
]

export function CreateAccountScreen({ onSignIn, onOtpSent }: Props) {
  const insets = useSafeAreaInsets()

  const [form, setForm] = useState<RegistrationData>({
    name: '',
    mobile: '',
    email: '',
    city: '',
    qualification: 'GRADUATION',
  })
  const [error, setError] = useState<string | null>(null)
  const [isMobileRegistered, setIsMobileRegistered] = useState(false)
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
          const updated = QUALIFICATIONS.map((q) => {
            const tierName = res.qualifications?.find((x) => x.value === q.value)?.tier
            const tierData = res.tiers?.find((t) => t.tier === tierName)
            if (tierData) {
              return {
                ...q,
                price: `₹${(tierData.amountPaise / 100).toLocaleString('en-IN')}`,
                duration: `${tierData.durationMin} min`,
              }
            }
            return q
          })
          setPrices(updated)
        }
      } catch {
        // Fallback to defaults
      }
    }
    loadConfig()
  }, [])

  const selectedTier = prices.find((p) => p.value === form.qualification) ?? prices[1]

  const setField = (k: keyof RegistrationData) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'mobile') setIsMobileRegistered(false)
    setError(null)
  }

  async function handleSendCode() {
    if (pending || form.mobile.length !== 10 || !form.name.trim() || !form.city.trim()) return
    setPending(true)
    setError(null)
    setIsMobileRegistered(false)

    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile: form.mobile, purpose: 'REGISTER' },
        { anonymous: true },
      )
      onOtpSent({
        form,
        resendAfterSeconds: res.resendAfterSeconds ?? 30,
      })
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (
          err.status === 409 ||
          err.message.toLowerCase().includes('already exists') ||
          err.message.toLowerCase().includes('already registered')
        ) {
          setIsMobileRegistered(true)
        } else {
          setError(err.message)
        }
      } else {
        setError('Could not send verification code.')
      }
    } finally {
      setPending(false)
    }
  }

  const canSend = !(
    pending ||
    form.mobile.length !== 10 ||
    !form.name.trim() ||
    !form.city.trim()
  )

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.appBar}>
        <BrandMark />
        <Pressable onPress={onSignIn} hitSlop={space.md} style={styles.appBarAction}>
          <Body size="md" weight="semibold" tone="accent">Sign in</Body>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[text.metaMd, styles.eyebrow]}>CREATE YOUR ACCOUNT</Text>
          <Text style={text.displayGreet}>
            Five things,{'\n'}and <Text style={styles.headlineAccent}>we’re off.</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <Field label="Full name">
            <Input
              value={form.name}
              onChangeText={setField('name')}
              placeholder="Your name"
              autoCapitalize="words"
              editable={!pending}
            />
          </Field>

          <Field label="Mobile">
            <PhoneInput
              value={form.mobile}
              onChangeText={setField('mobile')}
              editable={!pending}
              invalid={isMobileRegistered}
            />
            {isMobileRegistered && (
              <Body size="xs" tone="danger">
                This mobile number is already registered.{' '}
                <Body size="xs" weight="semibold" tone="danger" style={styles.link} onPress={onSignIn}>
                  Sign in
                </Body>
              </Body>
            )}
          </Field>

          <Field label="Email" helper="We’ll email a verification link. It won’t hold you up.">
            <Input
              value={form.email}
              onChangeText={setField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              editable={!pending}
            />
          </Field>

          <Field label="City">
            <Input
              value={form.city}
              onChangeText={setField('city')}
              placeholder="Select your city"
              editable={!pending}
            />
          </Field>

          <View style={styles.qual}>
            <View style={styles.qualHeader}>
              <Text style={text.uiSmSemi}>Highest qualification</Text>
              <Text style={text.displayXs}>
                {selectedTier.price}
                <Text style={[text.uiSm, styles.qualDuration]}> / {selectedTier.duration}</Text>
              </Text>
            </View>
            <View style={styles.grid}>
              {prices.map((q) => (
                <View key={q.value} style={styles.gridCell}>
                  <OptionTile
                    label={q.label}
                    selected={form.qualification === q.value}
                    disabled={pending}
                    onPress={() => setField('qualification')(q.value)}
                  />
                </View>
              ))}
            </View>
            <Body size="xs" tone="muted">This sets your interview length and what it costs.</Body>
          </View>

          {!!error && !isMobileRegistered && <Body size="sm" tone="danger">{error}</Body>}

          <GoogleButton disabled={pending} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: space.md + insets.bottom }]}>
        <Button
          label={pending ? 'Sending verification code…' : 'Continue · verify mobile'}
          variant="primary"
          size="lg"
          full
          disabled={!canSend}
          busy={pending}
          onPress={handleSendCode}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  appBar: {
    height: height['screen-header'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  appBarAction: { height: height.tap, justifyContent: 'center' },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['3.5'] },
  header: { gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  headlineAccent: { color: color.accent },
  form: { gap: spaceHalf['3.5'] },
  qual: { gap: spaceHalf['1.5'] },
  qualHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  qualDuration: { color: color.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridCell: { width: '48.5%' },
  link: { textDecorationLine: 'underline' },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: spaceHalf['3.5'],
    backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
})
