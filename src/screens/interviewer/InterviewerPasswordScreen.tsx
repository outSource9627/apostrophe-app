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
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, opacity, space } from '../../theme'
import { Button, Card, Eyebrow, Field, Input } from '../../components/ui'
import { interviewerApi } from '../../lib/api/interviewer'

export function InterviewerPasswordScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const route = useRoute<any>()

  const isForced = route.params?.forced ?? false
  const isReset = route.params?.reset ?? false
  const initialEmail = route.params?.email ?? ''

  const [email, setEmail] = useState(initialEmail)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password do not match.')
      return
    }

    setLoading(true)
    try {
      await interviewerApi.updatePassword({
        currentPassword: currentPassword || '',
        newPassword,
      })
      Alert.alert('Success', 'Password updated successfully. Please sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.replace('InterviewerSignIn') },
      ])
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Unable to update password. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to receive reset instructions.')
      return
    }

    setLoading(true)
    try {
      await interviewerApi.forgotPassword(email.trim())
      setResetSent(true)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to request password reset.')
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
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Eyebrow>{isReset ? 'FORGOT PASSWORD' : 'SET PASSWORD'}</Eyebrow>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {isReset
              ? 'Reset Your Password'
              : isForced
              ? 'Create New Password'
              : 'Update Account Password'}
          </Text>
          <Text style={styles.subtitle}>
            {isReset
              ? 'Enter the email address registered with your interviewer profile to receive recovery instructions.'
              : isForced
              ? 'For your security, you must update your temporary password before accessing the interviewer portal.'
              : 'Choose a strong password with at least 8 characters.'}
          </Text>
        </View>

        {isReset ? (
          resetSent ? (
            <Card style={styles.card}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.cardTitle}>Reset Instructions Sent</Text>
              <Text style={styles.cardDesc}>
                If an interviewer account exists for {email}, a password reset link has been dispatched to your inbox.
              </Text>
              <Button
                label="Return to Sign In"
                variant="primary"
                onPress={() => navigation.replace('InterviewerSignIn')}
              />
            </Card>
          ) : (
            <Card style={styles.card}>
              <Field label="Interviewer Email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="interviewer@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>

              <Button
                label={loading ? 'Sending Instructions...' : 'Send Reset Link'}
                variant="primary"
                disabled={loading}
                onPress={handleRequestReset}
              />
            </Card>
          )
        ) : (
          <Card style={styles.card}>
            {!isForced && (
              <Field label="Current Password">
                <Input
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="••••••••••••"
                  secureTextEntry
                />
              </Field>
            )}

            <Field label="New Password (min 8 chars)">
              <Input
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••••••"
                secureTextEntry
              />
            </Field>

            <Field label="Confirm New Password">
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••••••"
                secureTextEntry
              />
            </Field>

            <Button
              label={loading ? 'Updating Password...' : 'Save New Password'}
              variant="primary"
              disabled={loading}
              onPress={handleUpdatePassword}
            />
          </Card>
        )}
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
  backBtn: {
    width: height.tap,
    height: height.tap,
    marginLeft: -space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: color.text,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
    paddingTop: space.xl,
  },
  header: {
    gap: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
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
  cardTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 18,
    fontWeight: '700',
    color: color.text,
    textAlign: 'center',
  },
  cardDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  successIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: space['2xs'],
  },
})
