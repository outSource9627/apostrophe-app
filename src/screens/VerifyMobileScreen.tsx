import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Banner } from '../components/ui/Banner'
import {
  A, AButton, AuthSub, AuthTitle, AuthTop, BottomBar, Link, Note, NoteStrong, OtpBoxes, ResendLine,
} from '../components/auth/kit'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color } from '../theme'
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
    if (pending) return
    if (code.length !== CODE_LENGTH) {
      setError('Enter the 6-digit code')
      return
    }
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

  const blocked = hourlyLimitHit

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthTop onBack={onBack} brand={false} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.gap} />
        <AuthTitle>Verify your number</AuthTitle>
        <AuthSub>
          Enter the 6-digit code sent to <Text style={styles.strong}>+91 {mobile}</Text>. <Link onPress={onBack}>Edit</Link>
        </AuthSub>

        <OtpBoxes
          value={code}
          onChange={(v) => { setCode(v); setError(null) }}
          invalid={Boolean(error && !blocked)}
          autoFocus
        />

        {!!error && !blocked && !isMobileRegistered && (
          <Text style={styles.error}>
            {error}
            {attemptsLeft !== null ? `  ·  ${attemptsLeft} of 5 attempts left` : ''}
          </Text>
        )}
        {isMobileRegistered && (
          <Text style={styles.error}>
            This mobile number is already registered. {onSignIn && <Link onPress={onSignIn}>Log in</Link>}
          </Text>
        )}

        {blocked ? (
          <View style={styles.banner}>
            <Banner tone="warning" title="Hourly limit reached">
              You’ve used all five codes this number gets in an hour. Nothing is wrong with your account — the count
              rolls over. Next code at {nextCodeTime ?? 'the next hour'} IST.
            </Banner>
            <View style={styles.cta}>
              <AButton
                variant="outline"
                label="Message support"
                onPress={() => Linking.openURL('mailto:support@apostrophe.work')}
              />
            </View>
          </View>
        ) : (
          <>
            <ResendLine seconds={cooldown} onResend={handleResendCode} />
            <Text style={styles.small}>{sendsRemaining} of 5 sends left this hour</Text>
          </>
        )}

        <Note>
          <NoteStrong>Tip</NoteStrong>{' '}
          {blocked
            ? 'Codes last 10 minutes.'
            : `Paste all six digits and we’ll fill them in. This code expires in ${formatMMSS(codeExpirySeconds)}.`}
        </Note>
      </ScrollView>

      <BottomBar insetBottom={insets.bottom + 14}>
        <AButton
          label={pending ? 'Verifying…' : 'Verify & continue'}
          busy={pending}
          onPress={blocked ? undefined : handleVerify}
        />
      </BottomBar>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: A.gutter, paddingBottom: 24 },
  gap: { height: 12 },
  strong: { color: color.text },
  error: { color: A.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
  small: { color: color.textSubtle, fontSize: 13, textAlign: 'center', marginTop: 6 },
  banner: { marginTop: 22 },
  cta: { marginTop: 12 },
})
