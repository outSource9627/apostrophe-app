import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiClientError } from '../../lib/api'
import { requestPasswordReset, resetPassword } from '../../lib/api/account'
import { color, space, spaceHalf } from '../../theme'
import { Banner, Body, Button, Field, Input } from '../../components/ui'
import { EmBar, EmCard, EmDone, EmFoot, EmTitle } from '../../components/employer/em'
import { PasswordInput } from './EmployerRegisterScreen'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 10

/**
 * Forgot password (the design's "Forgot password?" on EM-01b). Two server
 * calls: POST /auth/password/forgot mails a link carrying a token, and
 * POST /auth/password/reset takes that token with the new password. The
 * request never says whether the account exists. The reset code is pasted from
 * the email, so this works whether or not the app can open the link itself.
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
    if (!EMAIL_RE.test(email.trim())) { setFieldError({ email: 'Enter your work email' }); return }
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
        <EmBar onBack={onSignIn} />
        <View style={styles.centre}>
          <EmDone
            icon="check"
            tone="green"
            title="Password changed."
            body="Sign in with your new password. Every other device was signed out."
            actions={<View style={styles.grow}><Button variant="secondary" size="lg" full label="Sign in" onPress={onSignIn} /></View>}
          />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <EmBar onBack={stage === 'reset' ? () => setStage('request') : onBack} />
      <ScrollView style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 'request' ? (
          <>
            <EmTitle eyebrow="Employer account" title="Reset your password" sub="Enter the work email you signed up with. We’ll email you a link to set a new password." />
            {!!error && <Banner tone="danger">{error}</Banner>}
            <Field label="Work email" error={fieldError.email}>
              <Input
                value={email}
                onChangeText={(v) => { setEmail(v); setFieldError({}) }}
                placeholder="you@company.in"
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
            </Field>
          </>
        ) : (
          <>
            <EmTitle eyebrow="Employer account" title="Check your email." sub={sentLine ?? undefined} />
            {!!error && <Banner tone="danger">{error}</Banner>}
            <EmCard style={styles.card}>
              <Body size="md" weight="semibold">Set a new password</Body>
              <Body size="sm" tone="muted">Paste the reset code from the email, then choose a new password.</Body>
              <Field label="Reset code" error={fieldError.token}>
                <Input
                  value={token}
                  onChangeText={(v) => { setToken(v); setFieldError((f) => ({ ...f, token: undefined })) }}
                  placeholder="From the email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  invalid={!!fieldError.token}
                  editable={!busy}
                />
              </Field>
              <Field label="New password" helper={`At least ${MIN_PASSWORD} characters`} error={fieldError.password}>
                <PasswordInput
                  shown={shown}
                  onToggle={() => setShown((s) => !s)}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setFieldError((f) => ({ ...f, password: undefined })) }}
                  placeholder="Choose a password"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  invalid={!!fieldError.password}
                  editable={!busy}
                />
              </Field>
            </EmCard>
            <Button variant="text" size="md" label="Send the link again" disabled={busy} onPress={send} />
          </>
        )}
      </ScrollView>
      <EmFoot>
        <View style={styles.grow}>
          {stage === 'request' ? (
            <Button variant="primary" size="lg" full busy={busy} label="Send reset link" onPress={send} />
          ) : (
            <Button variant="primary" size="lg" full busy={busy} label="Set new password" onPress={reset} />
          )}
        </View>
      </EmFoot>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['4.5'] },
  card: { gap: space.md, padding: space.lg },
})
