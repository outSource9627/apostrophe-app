import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Logo } from '../components/Logo'
import { Field, Input } from '../components/ui/fields'
import { Segmented } from '../components/ui/controls'
import { Banner } from '../components/ui/Banner'
import { GoogleButton } from '../components/ui/GoogleButton'
import { Button } from '../components/ui/Button'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import {
  borderWidth,
  color,
  fontFamilyNative,
  fontSize,
  height,
  leadingNative,
  radius,
  space,
  trackingNative,
} from '../theme'

type Method = 'Mobile' | 'Email' | 'Google'

type BannerState =
  | { type: 'WRONG_CREDENTIALS'; message: string }
  | { type: 'SUSPENDED'; message: string; ref: string }
  | { type: 'RATE_LIMITED'; message: string; retryTime?: string }
  | null

interface Props {
  onSignedIn: () => void
  onRegister: () => void
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
export function SignInScreen({ onSignedIn, onRegister, onOtpSent }: Props) {
  const insets = useSafeAreaInsets()
  const [method, setMethod] = useState<Method>('Mobile')

  // Mobile state
  const [mobile, setMobile] = useState('')

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Status & banner
  const [pending, setPending] = useState(false)
  const [banner, setBanner] = useState<BannerState>(null)

  // 1 · Submit Mobile to send OTP
  async function handleSendMobileCode() {
    if (pending || mobile.length !== 10) return
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
    if (pending || !email.trim() || !password) return
    setPending(true)
    setBanner(null)

    try {
      const data = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login/password',
        { email, password },
        { anonymous: true },
      )
      await tokenStore.set(data)
      onSignedIn()
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── App bar (52px) ─────────────────────────────────────────────── */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <Logo size={18} tint={color.text} />
        <Pressable onPress={onRegister} hitSlop={12} style={styles.appBarAction}>
          <Text style={styles.appBarActionText}>Create account</Text>
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
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.headline}>
            Pick up where{'\n'}
            <Text style={styles.headlineMuted}>you left off.</Text>
          </Text>
        </View>

        {/* Method chooser · Segmented 3-option control */}
        <Segmented
          options={['Mobile', 'Email', 'Google'] as const}
          value={method}
          onChange={(m) => {
            setMethod(m)
            setBanner(null)
          }}
        />

        {/* Dynamic Inline Banner */}
        {banner && (
          <Banner
            tone={
              banner.type === 'WRONG_CREDENTIALS'
                ? 'danger'
                : banner.type === 'RATE_LIMITED'
                  ? 'warning'
                  : 'info'
            }
            reference={
              banner.type === 'SUSPENDED'
                ? banner.ref
                : banner.type === 'RATE_LIMITED'
                  ? banner.retryTime
                  : undefined
            }
            actionLabel={banner.type === 'SUSPENDED' ? 'Write to support' : undefined}
            onAction={
              banner.type === 'SUSPENDED'
                ? () => Linking.openURL('mailto:support@apostrophe.work')
                : undefined
            }
          >
            {banner.message}
          </Banner>
        )}

        {/* 1 · Mobile Method */}
        {method === 'Mobile' && (
          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MOBILE</Text>
              <View style={styles.mobileControl}>
                <Text style={styles.mobilePrefix}>+91</Text>
                <View style={styles.mobileDivider} />
                <TextInput
                  value={mobile}
                  onChangeText={(v) => {
                    setMobile(v.replace(/\D/g, '').slice(0, 10))
                    setBanner(null)
                  }}
                  keyboardType="number-pad"
                  textContentType="telephoneNumber"
                  placeholder="98765 43210"
                  placeholderTextColor={color.textSubtle}
                  style={styles.mobileInput}
                  editable={!pending}
                />
              </View>
              <Text style={styles.hintText}>
                We’ll text a six-digit code. It’s good for 10 minutes.
              </Text>
            </View>

            <View style={styles.ctaSection}>
              <Button
                label={pending ? 'Sending code…' : 'Send me a code'}
                variant="primary"
                size="lg"
                full
                disabled={pending || mobile.length !== 10}
                busy={pending}
                onPress={handleSendMobileCode}
              />
              <Text style={styles.channelNote}>
                Mobile, email and Google all reach the same account.
              </Text>
            </View>
          </View>
        )}

        {/* 2 · Email Method */}
        {method === 'Email' && (
          <View style={styles.formSection}>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={(v) => {
                  setEmail(v)
                  setBanner(null)
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                placeholder="you@example.com"
                editable={!pending}
              />
            </Field>

            <Field label="Password">
              <Input
                value={password}
                onChangeText={(v) => {
                  setPassword(v)
                  setBanner(null)
                }}
                secureTextEntry
                textContentType="password"
                placeholder="Your password"
                editable={!pending}
              />
            </Field>

            <View style={styles.ctaSection}>
              <Button
                label={pending ? 'Signing in…' : 'Sign in'}
                variant="primary"
                size="lg"
                full
                disabled={pending || !email.trim() || !password}
                busy={pending}
                onPress={handleEmailLogin}
              />
              <Text style={styles.channelNote}>
                Mobile, email and Google all reach the same account.
              </Text>
            </View>
          </View>
        )}

        {/* 3 · Google Method */}
        {method === 'Google' && (
          <View style={styles.googleSection}>
            <Text style={styles.googleHelper}>
              Sign in securely with your Google account to access your interviews and profile.
            </Text>

            <GoogleButton onPress={() => {}} />

            <Text style={styles.channelNote}>
              Mobile, email and Google all reach the same account.
            </Text>
          </View>
        )}
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
  appBarActionText: {
    fontSize: fontSize['ui-sm'],
    color: color.textMuted,
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.xl,
  },
  header: {
    gap: space.sm,
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
  formSection: {
    gap: space.lg,
  },
  fieldGroup: {
    gap: space.sm,
  },
  fieldLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-sm'],
    letterSpacing: trackingNative['eyebrow-wide'],
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  mobileControl: {
    height: height.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
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
    fontSize: fontSize['ui-base'],
    color: color.text,
    padding: 0,
  },
  hintText: {
    fontSize: fontSize['ui-xs'],
    color: color.textSubtle,
    lineHeight: leadingNative['ui-xs'],
  },
  ctaSection: {
    marginTop: space.lg,
    gap: space.sm,
  },
  googleSection: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  googleHelper: {
    fontSize: fontSize['ui-sm'],
    color: color.textMuted,
    lineHeight: leadingNative['ui-md'],
  },
  channelNote: {
    fontSize: fontSize['ui-xs'],
    color: color.textSubtle,
    textAlign: 'center',
    lineHeight: leadingNative['ui-xs'],
  },
})
