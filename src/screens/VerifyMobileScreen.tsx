import React, { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Banner,
  Body,
  Button,
  Eyebrow,
  OtpInput,
  ScreenHeader,
  text,
} from '../components/ui'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color, fontFamilyNative, radius, space, spaceHalf, trackingNative } from '../theme'
import type { RegistrationData } from './CreateAccountScreen'

interface Props {
  mobile: string
  purpose: 'REGISTER' | 'LOGIN'
  registrationData?: RegistrationData
  initialCooldown?: number
  onBack: () => void
  onVerified: () => void
  onSignIn?: () => void
}

export function VerifyMobileScreen({
  mobile,
  purpose,
  registrationData,
  initialCooldown = 30,
  onBack,
  onVerified,
  onSignIn,
}: Props) {
  const insets = useSafeAreaInsets()

  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(initialCooldown)
  const [codeExpirySeconds, setCodeExpirySeconds] = useState(600) // 10 min
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [sendsRemaining, setSendsRemaining] = useState(4)
  const [hourlyLimitHit, setHourlyLimitHit] = useState(false)
  const [isMobileRegistered, setIsMobileRegistered] = useState(false)
  const [nextCodeTime, setNextCodeTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const CODE_LENGTH = 6

  function formatMMSS(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((n) => (n <= 1 ? (clearInterval(timer), 0) : n - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Expiry countdown
  useEffect(() => {
    if (codeExpirySeconds <= 0) return
    const timer = setInterval(() => {
      setCodeExpirySeconds((n) => Math.max(0, n - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [codeExpirySeconds])

  async function handleResendCode() {
    if (cooldown > 0 || pending) return
    setPending(true)
    setError(null)

    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile, purpose },
        { anonymous: true },
      )
      setCooldown(res.resendAfterSeconds ?? 30)
      setCodeExpirySeconds(600)
      setSendsRemaining((prev) => Math.max(0, prev - 1))
      setAttemptsLeft(null)
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        setHourlyLimitHit(true)
        const retrySec = (err.details as { retryAfterSeconds?: number })?.retryAfterSeconds ?? 3600
        const resumeDate = new Date(Date.now() + retrySec * 1000)
        setNextCodeTime(
          resumeDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
        )
      } else {
        setError(err instanceof ApiClientError ? err.message : 'Could not resend code.')
      }
    } finally {
      setPending(false)
    }
  }

  async function handleVerify() {
    if (pending || code.length !== CODE_LENGTH) return
    setPending(true)
    setError(null)

    try {
      if (purpose === 'REGISTER' && registrationData) {
        const data = await api.post<{ accessToken: string; refreshToken: string }>(
          '/auth/register',
          { ...registrationData, mobile, code, role: 'STUDENT' },
          { anonymous: true },
        )
        await tokenStore.set(data)
        onVerified()
      } else {
        const data = await api.post<{ accessToken: string; refreshToken: string }>(
          '/auth/login',
          { mobile, code },
          { anonymous: true },
        )
        await tokenStore.set(data)
        onVerified()
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
        if (err.status === 409 || err.message.toLowerCase().includes('already exists') || err.message.toLowerCase().includes('already registered')) {
          setIsMobileRegistered(true)
        } else {
          setAttemptsLeft((prev) => (prev !== null ? Math.max(0, prev - 1) : 4))
        }
      } else {
        setError('Verification failed.')
      }
    } finally {
      setPending(false)
    }
  }

  const codeMessage = (
    <>
      {error && !hourlyLimitHit && !isMobileRegistered ? (
        <View style={styles.errorRow}>
          <Body size="sm" tone="danger">{error}</Body>
          {attemptsLeft !== null && <Eyebrow tone="danger">{attemptsLeft} of 5 attempts left</Eyebrow>}
        </View>
      ) : isMobileRegistered ? (
        <Body size="sm" tone="danger">
          This mobile number is already registered.{' '}
          {onSignIn && (
            <Body size="sm" weight="semibold" tone="danger" style={styles.link} onPress={onSignIn}>
              Sign in
            </Body>
          )}
        </Body>
      ) : hourlyLimitHit ? (
        <Body size="sm" tone="muted">Nothing to verify until a new code arrives.</Body>
      ) : null}
    </>
  )

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={text.displayLead}>Enter the code</Text>
          <Text style={[text.uiBase, styles.sub]}>
            Sent by SMS to <Text style={styles.subStrong}>+91 {mobile}</Text>
            {'  '}
            <Text style={styles.link} onPress={onBack}>Edit</Text>
          </Text>
        </View>

        <OtpInput
          length={CODE_LENGTH}
          value={code}
          onChange={setCode}
          invalid={Boolean(error && !hourlyLimitHit)}
          inert={hourlyLimitHit}
        />

        {codeMessage}

        {hourlyLimitHit ? (
          <Banner tone="warning" title="Hourly limit reached">
            <View style={styles.warningActions}>
              <Body size="sm" style={styles.warningBody}>
                You’ve used all five codes this number gets in an hour. Nothing is wrong with your account — the count rolls over.
              </Body>
              <Button label="Resend the code" variant="quiet" size="md" disabled full />
              <Eyebrow style={styles.warningNextCode}>
                0 of 5 sends left · next code at {nextCodeTime ?? 'rolling hour'} IST
              </Eyebrow>
              <Button
                label="Message support"
                variant="outline"
                size="md"
                full
                onPress={() => Linking.openURL('mailto:support@apostrophe.work')}
              />
            </View>
          </Banner>
        ) : (
          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Body size="md" tone="muted">
                Resend in <Text style={[text.metaMd, styles.clock]}>{formatMMSS(cooldown)}</Text>
              </Body>
            ) : (
              <Pressable onPress={handleResendCode} hitSlop={space.sm}>
                <Body size="md" weight="semibold" tone="accent">Resend the code</Body>
              </Pressable>
            )}
            <Body size="xs" tone="muted">{sendsRemaining} of 5 sends left this hour</Body>
          </View>
        )}

        <View style={styles.tip}>
          <Text style={[text.metaMd, styles.tipTag]}>Tip</Text>
          <Text style={[text.uiSm, styles.tipText]}>
            {hourlyLimitHit
              ? 'Codes last 10 minutes.'
              : `Six digits. Paste all six — we’ll fill them in. Code expires in ${formatMMSS(codeExpirySeconds)}.`}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: space.lg + insets.bottom }]}>
        <Button
          label={pending ? 'Verifying…' : 'Verify and continue'}
          variant="primary"
          size="lg"
          full
          disabled={hourlyLimitHit || code.length !== CODE_LENGTH}
          busy={pending}
          reason={hourlyLimitHit ? "There's no live code to check yet." : undefined}
          onPress={handleVerify}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: spaceHalf['6'], paddingTop: space.sm, gap: spaceHalf['6'] },
  header: { gap: space.sm },
  sub: { color: color.textMuted },
  subStrong: { color: color.text, fontFamily: fontFamilyNative.bodyMedium },
  link: { color: color.accent, fontFamily: fontFamilyNative.bodyMedium },
  errorRow: { gap: space.xs },
  clock: { color: color.text },
  resendRow: { gap: space.xs },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceHalf['2.5'],
    paddingVertical: space.md,
    paddingHorizontal: spaceHalf['3.5'],
    borderRadius: radius.tile,
    backgroundColor: color.accentSoft,
  },
  tipTag: { color: color.accentText, textTransform: 'uppercase', letterSpacing: trackingNative.meta },
  tipText: { flex: 1, color: color.accentText },
  warningActions: { gap: space.md },
  warningBody: { color: color.warning },
  warningNextCode: { color: color.warning },
  footer: { paddingHorizontal: spaceHalf['6'], paddingTop: space.lg },
})
