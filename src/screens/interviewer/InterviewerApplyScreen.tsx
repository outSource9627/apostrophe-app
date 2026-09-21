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
import { borderWidth, color, fontFamilyNative, height, opacity, radius, space } from '../../theme'
import { Button, Card, Eyebrow, Field, Input } from '../../components/ui'
import { interviewerApi } from '../../lib/api/interviewer'

export function InterviewerApplyScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [currentCompany, setCurrentCompany] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [domain, setDomain] = useState('')
  const [bio, setBio] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !linkedinUrl.trim()) {
      Alert.alert('Required Fields', 'Please complete all required fields (Name, Email, Phone, LinkedIn).')
      return
    }

    setSubmitting(true)
    try {
      await interviewerApi.apply({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || undefined,
        linkedinUrl: linkedinUrl.trim(),
        currentCompany: currentCompany.trim() || undefined,
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : undefined,
        domain: domain.trim() || undefined,
        bio: bio.trim() || undefined,
        resumeUrl: resumeUrl.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err: any) {
      Alert.alert('Application Error', err?.message || 'Unable to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Text style={styles.headerTitle}>Application Received</Text>
        </View>

        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>Thank You for Applying!</Text>
          <Text style={styles.successBody}>
            We have received your application to join the Apostrophe Interviewer Network. Our team will review your profile and experience within 2–3 business days.
          </Text>
          <Text style={styles.successNote}>
            Once approved, you'll receive your credentials by email to set your password, define your weekly availability, and start conducting sessions.
          </Text>

          <View style={styles.successActions}>
            <Button
              label="Return to Overview"
              variant="secondary"
              onPress={() => navigation.navigate('JoinUs')}
            />
            <Button
              label="Go to Sign In"
              variant="primary"
              onPress={() => navigation.navigate('InterviewerSignIn')}
            />
          </View>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Bar */}
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Eyebrow>APPLY TO INTERVIEW</Eyebrow>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.title}>Interviewer Application</Text>
          <Text style={styles.subtitle}>
            Fill out your details below. We review candidates based on hands-on industry experience, technical depth, and evaluation empathy.
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Field label="Full Name *">
            <Input
              value={name}
              onChangeText={setName}
              placeholder="e.g. Priyanshu Sharma"
              autoCapitalize="words"
            />
          </Field>

          <Field label="Email Address *">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="priyanshu@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <Field label="Phone Number *">
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
          </Field>

          <Field label="City">
            <Input
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Bengaluru, Karnataka"
            />
          </Field>

          <Field label="LinkedIn Profile URL *">
            <Input
              value={linkedinUrl}
              onChangeText={setLinkedinUrl}
              placeholder="https://linkedin.com/in/username"
              keyboardType="url"
              autoCapitalize="none"
            />
          </Field>

          <Field label="Current Company / Role">
            <Input
              value={currentCompany}
              onChangeText={setCurrentCompany}
              placeholder="e.g. Senior Backend Engineer at Acme"
            />
          </Field>

          <Field label="Years of Experience">
            <Input
              value={experienceYears}
              onChangeText={setExperienceYears}
              placeholder="e.g. 5"
              keyboardType="number-pad"
            />
          </Field>

          <Field label="Primary Domain / Expertise">
            <Input
              value={domain}
              onChangeText={setDomain}
              placeholder="e.g. Distributed Systems, Frontend (React), Data Eng"
            />
          </Field>

          <Field label="Resume / Portfolio Link">
            <Input
              value={resumeUrl}
              onChangeText={setResumeUrl}
              placeholder="https://drive.google.com/... or resume URL"
              keyboardType="url"
              autoCapitalize="none"
            />
          </Field>

          <Field label="Brief Bio / Interviewing Philosophy">
            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us briefly about your engineering background and how you evaluate candidates."
              multiline
              numberOfLines={4}
            />
          </Field>

          <Button
            label={submitting ? 'Submitting...' : 'Submit Application'}
            variant="primary"
            disabled={submitting}
            onPress={handleSubmit}
          />
        </Card>
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
  headerTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '600',
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
    gap: space.lg,
  },
  intro: {
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
  formCard: {
    padding: space.lg,
    gap: space.md,
  },
  successContainer: {
    flex: 1,
    padding: space['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  successIcon: {
    fontSize: 54,
  },
  successTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 22,
    fontWeight: '700',
    color: color.text,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 15,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  successNote: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textSubtle,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: color.surfaceSubtle,
    padding: space.md,
    borderRadius: radius.md,
  },
  successActions: {
    width: '100%',
    gap: space.sm,
    marginTop: space.lg,
  },
})
