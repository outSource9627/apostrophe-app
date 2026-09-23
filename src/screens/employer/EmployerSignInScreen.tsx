import React, { useRef, useState } from 'react'
import {
  Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, space } from '../../theme'
import { Banner, Body, Button, Display, Eyebrow, Field, Input, type BannerTone } from '../../components/ui'
import { TextAction } from '../../components/employer'
import { Logo } from '../../components/Logo'
import { ApiClientError, ErrorCode, tokenStore } from '../../lib/api'
import { logout, type Me } from '../../lib/api/account'
import { signInWithPassword } from '../../lib/api/employer'
import { CONNECTION_DROPPED, PasswordInput } from './EmployerRegisterScreen'

export interface EmployerSignInScreenProps {
  onBack: () => void
  onRegister: () => void
  /** Signed in. App routes on the role: EMPLOYER to EmployerHome, anyone else to their own home. */
  onSignedIn: (role: Me['role']) => void
}

type Errors = { email?: string; password?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TextInputRef = React.ComponentRef<typeof TextInput>

/**
 * Employer sign-in — the work email and password EM-02 set up.
 *
 * The password route is shared with students and interviewers, so the role is
 * read back before anything opens. An employer goes to their home. Anyone else
 * is told this sign-in is for employers: a student keeps the session they just
 * proved and is offered their own home; any other role is signed straight back
 * out, because nothing in this app is theirs.
 *
 * The same fields, refusals and copy as the web's /employers/signin. The one
 * action sits in a footer above the keyboard, where a thumb reaches it.
 */
export function EmployerSignInScreen({ onBack, onRegister, onSignedIn }: EmployerSignInScreenProps) {
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [refusal, setRefusal] = useState<{ tone: BannerTone; body: string; home?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const emailRef = useRef<TextInputRef>(null)
  const passwordRef = useRef<TextInputRef>(null)

  async function submit() {
    if (busy) return

    const found: Errors = {}
    if (!email.trim()) found.email = 'Enter your work email'
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
      const me = await signInWithPassword(email.trim().toLowerCase(), password)
      if (me.role === 'EMPLOYER') {
        onSignedIn(me.role)
        return
      }
      if (me.role === 'STUDENT') {
        setRefusal({ tone: 'info', body: 'This sign-in is for employers.', home: true })
      } else {
        await logout().catch(() => undefined)
        await tokenStore.clear()
        setRefusal({ tone: 'info', body: 'This sign-in is for employers.' })
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === ErrorCode.VALIDATION && err.fields) {
        setErrors({ email: err.fields.email, password: err.fields.password })
      } else if (err instanceof ApiClientError) {
        setRefusal({ tone: err.code === ErrorCode.RATE_LIMITED ? 'warning' : 'danger', body: err.message })
      } else {
        setRefusal({ tone: 'danger', body: CONNECTION_DROPPED })
      }
    }
    setBusy(false)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apostrophe, back"
          onPress={onBack}
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
        >
          <Logo size={18} />
        </Pressable>
        <View style={styles.grow} />
        <TextAction label="Create account" onPress={onRegister} style={styles.barAction} />
      </View>

      <ScrollView style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.title}>
          <Eyebrow>Employer account</Eyebrow>
          <Display level="lg" accessibilityRole="header">
            Sign in
          </Display>
          <Body tone="muted">The work email and password you created your account with.</Body>
        </View>

        {!!refusal && (
          <View accessibilityLiveRegion="polite">
            <Banner
              tone={refusal.tone}
              actionLabel={refusal.home ? 'Go to your home' : undefined}
              onAction={refusal.home ? () => onSignedIn('STUDENT') : undefined}
            >
              {refusal.body}
            </Banner>
          </View>
        )}

        <View style={styles.fields}>
          <Field label="Work email" error={errors.email}>
            <Input
              inputRef={emailRef}
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
              }}
              placeholder="you@yourcompany.in"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              accessibilityLabel="Work email"
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
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: space.lg + insets.bottom }]}>
        <Button variant="primary" size="lg" full busy={busy} label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },

  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  brand: { minHeight: height.tap, justifyContent: 'center' },
  barAction: { marginRight: -space.sm },

  body: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'], gap: space['2xl'] },
  title: { gap: space.sm },
  fields: { gap: space.xl },

  footer: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
  },
})
