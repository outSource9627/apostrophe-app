import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
import { AppBar, Body, Button, Card, Display, Eyebrow, Field, Input, SuccessState } from '../../components/ui'
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
      <AppBar title="Password" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Eyebrow>{isReset ? 'FORGOT PASSWORD' : 'SET PASSWORD'}</Eyebrow>
          <Display level="lg">
            {isReset
              ? 'Reset Your Password'
              : isForced
              ? 'Create New Password'
              : 'Update Account Password'}
          </Display>
          <Body tone="muted">
            {isReset
              ? 'Enter the email address registered with your interviewer profile to receive recovery instructions.'
              : isForced
              ? 'For your security, you must update your temporary password before accessing the interviewer portal.'
              : 'Choose a strong password with at least 8 characters.'}
          </Body>
        </View>

        {isReset ? (
          resetSent ? (
            <Card>
              <SuccessState
                title="Reset Instructions Sent"
                body={`If an interviewer account exists for ${email}, a password reset link has been dispatched to your inbox.`}
                action={
                  <Button
                    label="Return to Sign In"
                    variant="primary"
                    onPress={() => navigation.replace('InterviewerSignIn')}
                  />
                }
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
  card: {
    padding: space.lg,
    gap: space.md,
  },
})
