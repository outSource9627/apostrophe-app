import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Banner } from '../components/ui/Banner'
import {
  AButton, BrandScreen, Link, Meta, MetaRow, OtpBoxes, ResendAction, SheetSub, SheetTitle, Tip,
} from '../components/auth/kit'
import {
  CONTRACT_CODE_LENGTH, clockIST, clockMMSS, groupedMobile, numberWord, readSendRefusal, serverAttemptsLeft, useAuthConfig,
} from '../components/auth/config'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { openSupport } from '../lib/support'
import { color, fontFamilyNative, fontSize, leadingNative, space } from '../theme'
import type { RegistrationData } from './CreateAccountScreen'

interface Props {
  mobile: string
  purpose: 'REGISTER' | 'LOGIN'
  registrationData?: RegistrationData
  /** The send's own `resendAfterSeconds` — the wait before another code may be asked for. */
  initialCooldown?: number
  onBack: () => void
  onVerified: () => void
  onSignIn?: () => void
}

/**
 * ST-03 · Verify your number, in the direction C look: the brand band, then the
 * code in the sheet. Every number it quotes is the server's (/config `auth`):
 * how many digits, how long the code lives, how long to wait to ask again, how
 * many tries a code takes and how many sends a number gets in an hour. One the
 * server did not send is simply not quoted.
 */
export function VerifyMobileScreen({
  mobile,
  purpose,
  registrationData,
  initialCooldown,
  onBack,
  onVerified,
  onSignIn,
}: Props) {
  const config = useAuthConfig()
  const auth = config.data?.auth
  const codeLength = auth?.otpLength ?? CONTRACT_CODE_LENGTH
  const ttlMinutes = auth?.otpTtlMinutes
  const cooldownPeriod = auth?.otpResendCooldownSeconds ?? 0
  const maxSends = auth?.otpMaxSendsPerHour
  const maxAttempts = auth?.otpMaxAttempts

  const now = useClock()
  const [code, setCode] = useState('')
  /** When the live code went out (this screen opens right after the send). */
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [resendAt, setResendAt] = useState(() => Date.now() + (initialCooldown ?? 0) * 1000)
  /** Sends spent this hour that this screen knows of — the one that brought us here, then each resend. */
  const [sendsUsed, setSendsUsed] = useState(1)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [limit, setLimit] = useState<{ retryAt: Date | null } | null>(null)
  const [isMobileRegistered, setIsMobileRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)

  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const expiresIn = ttlMinutes ? Math.max(0, Math.round((sentAt + ttlMinutes * 60_000 - now) / 1000)) : null
  const sendsLeft = maxSends ? Math.max(0, maxSends - sendsUsed) : null
  const blocked = !!limit
  const lengthWord = auth?.otpLength ? `${auth.otpLength}-digit code` : 'code'

  async function handleResendCode() {
    if (cooldown > 0 || pending || resending) return
    setResending(true)
    setError(null)
    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile, purpose },
        { anonymous: true },
      )
      const at = Date.now()
      setResendAt(at + (res.resendAfterSeconds ?? cooldownPeriod) * 1000)
      setSentAt(at)
      setSendsUsed((n) => n + 1)
      setAttemptsLeft(null)
      setCode('')
    } catch (err) {
      const refusal = readSendRefusal(err, cooldownPeriod)
      if (refusal?.kind === 'cooldown') {
        // Too early, not out of sends: the wait restarts and no send is spent.
        setResendAt(Date.now() + refusal.seconds * 1000)
      } else if (refusal?.kind === 'hourly') {
        setLimit({ retryAt: refusal.retryAt })
      } else {
        setError(err instanceof ApiClientError ? err.message : 'Could not resend the code.')
      }
    } finally {
      setResending(false)
    }
  }

  async function handleVerify() {
    if (pending || blocked) return
    if (code.length !== codeLength) {
      setError(auth?.otpLength ? `Enter the ${auth.otpLength}-digit code` : 'Enter the whole code')
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
      } else {
        const data = await api.post<{ accessToken: string; refreshToken: string }>(
          '/auth/login',
          { mobile, code },
          { anonymous: true },
        )
        await tokenStore.set(data)
      }
      onVerified()
    } catch (err) {
      if (err instanceof ApiClientError) {
        const m = err.message.toLowerCase()
        if (err.status === 409 || m.includes('already exists') || m.includes('already registered')) {
          setIsMobileRegistered(true)
          setError(err.message)
        } else if (err.fields?.code) {
          // A wrong or expired code: counted down from the server's own figure when it sends one.
          const fromServer = serverAttemptsLeft(err)
          setAttemptsLeft((prev) =>
            fromServer !== null ? fromServer : prev !== null ? Math.max(0, prev - 1) : maxAttempts ? maxAttempts - 1 : null,
          )
          setError(err.message)
        } else {
          setError(err.message)
        }
      } else {
        setError('Verification failed. Check your connection and try again.')
      }
    } finally {
      setPending(false)
    }
  }

  const attemptsNote =
    attemptsLeft === null ? '' : `  ·  ${attemptsLeft}${maxAttempts ? ` of ${maxAttempts}` : ''} attempts left`

  return (
    <BrandScreen
      onBack={onBack}
      footer={
        <AButton
          label={pending ? 'Verifying…' : 'Verify & continue'}
          busy={pending}
          disabled={blocked}
          onPress={handleVerify}
        />
      }
    >
      <SheetTitle>Verify your number</SheetTitle>
      <SheetSub>
        Enter the {lengthWord} sent to <Text style={styles.strong}>+91 {groupedMobile(mobile)}</Text> ·{' '}
        <Link onPress={onBack}>Edit</Link>
      </SheetSub>

      <View style={styles.cells}>
        <OtpBoxes
          length={codeLength}
          value={code}
          onChange={(v) => { setCode(v); setError(null) }}
          invalid={Boolean(error && !blocked && !isMobileRegistered)}
          editable={!pending && !blocked}
          autoFocus
        />
      </View>

      {!!error && !isMobileRegistered && (
        <Text style={styles.error}>
          {error}
          {attemptsNote}
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
            {`You’ve used all ${maxSends ? `${numberWord(maxSends)} codes` : 'the codes'} this number gets in an hour. Nothing is wrong with your account — the count rolls over. ${
              limit?.retryAt ? `Next code at ${clockIST(limit.retryAt)} IST.` : 'Try again in an hour.'
            }`}
          </Banner>
          <View style={styles.cta}>
            <AButton variant="outline" label="Message support" onPress={() => openSupport('Verification code limit')} />
          </View>
        </View>
      ) : (
        <MetaRow>
          <ResendAction seconds={cooldown} busy={resending} onResend={handleResendCode} />
          {sendsLeft !== null && <Meta>{sendsLeft} of {maxSends} sends left this hour</Meta>}
        </MetaRow>
      )}

      {blocked ? (
        ttlMinutes ? <Tip title="Tip">Codes last {ttlMinutes} minutes.</Tip> : null
      ) : (
        <Tip title="Tip">
          Paste all {auth?.otpLength ? `${numberWord(auth.otpLength)} digits` : 'the digits'} and we’ll fill them in.
          {expiresIn === null
            ? ''
            : expiresIn > 0
              ? <> This code expires in <Text style={styles.figure}>{clockMMSS(expiresIn)}</Text>.</>
              : ' This code has expired — send a new one.'}
        </Tip>
      )}
    </BrandScreen>
  )
}

/** Date.now(), re-read once a second while the screen is up — the countdowns run on it. */
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const styles = StyleSheet.create({
  strong: { fontFamily: fontFamilyNative.bodySemiBold, color: color.text },
  figure: { fontVariant: ['tabular-nums'] },
  cells: { marginTop: space.xl },
  error: { fontFamily: fontFamilyNative.body, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.danger, marginTop: space.md },
  banner: { marginTop: space.lg },
  cta: { marginTop: space.md },
})
