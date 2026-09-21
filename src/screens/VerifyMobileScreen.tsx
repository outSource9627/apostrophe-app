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
import { OtpInput } from '../components/ui/fields'
import { Button } from '../components/ui/Button'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import {
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── App bar (52px) ─────────────────────────────────────────────── */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="m15 18-6-6 6-6" />
          </Svg>
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
          <Text style={styles.eyebrow}>VERIFY YOUR MOBILE</Text>
          <Text style={styles.headline}>
            Six digits and <Text style={styles.headlineMuted}>you’re in.</Text>
          </Text>
        </View>

        {/* Code group */}
        <View style={styles.codeGroup}>
          {/* Sent to row */}
          <View style={styles.sentToRow}>
            <View style={styles.sentToInfo}>
              <Text style={styles.sentToLabel}>Sent to</Text>
              <Text style={styles.sentToNumber}>+91 {mobile}</Text>
            </View>
            <Pressable onPress={onBack} hitSlop={8}>
              <Text style={styles.editLink}>Edit</Text>
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
                <Text style={styles.messageText}>Nothing to verify until a new code arrives.</Text>
                <Text style={styles.expiryMono}>Last code expired · codes last 10 minutes</Text>
                <Text style={styles.helperText}>Six digits. Paste all six — we’ll fill them in.</Text>
              </>
            ) : isMobileRegistered ? (
              <>
                <View style={styles.errorRow}>
                  <Text style={styles.errorText}>
                    This mobile number is already registered.{' '}
                    {onSignIn && (
                      <Text onPress={onSignIn} style={styles.link}>
                        Sign in
                      </Text>
                    )}
                  </Text>
                </View>
                <Text style={styles.expiryMono}>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Text>
              </>
            ) : error ? (
              <>
                <View style={styles.errorRow}>
                  <Text style={styles.errorText}>{error}</Text>
                  {attemptsLeft !== null && (
                    <Text style={styles.attemptsMono}>{attemptsLeft} of 5 attempts left</Text>
                  )}
                </View>
                <Text style={styles.expiryMono}>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.messageText}>Your code is on its way. It can take a few seconds.</Text>
                <Text style={styles.expiryMono}>
                  Code expires in {formatMMSS(codeExpirySeconds)} · codes last 10 minutes
                </Text>
                <Text style={styles.helperText}>Six digits. Paste all six — we’ll fill them in.</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Lower third: Resend and CTA ──────────────────────────────────── */}
        <View style={styles.bottomSection}>
          {hourlyLimitHit ? (
            /* Warning block */
            <View style={styles.warningBlock}>
              <View style={styles.warningTitleRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.warning} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx={12} cy={12} r={9} />
                  <Path d="M12 7.5V12l3 2" />
                </Svg>
                <Text style={styles.warningTitle}>Hourly limit reached</Text>
              </View>
              <Text style={styles.warningBody}>
                You’ve used all five codes this number gets in an hour. Nothing is wrong with your account — the count rolls over.
              </Text>
              <Button
                label="Resend the code"
                variant="quiet"
                size="md"
                disabled
                full
              />
              <Text style={styles.warningNextCode}>
                0 of 5 sends left · next code at {nextCodeTime ?? 'rolling hour'} IST
              </Text>
              <Button
                label="Message support"
                variant="outline"
                size="md"
                full
                onPress={() => Linking.openURL('mailto:support@apostrophe.work')}
              />
            </View>
          ) : cooldown > 0 ? (
            /* Cooling down state */
            <View style={styles.coolingRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={9} />
                <Path d="M12 7.5V12l3 2" />
              </Svg>
              <Text style={styles.cooldownText}>Resend in {formatMMSS(cooldown)}</Text>
            </View>
          ) : (
            /* Ready to resend */
            <View style={styles.readyBlock}>
              <Pressable onPress={handleResendCode} hitSlop={8}>
                <Text style={styles.resendLink}>Resend the code</Text>
              </Pressable>
              <Text style={styles.sendsLeftText}>
                {sendsRemaining} of 5 sends left this hour
              </Text>
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
  appBar: {
    height: height['app-bar'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
  },
  backButton: {
    width: height.tap,
    height: height.tap,
    marginLeft: -space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  header: {
    gap: space.sm,
    marginBottom: space['2xl'],
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
  sentToLabel: {
    fontSize: fontSize['ui-sm'],
    color: color.textMuted,
  },
  sentToNumber: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-md'],
    fontWeight: fontWeight.medium,
    letterSpacing: trackingNative['meta-wide'],
    textTransform: 'uppercase',
    color: color.text,
  },
  editLink: {
    fontSize: fontSize['ui-sm'],
    color: color.textMuted,
    textDecorationLine: 'underline',
  },
  messageArea: {
    gap: space.sm,
  },
  messageText: {
    fontSize: fontSize['ui-xs'],
    color: color.textMuted,
    lineHeight: leadingNative['ui-xs'],
  },
  expiryMono: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: fontSize['ui-xs'],
    color: color.textSubtle,
    lineHeight: leadingNative['ui-xs'],
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  errorText: {
    fontSize: fontSize['ui-xs'],
    color: color.danger,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: fontWeight.semibold,
    color: color.danger,
  },
  attemptsMono: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.danger,
    textTransform: 'uppercase',
  },
  bottomSection: {
    marginTop: space['3xl'],
    gap: space.xl,
  },
  warningBlock: {
    borderRadius: radius.md,
    backgroundColor: color.warningSoft,
    padding: space.lg,
    gap: space.md,
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  warningTitle: {
    fontSize: fontSize['ui-md'],
    fontWeight: fontWeight.semibold,
    color: color.warning,
  },
  warningBody: {
    fontSize: fontSize['ui-sm'],
    lineHeight: leadingNative['ui-sm'],
    color: color.warning,
  },
  warningNextCode: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.warning,
    textTransform: 'uppercase',
  },
  coolingRow: {
    height: height.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  cooldownText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  readyBlock: {
    gap: space.sm,
    alignItems: 'flex-start',
  },
  resendLink: {
    fontSize: fontSize['ui-md'],
    fontWeight: fontWeight.semibold,
    color: color.text,
    textDecorationLine: 'underline',
  },
  sendsLeftText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
})
