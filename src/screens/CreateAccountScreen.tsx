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
import { Logo } from '../components/Logo'
import { Field, Input } from '../components/ui/fields'
import { Chip } from '../components/ui/controls'
import { Body, Display, Eyebrow } from '../components/ui/Type'
import { Button } from '../components/ui/Button'
import { GoogleButton } from '../components/ui/GoogleButton'
import { api } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import {
  borderWidth,
  color,
  fontSize,
  height,
  radius,
  space,
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── App bar (52px) ─────────────────────────────────────────────── */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <Logo size={20} />
        <Pressable onPress={onSignIn} hitSlop={12} style={styles.appBarAction}>
          <Body size="sm" tone="muted">Sign in</Body>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.header}>
          <Eyebrow>CREATE YOUR ACCOUNT</Eyebrow>
          <Display level="lg">
            Five things, and <Text style={styles.headlineMuted}>we’re off.</Text>
          </Display>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* 1 · Full name */}
          <Field label="Full name">
            <Input
              value={form.name}
              onChangeText={setField('name')}
              placeholder="Your name"
              autoCapitalize="words"
              editable={!pending}
            />
          </Field>

          {/* 2 · Mobile */}
          <View style={styles.fieldBlock}>
            <Eyebrow>Mobile</Eyebrow>
            <View
              style={[
                styles.mobileControl,
                isMobileRegistered && styles.controlInvalid,
              ]}
            >
              <Body size="base" tone="subtle">+91</Body>
              <View style={styles.mobileDivider} />
              <Input
                value={form.mobile}
                onChangeText={(v) => setField('mobile')(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder="98765 43210"
                editable={!pending}
                style={styles.mobileInput}
              />
            </View>
            {isMobileRegistered && (
              <Body size="xs" tone="danger">
                This mobile number is already registered.{' '}
                <Body size="xs" weight="semibold" tone="danger" style={styles.link} onPress={onSignIn}>
                  Sign in
                </Body>
              </Body>
            )}
          </View>

          {/* 3 · Email */}
          <Field
            label="Email"
            helper="We’ll email a verification link. It won’t hold you up."
          >
            <Input
              value={form.email}
              onChangeText={setField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              editable={!pending}
            />
          </Field>

          {/* 4 · City */}
          <Field label="City">
            <Input
              value={form.city}
              onChangeText={setField('city')}
              placeholder="Select your city"
              editable={!pending}
            />
          </Field>

          {/* 5 · Highest qualification */}
          <View style={styles.fieldBlock}>
            <View style={styles.qualHeader}>
              <Eyebrow>Highest qualification</Eyebrow>
              <Display level="md">
                {selectedTier.price}
                <Text style={styles.qualDuration}> / {selectedTier.duration}</Text>
              </Display>
            </View>

            <View style={styles.chips}>
              {prices.map((q) => (
                <Chip
                  key={q.value}
                  label={q.label}
                  selected={form.qualification === q.value}
                  onPress={() => {
                    if (pending) return
                    setField('qualification')(q.value)
                  }}
                />
              ))}
            </View>
            <Body size="xs" tone="subtle">
              This sets your interview length and what it costs.
            </Body>
          </View>

          {!!error && !isMobileRegistered && (
            <Body size="sm" tone="danger">{error}</Body>
          )}

          {/* ── Actions (Lower third) ────────────────────────────────────────── */}
          <View style={styles.actions}>
            <Button
              label={pending ? 'Sending verification code…' : 'Send verification code'}
              variant="primary"
              size="lg"
              full
              disabled={
                pending ||
                form.mobile.length !== 10 ||
                !form.name.trim() ||
                !form.city.trim()
              }
              busy={pending}
              onPress={handleSendCode}
            />

            <GoogleButton disabled={pending} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
  },
  appBar: {
    height: height['app-bar'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
  },
  appBarAction: {
    height: height.tap,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    marginRight: -space.md,
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  header: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  headlineMuted: {
    color: color.textMuted,
    fontStyle: 'italic',
  },
  form: {
    gap: space.md,
  },
  fieldBlock: {
    gap: space.sm,
  },
  mobileControl: {
    flexDirection: 'row',
    alignItems: 'center',
    height: height.control,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  controlInvalid: {
    borderColor: color.danger,
    backgroundColor: color.dangerSoft,
  },
  mobileDivider: {
    width: borderWidth.thin,
    height: space.xl,
    backgroundColor: color.border,
  },
  mobileInput: {
    flex: 1,
    height: height.control,
    borderWidth: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  qualHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  qualDuration: {
    fontSize: fontSize['display-sm'],
    color: color.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  link: {
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: space.xl,
    gap: space.md,
  },
})
