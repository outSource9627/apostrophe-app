import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiClientError } from '../../lib/api'
import { requestPasswordReset, resetPassword } from '../../lib/api/account'
import { color, fontFamilyNative } from '../../theme'
import { Banner } from '../../components/ui/Banner'
import { Icon } from '../../components/ui/Icon'
import {
  A, AButton, AField, AInput, APassword, AuthSub, AuthTitle, AuthTop, BottomBar, Link, Note, NoteStrong, Swap,
} from '../../components/auth/kit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 10

/**
 * Forgot password — for every role. Two server calls: POST /auth/password/forgot
 * mails a link carrying a token, and POST /auth/password/reset takes that token
 * with the new password. The request never says whether the account exists. The
 * reset code is pasted from the email, so this works whether or not the app can
 * open the link itself.
 */
export function EmployerForgotPasswordScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets()
  const [stage, setStage] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sentLine, setSentLine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{ email?: string; token?: string; password?: string }>({})

  async function send() {
    if (busy) return
    if (!EMAIL_RE.test(email.trim())) { setFieldError({ email: 'Enter a valid email address' }); return }
    setBusy(true); setError(null)
    try {
      const r = await requestPasswordReset(email.trim())
      setSentLine(r.message)
      setStage('reset')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not send the link. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  async function reset() {
    if (busy) return
    const errs: typeof fieldError = {}
    if (token.trim().length < 10) errs.token = 'Paste the reset code from the email'
    if (password.length < MIN_PASSWORD) errs.password = `Use at least ${MIN_PASSWORD} characters`
    setFieldError(errs)
    if (errs.token || errs.password) return
    setBusy(true); setError(null)
    try {
      await resetPassword(token.trim(), password)
      setStage('done')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not reset the password. Try again.')
    } finally { setBusy(false) }
  }

  if (stage === 'done') {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <AuthTop onBack={onSignIn} />
        <View style={styles.done}>
          <View style={styles.doneIcon}><Icon name="check" size={32} tint={color.success} weight={2.4} /></View>
          <Text style={styles.doneTitle}>Password changed</Text>
          <Text style={styles.doneBody}>Log in with your new password. Every other device was signed out.</Text>
        </View>
        <BottomBar insetBottom={insets.bottom + 14}>
          <AButton label="Log in" onPress={onSignIn} />
        </BottomBar>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthTop onBack={stage === 'reset' ? () => setStage('request') : onBack} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.gap} />
        {stage === 'request' ? (
          <>
            <AuthTitle>Reset password</AuthTitle>
            <AuthSub>Enter the email you signed up with and we’ll send you a link to reset it.</AuthSub>
            {!!error && <View style={styles.banner}><Banner tone="danger">{error}</Banner></View>}
            <AField label="Email" error={fieldError.email}>
              <AInput
                value={email}
                onChangeText={(v) => { setEmail(v); setFieldError({}) }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={send}
                invalid={!!fieldError.email}
                editable={!busy}
              />
            </AField>
          </>
        ) : (
          <>
            <AuthTitle>Check your email</AuthTitle>
            <AuthSub>{sentLine ?? 'If an account exists for that email, a reset link is on its way.'}</AuthSub>
            {!!error && <View style={styles.banner}><Banner tone="danger">{error}</Banner></View>}
            <AField label="Reset code" helper="Paste the code from the email." error={fieldError.token}>
              <AInput
                value={token}
                onChangeText={(v) => { setToken(v); setFieldError((f) => ({ ...f, token: undefined })) }}
                placeholder="From the email"
                autoCapitalize="none"
                autoCorrect={false}
                invalid={!!fieldError.token}
                editable={!busy}
              />
            </AField>
            <AField label="New password" helper={`At least ${MIN_PASSWORD} characters`} error={fieldError.password}>
              <APassword
                shown={shown}
                onToggle={() => setShown((v) => !v)}
                value={password}
                onChangeText={(v) => { setPassword(v); setFieldError((f) => ({ ...f, password: undefined })) }}
                placeholder="Choose a password"
                autoComplete="password-new"
                textContentType="newPassword"
                invalid={!!fieldError.password}
                editable={!busy}
              />
            </AField>
            <Note>
              <NoteStrong>No email?</NoteStrong> Check spam, or <Link onPress={send}>send the link again</Link>.
            </Note>
          </>
        )}
      </ScrollView>

      <BottomBar insetBottom={insets.bottom + 14}>
        {stage === 'request' ? (
          <AButton label={busy ? 'Sending…' : 'Send reset link'} busy={busy} onPress={send} />
        ) : (
          <AButton label={busy ? 'Saving…' : 'Set new password'} busy={busy} onPress={reset} />
        )}
        <Swap lead="Remembered it?" action="Log in" onPress={onSignIn} />
      </BottomBar>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: A.gutter, paddingBottom: 24 },
  gap: { height: 12 },
  banner: { marginTop: 16 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: A.gutter, gap: 12 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fontFamilyNative.bodyBold, fontSize: 26, letterSpacing: -0.9, color: color.text },
  doneBody: { fontFamily: fontFamilyNative.body, fontSize: 16, lineHeight: 23, color: color.textMuted, textAlign: 'center' },
})
