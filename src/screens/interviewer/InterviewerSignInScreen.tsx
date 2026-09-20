import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, opacity, space } from '../../theme'
import { Logo } from '../../components/Logo'
import { Button, Card, Eyebrow, Field, Input } from '../../components/ui'
import { interviewerApi } from '../../lib/api/interviewer'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'

export function InterviewerSignInScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { refresh } = useInterviewer()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter both your email address and password.')
      return
    }

    setLoading(true)
    try {
      const res = await interviewerApi.signIn({
        email: email.trim(),
        password,
      })

      if (res.mustChangePassword) {
        navigation.navigate('InterviewerPassword', { email: email.trim(), forced: true })
        return
      }

      await refresh()
      navigation.replace('InterviewerDashboard')
    } catch (err: any) {
      Alert.alert('Sign In Failed', err?.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bar}>
        <Logo size={18} />
        <Text style={styles.tag}>INTERVIEWER</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Eyebrow>INTERVIEWER PORTAL</Eyebrow>
          <Text style={styles.title}>Sign in to your account</Text>
          <Text style={styles.subtitle}>
            Manage your schedule, conduct video interviews, and view wallet earnings.
          </Text>
        </View>

        <Card style={styles.card}>
          <Field label="Interviewer Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="interviewer@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
          </Field>

          <View style={styles.forgotRow}>
            <Pressable
              onPress={() => navigation.navigate('InterviewerPassword', { email: email.trim(), reset: true })}
              hitSlop={8}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          <Button
            label={loading ? 'Signing in...' : 'Sign In'}
            variant="primary"
            disabled={loading}
            onPress={handleSignIn}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Want to evaluate candidates on Apostrophe?</Text>
          <Pressable
            onPress={() => navigation.navigate('JoinUs')}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.applyLink}>Learn more & apply to interview →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  tag: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '700',
    color: color.accent,
    letterSpacing: 1,
    paddingHorizontal: space['2xs'],
    paddingVertical: 2,
    backgroundColor: color.accentSubtle,
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
    paddingTop: space['2xl'],
  },
  header: {
    gap: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 26,
    fontWeight: '700',
    color: color.text,
  },
  subtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    lineHeight: 20,
  },
  card: {
    padding: space.lg,
    gap: space.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -space['2xs'],
  },
  forgotText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.accent,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
  },
  footerText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
  },
  applyLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.accent,
  },
})
