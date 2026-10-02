import React, { useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Banner } from '../components/ui/Banner'
import {
  A, AButton, AField, AInput, APassword, APhone, AuthSeg, AuthSub, AuthTitle, AuthTop, BottomBar,
  GoogleBtn, Link, Note, NoteStrong, OrRow, Swap,
} from '../components/auth/kit'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color } from '../theme'

type Method = 'Mobile OTP' | 'Email & password'

type BannerState =
  | { type: 'WRONG_CREDENTIALS'; message: string }
  | { type: 'SUSPENDED'; message: string; ref: string }
  | { type: 'RATE_LIMITED'; message: string; retryTime?: string }
  | null

interface Props {
  /**
   * `mustChangePassword` is the server's routing hint for an interviewer on a
   * temporary password (IV-07). The role itself is read back by the caller.
   */
  onSignedIn: (hint: { mustChangePassword: boolean }) => void
  onBack: () => void
  onRegister: () => void
  onForgot: () => void
  /** Interviewers have no self-signup; this opens the HR application. */
  onJoinUs: () => void
  onOtpSent: (data: { mobile: string; resendAfterSeconds: number }) => void
}

/**
 * ST-04 — Sign in screen matching canonical specification.
 *
 * App bar: Logo + "Create account"
 * Title: "Pick up where you left off."
 * Method selector: Segmented control (Mobile, Email, Google)
 * Dynamic Banner: handles 401 wrong credentials, 403 suspended, and 429 rate limit.
 */
export function SignInScreen({ onSignedIn, onBack, onRegister, onForgot, onJoinUs, onOtpSent }: Props) {
  const insets = useSafeAreaInsets()
  const [method, setMethod] = useState<Method>('Mobile OTP')

  // Mobile state
  const [mobile, setMobile] = useState('')

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Status & banner
  const [pending, setPending] = useState(false)
  const [banner, setBanner] = useState<BannerState>(null)

  // 1 · Submit Mobile to send OTP
  async function handleSendMobileCode() {
    if (pending) return
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setMobileError('Enter a valid 10-digit mobile number')
      return
    }
    setPending(true)
    setBanner(null)

    try {
      const res = await api.post<{ sent: boolean; resendAfterSeconds?: number }>(
        '/auth/otp/send',
        { mobile, purpose: 'LOGIN' },
        { anonymous: true },
      )
      onOtpSent({
        mobile,
        resendAfterSeconds: res.resendAfterSeconds ?? 30,
      })
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 429) {
          const retrySec = (err.details as { retryAfterSeconds?: number })?.retryAfterSeconds ?? 3600
          const resumeDate = new Date(Date.now() + retrySec * 1000)
          const timeStr = resumeDate.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
          setBanner({
            type: 'RATE_LIMITED',
            message: "That’s 5 codes to this number this hour.",
            retryTime: `TRY AGAIN AFTER ${timeStr} IST`,
          })
        } else if (err.status === 403) {
          setBanner({
            type: 'SUSPENDED',
            message: "This account is suspended. Signing in again won’t help — our team has to lift it.",
            ref: '[REF-AUTH403]',
          })
        } else {
          setBanner({
            type: 'WRONG_CREDENTIALS',
            message: err.message,
          })
        }
      } else {
        setBanner({
          type: 'WRONG_CREDENTIALS',
          message: 'Could not send the code.',
        })
      }
    } finally {
      setPending(false)
    }
  }

  // 2 · Submit Email & Password
  async function handleEmailLogin() {
    if (pending) return
    const badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setEmailError(badEmail ? 'Enter a valid email address' : null)
    setPasswordError(password ? null : 'Enter your password')
    if (badEmail || !password) return
    setPending(true)
    setBanner(null)

    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; mustChangePassword?: boolean }>(
        '/auth/login/password',
        { email, password },
        { anonymous: true },
      )
      await tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      onSignedIn({ mustChangePassword: !!data.mustChangePassword })
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setBanner({
            type: 'SUSPENDED',
            message: "This account is suspended. Signing in again won’t help — our team has to lift it.",
            ref: '[REF-AUTH403]',
          })
        } else {
          setBanner({
            type: 'WRONG_CREDENTIALS',
            message: "That email and password don’t match.",
          })
        }
      } else {
        setBanner({
          type: 'WRONG_CREDENTIALS',
          message: "That email and password don’t match.",
        })
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

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.titleGap} />
        <AuthTitle>Welcome back</AuthTitle>
        <AuthSub>Log in to your Apostrophe account.</AuthSub>

        <AuthSeg
          options={['Mobile OTP', 'Email & password'] as const}
          value={method}
          onChange={(m) => {
            setMethod(m)
            setBanner(null)
          }}
        />

        {banner && (
          <View style={styles.banner}>
            <Banner
              tone={
                banner.type === 'WRONG_CREDENTIALS' ? 'danger' : banner.type === 'RATE_LIMITED' ? 'warning' : 'info'
              }
              reference={
                banner.type === 'SUSPENDED' ? banner.ref : banner.type === 'RATE_LIMITED' ? banner.retryTime : undefined
              }
              actionLabel={banner.type === 'SUSPENDED' ? 'Write to support' : undefined}
              onAction={
                banner.type === 'SUSPENDED' ? () => Linking.openURL('mailto:support@apostrophe.work') : undefined
              }
            >
              {banner.message}
            </Banner>
          </View>
        )}

        {method === 'Mobile OTP' ? (
          <>
            <AField label="Mobile number" helper="We’ll send a 6-digit code by SMS." error={mobileError}>
              <APhone
                value={mobile}
                onChangeText={(v) => {
                  setMobile(v.replace(/\D/g, ''))
                  setMobileError(null)
                  setBanner(null)
                }}
                invalid={!!mobileError}
                editable={!pending}
              />
            </AField>
            <View style={styles.cta}>
              <AButton label={pending ? 'Sending code…' : 'Send OTP'} busy={pending} onPress={handleSendMobileCode} />
            </View>
          </>
        ) : (
          <>
            <AField label="Email" error={emailError}>
              <AInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v)
                  setEmailError(null)
                  setBanner(null)
                }}
                invalid={!!emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                placeholder="you@example.com"
                editable={!pending}
              />
            </AField>
            <AField label="Password" right={<Link onPress={onForgot}>Forgot?</Link>} error={passwordError}>
              <APassword
                value={password}
                onChangeText={(v) => {
                  setPassword(v)
                  setPasswordError(null)
                  setBanner(null)
                }}
                invalid={!!passwordError}
                shown={shown}
                onToggle={() => setShown((v) => !v)}
                textContentType="password"
                placeholder="Your password"
                editable={!pending}
              />
            </AField>
            <View style={styles.cta}>
              <AButton label={pending ? 'Signing in…' : 'Log in'} busy={pending} onPress={handleEmailLogin} />
            </View>
          </>
        )}

        <OrRow />
        <GoogleBtn />

        <Note>
          <NoteStrong>Interviewer?</NoteStrong> Log in with the email and temporary password we sent you. You’ll set a
          new one the first time. New here? <Link onPress={onJoinUs}>Join us as HR</Link>
        </Note>
      </ScrollView>

      <BottomBar insetBottom={insets.bottom + 14}>
        <Swap lead="New to Apostrophe?" action="Create account" onPress={onRegister} />
      </BottomBar>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: A.gutter, paddingBottom: 24 },
  titleGap: { height: 12 },
  banner: { marginTop: 16 },
  cta: { marginTop: 22 },
})
