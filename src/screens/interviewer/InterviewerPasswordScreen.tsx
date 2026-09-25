import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space, spaceHalf } from '../../theme'
import { Banner, Body, Button, Field, Input } from '../../components/ui'
import { EmBar, EmCard, EmDone, EmFoot, EmTitle } from '../../components/employer/em'
import { CONNECTION_DROPPED, PasswordInput } from '../employer/EmployerRegisterScreen'
import { ApiClientError, tokenStore } from '../../lib/api'
import { logout, requestPasswordReset, resetPassword } from '../../lib/api/account'
import { changeInterviewerPassword } from '../../lib/api/interviewer'
import { useForgetInterviewer } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** The server's floor and ceiling (contracts: changePasswordInput, resetPasswordInput). */
const MIN_PASSWORD = 10
const MAX_PASSWORD = 128

type Stage = 'change' | 'request' | 'reset' | 'done'
type Errs = { email?: string; current?: string; next?: string; confirm?: string; token?: string }

/**
 * Password (no artboard — the drawn screens' language). Three ways in:
 *  - forced: a temporary password from the admin. The server refuses every
 *    other interviewer call until it is changed, and it still asks for the
 *    temporary one (proving you hold the emailed credential is the point).
 *  - change: from Account, the same form.
 *  - reset: "Forgot password?" — POST /auth/password/forgot mails a code, and
 *    the code with a new password goes to /auth/password/reset.
 * A change signs every session out, this one included, so both end on
 * "sign in again".
 */
export function InterviewerPasswordScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerPassword'>>()
  const forced = !!route.params?.forced
  const forget = useForgetInterviewer()
  const [stage, setStage] = useState<Stage>(route.params?.reset ? 'request' : 'change')
  const [email, setEmail] = useState(route.params?.email ?? '')
  const [token, setToken] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errs, setErrs] = useState<Errs>({})
  const [error, setError] = useState<string | null>(null)
  const [sentLine, setSentLine] = useState<string | null>(null)

  const toSignIn = () => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }, { name: 'InterviewerSignIn' }] })

  async function signOut() {
    setBusy(true)
    await logout().catch(() => undefined)
    await tokenStore.clear()
    forget()
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
  }

  function checkNew(withCurrent: boolean): Errs {
    const e: Errs = {}
    if (withCurrent && !current) e.current = forced ? 'Enter the temporary password from the email' : 'Enter your current password'
    if (next.length < MIN_PASSWORD) e.next = `Use at least ${MIN_PASSWORD} characters`
    else if (next.length > MAX_PASSWORD) e.next = `Use at most ${MAX_PASSWORD} characters`
    else if (withCurrent && next === current) e.next = 'Choose a password you have not used here before'
    if (!e.next && confirm !== next) e.confirm = 'The two passwords don’t match'
    return e
  }

  async function change() {
    const e = checkNew(true)
    setErrs(e)
    setError(null)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await changeInterviewerPassword({ currentPassword: current, newPassword: next })
      // The server ended every session; this phone's tokens are dead too.
      await tokenStore.clear()
      forget()
      setStage('done')
    } catch (err) {
      if (err instanceof ApiClientError && err.fields && (err.fields.currentPassword || err.fields.newPassword)) {
        setErrs({ current: err.fields.currentPassword ? err.message : undefined, next: err.fields.newPassword })
      } else {
        setError(err instanceof ApiClientError ? err.message : CONNECTION_DROPPED)
      }
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!EMAIL_RE.test(email.trim())) {
      setErrs({ email: 'Enter your email' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await requestPasswordReset(email.trim().toLowerCase())
      setSentLine(r.message)
      setErrs({})
      setStage('reset')
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : CONNECTION_DROPPED)
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    const e = checkNew(false)
    if (token.trim().length < 10) e.token = 'Paste the reset code from the email'
    setErrs(e)
    setError(null)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await resetPassword(token.trim(), next)
      await tokenStore.clear()
      forget()
      setStage('done')
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : CONNECTION_DROPPED)
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'done') {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <EmBar />
        <View style={styles.centre}>
          <EmDone
            icon="check"
            tone="green"
            title="Password changed."
            body="Sign in with your new password. Every device, this one included, was signed out."
            actions={<View style={styles.grow}><Button variant="primary" size="lg" full label="Sign in" onPress={toSignIn} /></View>}
          />
        </View>
      </View>
    )
  }

  const pwField = (label: string, value: string, set: (v: string) => void, key: 'current' | 'next' | 'confirm', helper?: string, auto: 'current-password' | 'new-password' = 'new-password') => (
    <Field label={label} helper={helper} error={errs[key]}>
      <PasswordInput
        shown={shown}
        onToggle={() => setShown((s) => !s)}
        value={value}
        onChangeText={(v) => {
          set(v)
          if (errs[key]) setErrs((x) => ({ ...x, [key]: undefined }))
        }}
        autoComplete={auto}
        textContentType={auto === 'current-password' ? 'password' : 'newPassword'}
        accessibilityLabel={label}
        invalid={!!errs[key]}
        editable={!busy}
      />
    </Field>
  )

  const onBack = forced ? () => { signOut() } : stage === 'reset' ? () => setStage('request') : () => navigation.goBack()

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <EmBar onBack={onBack} />
      <ScrollView style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 'change' ? (
          <>
            <EmTitle
              eyebrow="Interviewer"
              title={forced ? 'Set your own password' : 'Change password'}
              sub={forced ? 'The password in your welcome email was temporary. Choose your own before you start.' : 'Every device you are signed in on will be signed out.'}
            />
            {!!error && <Banner tone="danger">{error}</Banner>}
            <View style={styles.fields}>
              {pwField(forced ? 'Temporary password' : 'Current password', current, setCurrent, 'current', undefined, 'current-password')}
              {pwField('New password', next, setNext, 'next', `At least ${MIN_PASSWORD} characters`)}
              {pwField('Confirm new password', confirm, setConfirm, 'confirm')}
            </View>
            {forced && <Body size="sm" tone="muted">{'Not now? Going back signs you out.'}</Body>}
          </>
        ) : stage === 'request' ? (
          <>
            <EmTitle eyebrow="Interviewer" title="Reset your password" sub="Enter the email your interviewer account uses. We’ll email you a code to set a new password." />
            {!!error && <Banner tone="danger">{error}</Banner>}
            <Field label="Email" error={errs.email}>
              <Input
                value={email}
                onChangeText={(v) => { setEmail(v); setErrs({}) }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={send}
                invalid={!!errs.email}
                editable={!busy}
              />
            </Field>
          </>
        ) : (
          <>
            <EmTitle eyebrow="Interviewer" title="Check your email." sub={sentLine ?? undefined} />
            {!!error && <Banner tone="danger">{error}</Banner>}
            <EmCard style={styles.card}>
              <Body size="md" weight="semibold">Set a new password</Body>
              <Body size="sm" tone="muted">Paste the reset code from the email, then choose a new password.</Body>
              <Field label="Reset code" error={errs.token}>
                <Input
                  value={token}
                  onChangeText={(v) => { setToken(v); setErrs((x) => ({ ...x, token: undefined })) }}
                  placeholder="From the email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  invalid={!!errs.token}
                  editable={!busy}
                />
              </Field>
              {pwField('New password', next, setNext, 'next', `At least ${MIN_PASSWORD} characters`)}
              {pwField('Confirm new password', confirm, setConfirm, 'confirm')}
            </EmCard>
          </>
        )}
      </ScrollView>
      <EmFoot>
        <View style={styles.grow}>
          {stage === 'change' && <Button variant="primary" size="lg" full busy={busy} label="Save new password" onPress={change} />}
          {stage === 'request' && <Button variant="primary" size="lg" full busy={busy} label="Email me a code" onPress={send} />}
          {stage === 'reset' && <Button variant="primary" size="lg" full busy={busy} label="Set new password" onPress={reset} />}
        </View>
      </EmFoot>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['4.5'] },
  fields: { gap: spaceHalf['4.5'] },
  card: { gap: space.md },
})
