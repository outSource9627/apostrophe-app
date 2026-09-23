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
import { color, radius, space } from '../../theme'
import { AppBar, Body, Button, Card, Display, Eyebrow, Field, Input, SuccessState } from '../../components/ui'
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
        <AppBar title="Application Received" />

        <View style={styles.successContainer}>
          <SuccessState
            title="Thank You for Applying!"
            body="We have received your application to join the Apostrophe Interviewer Network. Our team will review your profile and experience within 2–3 business days."
            action={
              <View style={styles.successActions}>
                <Body size="xs" tone="subtle" style={styles.successNote}>
                  Once approved, you'll receive your credentials by email to set your password, define your weekly availability, and start conducting sessions.
                </Body>
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
            }
          />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBar onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Eyebrow>APPLY TO INTERVIEW</Eyebrow>
          <Display level="lg">Interviewer Application</Display>
          <Body tone="muted">
            Fill out your details below. We review candidates based on hands-on industry experience, technical depth, and evaluation empathy.
          </Body>
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
  formCard: {
    padding: space.lg,
    gap: space.md,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  successNote: {
    textAlign: 'center',
    backgroundColor: color.surfaceSubtle,
    padding: space.md,
    borderRadius: radius.md,
  },
  successActions: {
    width: '100%',
    gap: space.sm,
    marginTop: space.sm,
  },
})
