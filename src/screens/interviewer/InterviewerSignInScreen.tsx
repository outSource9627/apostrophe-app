import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, space } from '../../theme'
import { Logo } from '../../components/Logo'
import { Body, Button, Card, Display, Eyebrow, Field, Input, Tag } from '../../components/ui'
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
        <Tag label="INTERVIEWER" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Eyebrow>INTERVIEWER PORTAL</Eyebrow>
          <Display level="md">Sign in to your account</Display>
          <Body size="md" tone="muted">
            Manage your schedule, conduct video interviews, and view wallet earnings.
          </Body>
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
            <Button
              variant="text"
              size="sm"
              label="Forgot password?"
              onPress={() => navigation.navigate('InterviewerPassword', { email: email.trim(), reset: true })}
            />
          </View>

          <Button
            label={loading ? 'Signing in...' : 'Sign In'}
            variant="primary"
            disabled={loading}
            onPress={handleSignIn}
          />
        </Card>

        <View style={styles.footer}>
          <Body size="md" tone="muted">Want to evaluate candidates on Apostrophe?</Body>
          <Button
            variant="text"
            size="md"
            label="Learn more & apply to interview →"
            onPress={() => navigation.navigate('JoinUs')}
          />
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
  card: {
    padding: space.lg,
    gap: space.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -space['2xs'],
  },
  footer: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
  },
})
