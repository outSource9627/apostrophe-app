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
import { Button } from '../components/ui/Button'
import { GoogleButton } from '../components/ui/GoogleButton'
import { api } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import {
  borderWidth,
  color,
  fontFamilyNative,
  fontSize,
  fontWeight,
  height,
  leadingNative,
  radius,
  space,
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── App bar (52px) ─────────────────────────────────────────────── */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <Logo size={20} />
        <Pressable onPress={onSignIn} hitSlop={12}>
          <Text style={styles.appBarAction}>Sign in</Text>
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
          <Text style={styles.eyebrow}>CREATE YOUR ACCOUNT</Text>
          <Text style={styles.headline}>
            Five things, and <Text style={styles.headlineMuted}>we’re off.</Text>
          </Text>
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
            <Text style={styles.label}>MOBILE</Text>
            <View
              style={[
                styles.mobileControl,
                isMobileRegistered && styles.controlInvalid,
              ]}
            >
              <Text style={styles.mobilePrefix}>+91</Text>
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
              <Text style={styles.errorText}>
                This mobile number is already registered.{' '}
                <Text style={styles.link} onPress={onSignIn}>
                  Sign in
                </Text>
              </Text>
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

          {/* 5 · Highest qualification · 2x2 grid */}
          <View style={styles.fieldBlock}>
            <View style={styles.qualHeader}>
              <Text style={styles.label}>HIGHEST QUALIFICATION</Text>
              <Text style={styles.qualPrice}>
                {selectedTier.price}
                <Text style={styles.qualDuration}> / {selectedTier.duration}</Text>
              </Text>
            </View>

            <View style={styles.qualGrid}>
              {prices.map((q) => {
                const isSelected = form.qualification === q.value
                return (
                  <Pressable
                    key={q.value}
                    onPress={() => setField('qualification')(q.value)}
                    disabled={pending}
                    style={[
                      styles.qualChip,
                      isSelected ? styles.qualChipSelected : styles.qualChipIdle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.qualChipLabel,
                        isSelected && styles.qualChipLabelSelected,
                      ]}
                    >
                      {q.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Text style={styles.helperText}>
              This sets your interview length and what it costs.
            </Text>
          </View>

          {!!error && !isMobileRegistered && (
            <Text style={styles.generalError}>{error}</Text>
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
    fontSize: fontSize['ui-sm'],
    color: color.textMuted,
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  header: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  eyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-lg'],
    lineHeight: leadingNative['display-lg'],
    color: color.text,
    letterSpacing: trackingNative['tight-sm'],
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
  label: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
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
  mobilePrefix: {
    fontSize: fontSize['ui-base'],
    color: color.textSubtle,
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
  qualPrice: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-md'],
    color: color.text,
    letterSpacing: trackingNative['tight-sm'],
  },
  qualDuration: {
    fontSize: fontSize['display-sm'],
    color: color.textMuted,
  },
  qualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  qualChip: {
    width: '48.5%',
    height: height['control-block'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualChipIdle: {
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  qualChipSelected: {
    borderWidth: borderWidth.thin,
    borderColor: color.ink,
    backgroundColor: color.surface,
  },
  qualChipLabel: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-xs'],
    color: color.textMuted,
  },
  qualChipLabelSelected: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  helperText: {
    fontSize: fontSize['ui-xs'],
    color: color.textSubtle,
    lineHeight: leadingNative['ui-xs'],
  },
  errorText: {
    fontSize: fontSize['ui-xs'],
    color: color.danger,
    lineHeight: leadingNative['ui-xs'],
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: fontWeight.semibold,
    color: color.danger,
  },
  generalError: {
    fontSize: fontSize['ui-sm'],
    color: color.danger,
  },
  actions: {
    marginTop: space.xl,
    gap: space.md,
  },
})
