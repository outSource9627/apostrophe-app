import React, { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  sendCandidateInterest,
  INTEREST_MESSAGE_MAX_LENGTH,
} from '../../lib/api/employerInterests'
import type { RootStackParamList } from '../../../App'

export function SendInterestModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'SendInterest'>>()
  const { candidateId, candidateName, candidateHeadline, candidateCity, jobs = [] } = route.params

  const [message, setMessage] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [cooldownError, setCooldownError] = useState<{ message: string; nextEligibleAt?: string } | null>(null)
  const [connectedError, setConnectedError] = useState<boolean>(false)
  const [genericError, setGenericError] = useState<string | null>(null)

  const handleSend = async () => {
    try {
      setSending(true)
      setCooldownError(null)
      setConnectedError(false)
      setGenericError(null)

      await sendCandidateInterest(candidateId, {
        message: message.trim() || undefined,
        jobId: selectedJobId || undefined,
      })

      navigation.goBack()
    } catch (err: unknown) {
      if (err && typeof err === 'object') {
        const errorObj = err as { code?: string; message?: string; details?: { reason?: string; threadId?: string; nextEligibleAt?: string } }
        if (errorObj.details?.reason === 'INTEREST_COOLDOWN' || errorObj.code === 'INTEREST_COOLDOWN') {
          setCooldownError({
            message: errorObj.message || 'You have already sent this candidate an Interest.',
            nextEligibleAt: errorObj.details?.nextEligibleAt,
          })
          return
        }
        if (errorObj.details?.reason === 'ALREADY_CONNECTED' || errorObj.code === 'ALREADY_CONNECTED') {
          setConnectedError(true)
          return
        }
      }
      setGenericError(err instanceof Error ? err.message : 'Could not send Interest.')
    } finally {
      setSending(false)
    }
  }

  return (
    <EmployerShell
      back={{ label: 'CANDIDATE', onPress: () => navigation.goBack() }}
      footer={
        <View style={styles.footRow}>
          {connectedError ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                navigation.goBack()
                // Navigation to chats
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Chat</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={sending || Boolean(cooldownError)}
              style={[styles.actionBtn, (sending || Boolean(cooldownError)) && styles.btnDisabled]}
            >
              {sending ? (
                <ActivityIndicator color={color.textInverse} size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Send Interest</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Candidate Target Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{candidateName}</Text>
          <Text style={styles.subtitle}>
            {[candidateHeadline, candidateCity].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Cooldown Refusal Notice */}
        {cooldownError && (
          <View style={styles.cooldownBox}>
            <Text style={styles.cooldownTitle}>Cooldown active</Text>
            <Text style={styles.cooldownBody}>{cooldownError.message}</Text>
            {cooldownError.nextEligibleAt && (
              <Text style={styles.cooldownDate}>
                Eligible again on {new Date(cooldownError.nextEligibleAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              </Text>
            )}
          </View>
        )}

        {/* Already Connected Notice */}
        {connectedError && (
          <View style={styles.connectedBox}>
            <Text style={styles.connectedTitle}>Already connected</Text>
            <Text style={styles.connectedBody}>
              You and {candidateName} already have an active conversation. You can message directly in chats.
            </Text>
          </View>
        )}

        {genericError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{genericError}</Text>
          </View>
        )}

        {!cooldownError && !connectedError && (
          <>
            {/* Rule Callout Banner */}
            <View style={styles.ruleBox}>
              <Text style={styles.ruleTitle}>Deliberate outreach</Text>
              <Text style={styles.ruleBody}>
                An Interest knocks on the candidate’s door with your company name. You can send 1 Interest to a candidate every 30 days.
              </Text>
            </View>

            {/* Optional Job Opening Selection */}
            {jobs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LINK TO JOB (OPTIONAL)</Text>
                <View style={styles.jobList}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedJobId('')}
                    style={[styles.jobOption, !selectedJobId && styles.jobOptionActive]}
                  >
                    <Text style={[styles.jobOptionText, !selectedJobId && styles.jobOptionTextActive]}>
                      General introduction (no opening)
                    </Text>
                  </TouchableOpacity>
                  {jobs.map((job) => {
                    const active = selectedJobId === job.id
                    return (
                      <TouchableOpacity
                        key={job.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedJobId(job.id)}
                        style={[styles.jobOption, active && styles.jobOptionActive]}
                      >
                        <Text style={[styles.jobOptionText, active && styles.jobOptionTextActive]}>
                          {job.title} ({job.location || 'Remote'})
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Personal Note */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>PERSONAL NOTE (OPTIONAL)</Text>
                <Text style={styles.counter}>
                  {message.length}/{INTEREST_MESSAGE_MAX_LENGTH}
                </Text>
              </View>
              <TextInput
                value={message}
                onChangeText={setMessage}
                maxLength={INTEREST_MESSAGE_MAX_LENGTH}
                multiline
                numberOfLines={4}
                placeholder="Mention why their profile stood out or what role you are hiring for…"
                placeholderTextColor={color.textMuted}
                style={styles.textArea}
              />
            </View>
          </>
        )}
      </ScrollView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.sm,
    paddingBottom: space.xl,
    gap: space.md,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    gap: 2,
  },
  name: {
    fontFamily: fontFamilyNative.display,
    fontSize: 20,
    color: color.text,
  },
  subtitle: {
    fontSize: 13,
    color: color.textMuted,
  },
  ruleBox: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 2,
  },
  ruleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  ruleBody: {
    fontSize: 12,
    color: color.textMuted,
    lineHeight: 16,
  },
  cooldownBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  cooldownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  cooldownBody: {
    fontSize: 13,
    color: color.textMuted,
  },
  cooldownDate: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textMuted,
    marginTop: 4,
  },
  connectedBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  connectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  connectedBody: {
    fontSize: 13,
    color: color.textMuted,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    padding: space.sm,
  },
  errorText: {
    fontSize: 12,
    color: color.danger,
  },
  section: {
    gap: space.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.textSubtle,
  },
  counter: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textMuted,
  },
  textArea: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    fontSize: 14,
    color: color.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  jobList: {
    gap: 6,
    marginTop: 4,
  },
  jobOption: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
  },
  jobOptionActive: {
    borderColor: color.text,
    backgroundColor: color.surfaceMuted,
  },
  jobOptionText: {
    fontSize: 13,
    color: color.textMuted,
  },
  jobOptionTextActive: {
    color: color.text,
    fontWeight: '600',
  },
  footRow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  actionBtn: {
    backgroundColor: color.text,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: color.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
})
