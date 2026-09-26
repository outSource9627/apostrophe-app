import React, { useRef, useState } from 'react'
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space, spaceHalf } from '../../theme'
import { Banner, Body, Button, Field, Input, type BannerTone } from '../../components/ui'
import { EmBar, EmFoot, EmTitle } from '../../components/employer/em'
import { TextAction } from '../../components/employer'
import { CONNECTION_DROPPED, PasswordInput } from '../employer/EmployerRegisterScreen'
import { ApiClientError, ErrorCode, tokenStore } from '../../lib/api'
import { logout } from '../../lib/api/account'
import { loginInterviewerPassword } from '../../lib/api/interviewer'
import { useForgetInterviewer } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Errors = { email?: string; password?: string }
type TextInputRef = React.ComponentRef<typeof TextInput>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Interviewer sign-in (no artboard — the drawn screens' language). The email
 * and the password an admin sent. Nothing is fetched before the server has
 * answered: a temporary password goes straight to the forced change (the
 * server refuses every other interviewer call until it is made), anything
 * else opens the dashboard. The route is shared by every role, so a student or
 * employer who lands here is signed back out and pointed at the main sign-in.
 */
export function InterviewerSignInScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const forget = useForgetInterviewer()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [refusal, setRefusal] = useState<{ tone: BannerTone; body: string; main?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<TextInputRef>(null)
  const passwordRef = useRef<TextInputRef>(null)

  async function submit() {
    if (busy) return
    const found: Errors = {}
    if (!email.trim()) found.email = 'Enter your email'
    else if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address'
    if (!password) found.password = 'Enter your password'
    setErrors(found)
    setRefusal(null)
    if (found.email || found.password) {
      ;(found.email ? emailRef : passwordRef).current?.focus()
      return
    }

    setBusy(true)
    Keyboard.dismiss()
    try {
      const r = await loginInterviewerPassword({ email: email.trim().toLowerCase(), password })
      if (r.user.role !== 'INTERVIEWER') {
        await logout().catch(() => undefined)
        await tokenStore.clear()
        setRefusal({ tone: 'info', body: 'This sign-in is for interviewers.', main: true })
        setBusy(false)
        return
      }
      forget()
      navigation.reset({
        index: 0,
        routes: [r.mustChangePassword ? { name: 'InterviewerPassword', params: { forced: true } } : { name: 'InterviewerDashboard' }],
      })
    } catch (err) {
      if (err instanceof ApiClientError && err.code === ErrorCode.VALIDATION && err.fields) {
        setErrors({ email: err.fields.email, password: err.fields.password })
      } else if (err instanceof ApiClientError) {
        setRefusal({ tone: err.code === ErrorCode.RATE_LIMITED ? 'warning' : 'danger', body: err.message })
      } else {
        setRefusal({ tone: 'danger', body: CONNECTION_DROPPED })
      }
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <EmBar onBack={() => navigation.goBack()} />
      <ScrollView style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <EmTitle eyebrow="Interviewer" title="Sign in" sub="The email and password Apostrophe sent you." />

        {!!refusal && (
          <View accessibilityLiveRegion="polite">
            <Banner
              tone={refusal.tone}
              actionLabel={refusal.main ? 'Go to the main sign-in' : undefined}
              onAction={refusal.main ? () => navigation.navigate('SignIn') : undefined}
            >
              {refusal.body}
            </Banner>
          </View>
        )}

        <View style={styles.fields}>
          <Field label="Email" error={errors.email}>
            <Input
              inputRef={emailRef}
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              accessibilityLabel="Email"
              invalid={!!errors.email}
              editable={!busy}
            />
          </Field>
          <Field label="Password" error={errors.password}>
            <PasswordInput
              inputRef={passwordRef}
              shown={shown}
              onToggle={() => setShown((s) => !s)}
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
              }}
              placeholder="Your password"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
              invalid={!!errors.password}
              editable={!busy}
            />
          </Field>
          <View style={styles.forgotRow}>
            <TextAction label="Forgot password?" underline={false} onPress={() => navigation.navigate('InterviewerPassword', { email: email.trim() || undefined, reset: true })} />
          </View>
          <View style={styles.newRow}>
            <Body size="sm" tone="muted">Not an interviewer yet?</Body>
            <TextAction label="Apply to interview" underline={false} onPress={() => navigation.navigate('JoinUs')} />
          </View>
        </View>
      </ScrollView>
      <EmFoot>
        <View style={styles.grow}>
          <Button variant="primary" size="lg" full busy={busy} label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} />
        </View>
      </EmFoot>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['4.5'] },
  fields: { gap: spaceHalf['4.5'] },
  forgotRow: { alignItems: 'flex-end' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
})
