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
import Svg, { Circle, Path } from 'react-native-svg'
import {
  AppBar,
  Banner,
  Body,
  Button,
  Display,
  Eyebrow,
  Meta,
  OtpInput,
} from '../components/ui'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color, height, space } from '../theme'
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── App bar ────────────────────────────────────────────────────── */}
      <AppBar onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.header}>
          <Eyebrow>VERIFY YOUR MOBILE</Eyebrow>
          <Display level="lg">
            Six digits and <Text style={styles.headlineMuted}>you’re in.</Text>
          </Display>
        </View>

        {/* Code group */}
        <View style={styles.codeGroup}>
          {/* Sent to row */}
          <View style={styles.sentToRow}>
            <View style={styles.sentToInfo}>
              <Body size="sm" tone="muted">Sent to</Body>
              <Meta style={styles.sentToNumber}>+91 {mobile}</Meta>
            </View>
            <Pressable onPress={onBack} hitSlop={8}>
              <Body size="sm" tone="muted" style={styles.editLink}>Edit</Body>
            </Pressable>
          </View>

          {/* 6 OTP Cells */}
          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onChange={setCode}
            invalid={Boolean(error && !hourlyLimitHit)}
            inert={hourlyLimitHit}
          />

          {/* Message area */}
          <View style={styles.messageArea}>
            {hourlyLimitHit ? (
              <>
                <Body size="xs" tone="muted">Nothing to verify until a new code arrives.</Body>
                <Eyebrow>Last code expired · codes last 10 minutes</Eyebrow>
                <Body size="xs" tone="subtle">Six digits. Paste all six — we’ll fill them in.</Body>
              </>
            ) : isMobileRegistered ? (
              <>
                <View style={styles.errorRow}>
                  <Body size="xs" tone="danger">
                    This mobile number is already registered.{' '}
                    {onSignIn && (
                      <Body size="xs" weight="semibold" tone="danger" style={styles.link} onPress={onSignIn}>
                        Sign in
                      </Body>
                    )}
                  </Body>
                </View>
                <Eyebrow>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Eyebrow>
              </>
            ) : error ? (
              <>
                <View style={styles.errorRow}>
                  <Body size="xs" tone="danger">{error}</Body>
                  {attemptsLeft !== null && (
                    <Eyebrow tone="danger">{attemptsLeft} of 5 attempts left</Eyebrow>
                  )}
                </View>
                <Eyebrow>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Eyebrow>
              </>
            ) : (
              <>
                <Body size="xs" tone="muted">Your code is on its way. It can take a few seconds.</Body>
                <Eyebrow>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Eyebrow>
                <Body size="xs" tone="subtle">Six digits. Paste all six — we’ll fill them in.</Body>
              </>
            )}
          </View>
        </View>

        {/* ── Lower third: Resend and CTA ──────────────────────────────────── */}
        <View style={styles.bottomSection}>
          {hourlyLimitHit ? (
            /* Warning block */
            <Banner tone="warning" title="Hourly limit reached">
              <View style={styles.warningActions}>
                <Body size="sm" style={styles.warningBody}>
                  You’ve used all five codes this number gets in an hour. Nothing is wrong with your account — the count rolls over.
                </Body>
                <Button
                  label="Resend the code"
                  variant="quiet"
                  size="md"
                  disabled
                  full
                />
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
          ) : cooldown > 0 ? (
            /* Cooling down state */
            <View style={styles.coolingRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={9} />
                <Path d="M12 7.5V12l3 2" />
              </Svg>
              <Eyebrow>Resend in {formatMMSS(cooldown)}</Eyebrow>
            </View>
          ) : (
            /* Ready to resend */
            <View style={styles.readyBlock}>
              <Pressable onPress={handleResendCode} hitSlop={8}>
                <Body size="md" weight="semibold" style={styles.resendLink}>Resend the code</Body>
              </Pressable>
              <Eyebrow>
                {sendsRemaining} of 5 sends left this hour
              </Eyebrow>
            </View>
          )}

          {/* Primary Action Button */}
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  header: {
    gap: space.sm,
    marginBottom: space['2xl'],
  },
  headlineMuted: {
    color: color.textMuted,
    fontStyle: 'italic',
  },
  codeGroup: {
    gap: space.xl,
  },
  sentToRow: {
    height: height.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sentToInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sentToNumber: {
    color: color.text,
  },
  editLink: {
    textDecorationLine: 'underline',
  },
  messageArea: {
    gap: space.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  link: {
    textDecorationLine: 'underline',
  },
  bottomSection: {
    marginTop: space['3xl'],
    gap: space.xl,
  },
  warningActions: {
    gap: space.md,
  },
  warningBody: {
    color: color.warning,
  },
  warningNextCode: {
    color: color.warning,
  },
  coolingRow: {
    height: height.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  readyBlock: {
    gap: space.sm,
    alignItems: 'flex-start',
  },
  resendLink: {
    textDecorationLine: 'underline',
  },
})
