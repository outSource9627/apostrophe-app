import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Logo } from '../components/Logo'
import { api, tokenStore } from '../lib/api'
import { ApiClientError } from '../lib/api/types'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative, borderWidth, container, height, leadingNative, opacity, trackingNative } from '../theme'

/**
 * ST-01 — sign in with mobile and OTP.
 *
 * Ink above, a paper sheet below: the brand gets the top half, the form sits
 * where the thumb is. The country code is furniture inside the control rather
 * than a field, because India-only means it cannot vary.
 */
export function SignInScreen({ onSignedIn, onRegister }: { onSignedIn: () => void; onRegister: () => void }) {
  const insets = useSafeAreaInsets()
  const [stage, setStage] = useState<'MOBILE' | 'CODE'>('MOBILE')
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const CODE_LENGTH = 6

  async function sendCode() {
    setPending(true); setError(null)
    try {
      await api.post('/auth/otp/send', { mobile, purpose: 'LOGIN' }, { anonymous: true })
      setStage('CODE')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not send the code.')
    } finally { setPending(false) }
  }

  async function verify() {
    setPending(true); setError(null)
    try {
      const t = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login', { mobile, code }, { anonymous: true },
      )
      await tokenStore.set(t)
      onSignedIn()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not sign you in.')
    } finally { setPending(false) }
  }

  return (
    <View style={styles.page}>
      {/* Status-bar space is left to the real status bar, never painted. */}
      <View style={[styles.top, { paddingTop: insets.top + space.xl }]}>
        <Logo size={18} tint={color.textInverse} />
        <Text style={styles.headline}>Beyond resumes.</Text>
        <Text style={[styles.headline, styles.headlineMuted]}>Meet the person.</Text>
        <Text style={styles.lede}>
          Sit one interview. It becomes the profile employers actually watch.
        </Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        {stage === 'MOBILE' ? (
          <>
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.control}>
              <Text style={styles.prefix}>+91</Text>
              <View style={styles.divider} />
              <TextInput
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                placeholder="98765 43210"
                placeholderTextColor={color.textSubtle}
                style={styles.input}
              />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={sendCode}
              disabled={pending || mobile.length !== 10}
              style={({ pressed }) => [
                styles.cta,
                (pending || mobile.length !== 10) && styles.ctaDisabled,
                pressed && styles.ctaPressed,
              ]}
            >
              <Text style={styles.ctaLabel}>{pending ? 'Please wait…' : 'Send me a code'}</Text>
            </Pressable>

            <Pressable onPress={onRegister} style={styles.footerTarget}>
              <Text style={styles.footer}>
                First time here? <Text style={styles.footerLink}>Create an account</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>VERIFY YOUR NUMBER</Text>
            <Text style={styles.sentTo}>Sent to +91 {mobile}</Text>

            {/*
              One real input behind six cells. Six separate inputs look the same
              and then fight the platform over paste, backspace and SMS autofill.
            */}
            <View>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus
                maxLength={CODE_LENGTH}
                style={styles.hiddenInput}
              />
              <View style={styles.cells} pointerEvents="none">
                {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                  <View key={i} style={[styles.cell, i === code.length && styles.cellActive]}>
                    <Text style={styles.cellText}>{code[i] ?? ''}</Text>
                  </View>
                ))}
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={verify}
              disabled={pending || code.length !== CODE_LENGTH}
              style={({ pressed }) => [
                styles.cta,
                (pending || code.length !== CODE_LENGTH) && styles.ctaDisabled,
                pressed && styles.ctaPressed,
              ]}
            >
              <Text style={styles.ctaLabel}>{pending ? 'Please wait…' : 'Sign in'}</Text>
            </Pressable>

            <Pressable onPress={() => { setStage('MOBILE'); setCode(''); setError(null) }} style={styles.footerTarget}>
              <View style={styles.backRow}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="m15 18-6-6 6-6" stroke={color.textMuted} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.footer}>Change the number</Text>
              </View>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ink },
  top: { flex: 1, paddingHorizontal: space.xl },
  headline: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-xl'], lineHeight: leadingNative['display-lg'], color: color.textInverse, marginTop: space['2xl'],
  },
  headlineMuted: { color: color.textOnInkMuted, marginTop: 0 },
  lede: {
    marginTop: space.lg,
    maxWidth: container['measure-native'],
    fontSize: fontSize['ui-md'],
    lineHeight: leadingNative['ui-base'],
    color: color.textOnInkMuted,
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl, paddingTop: space['2xl'],
  },
  eyebrow: { fontSize: fontSize['ui-2xs'], letterSpacing: trackingNative.widest, color: color.textSubtle },
  label: { marginTop: space.xl, fontSize: fontSize['ui-sm'], fontWeight: fontWeight.medium, color: color.text },
  control: {
    marginTop: space.sm, height: height.control, flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderRadius: radius.md, paddingHorizontal: space.lg,
  },
  prefix: { fontSize: fontSize['ui-base'], color: color.textSubtle },
  divider: { width: borderWidth.thin, height: space.xl, backgroundColor: color.border },
  input: { flex: 1, fontSize: fontSize['ui-lg'], color: color.text, padding: 0 },
  sentTo: { marginTop: space.lg, fontSize: fontSize['ui-base'], color: color.textMuted },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, height: height['otp-cell-lg'], opacity: opacity.hidden, zIndex: 2 },
  cells: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  cell: {
    flex: 1, height: height['otp-cell-lg'], borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  cellActive: { borderColor: color.text },
  cellText: { fontFamily: fontFamilyNative.display, fontSize: fontSize['display-md'], color: color.text },
  error: { marginTop: space.md, fontSize: fontSize['ui-sm'], color: color.danger },
  cta: {
    marginTop: space.lg, height: height.control, borderRadius: radius.pill, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: color.accentHover },
  ctaDisabled: { opacity: opacity.disabled },
  ctaLabel: { color: color.textInverse, fontSize: fontSize['ui-base'], fontWeight: fontWeight.semibold },
  footerTarget: { marginTop: space.lg, height: height.tap, alignItems: 'center', justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { fontSize: fontSize['ui-md'], color: color.textMuted },
  footerLink: { color: color.accent, fontWeight: fontWeight.medium },
})
