import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import { Banner, Body, Button, Card, Chip, Display, Divider, Field, Input } from '../../components/ui'
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
            <Button
              variant="primary"
              size="block"
              full
              label="Open Chat"
              onPress={() => {
                navigation.goBack()
                // Navigation to chats
              }}
            />
          ) : (
            <Button
              variant="primary"
              size="block"
              full
              busy={sending}
              disabled={Boolean(cooldownError)}
              label="Send Interest"
              onPress={handleSend}
            />
          )}
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Candidate Target Header */}
        <View style={styles.header}>
          <Display level="sm">{candidateName}</Display>
          <Body size="sm" tone="muted">
            {[candidateHeadline, candidateCity].filter(Boolean).join(' · ')}
          </Body>
        </View>
        <Divider />

        {/* Cooldown Refusal Notice */}
        {cooldownError && (
          <Banner
            tone="warning"
            title="Cooldown active"
            reference={
              cooldownError.nextEligibleAt
                ? `Eligible again on ${new Date(cooldownError.nextEligibleAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}`
                : undefined
            }
          >
            {cooldownError.message}
          </Banner>
        )}

        {/* Already Connected Notice */}
        {connectedError && (
          <Banner tone="success" title="Already connected">
            {`You and ${candidateName} already have an active conversation. You can message directly in chats.`}
          </Banner>
        )}

        {genericError && <Banner tone="danger">{genericError}</Banner>}

        {!cooldownError && !connectedError && (
          <>
            {/* Rule Callout Banner */}
            <Banner tone="neutral" title="Deliberate outreach">
              An Interest knocks on the candidate’s door with your company name. You can send 1 Interest to a candidate every 30 days.
            </Banner>

            <Card style={styles.card}>
              {/* Optional Job Opening Selection */}
              {jobs.length > 0 && (
                <Field label="Link to job (optional)">
                  <View style={styles.chipWrap}>
                    <Chip
                      label="General introduction (no opening)"
                      selected={!selectedJobId}
                      onPress={() => setSelectedJobId('')}
                    />
                    {jobs.map((job) => (
                      <Chip
                        key={job.id}
                        label={`${job.title} (${job.location || 'Remote'})`}
                        selected={selectedJobId === job.id}
                        onPress={() => setSelectedJobId(job.id)}
                      />
                    ))}
                  </View>
                </Field>
              )}

              {/* Personal Note */}
              <Field label="Personal note (optional)" helper={`${message.length}/${INTEREST_MESSAGE_MAX_LENGTH} characters`}>
                <Input
                  value={message}
                  onChangeText={setMessage}
                  maxLength={INTEREST_MESSAGE_MAX_LENGTH}
                  multiline
                  numberOfLines={4}
                  placeholder="Mention why their profile stood out or what role you are hiring for…"
                />
              </Field>
            </Card>
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
    gap: space['2xs'],
  },
  card: {
    padding: space.xl,
    gap: space.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  footRow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
})
