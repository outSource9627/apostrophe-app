import React, { useState, useEffect, useCallback } from 'react'
import { Alert, Image, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  DisabledAction,
  Display,
  Divider,
  Eyebrow,
  EmptyState,
  ErrorState,
  ObjectRow,
  Skeleton,
  StatusPill,
  Tag,
  VerifiedSeal,
} from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  fetchApplicationDetail,
  updateApplicationStatus,
  type ApplicationDetail,
  type ApplicationStatus,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

/**
 * Each application's stage, as the header's pill: label and tone. Same map as
 * the applicants list (JobApplicationsScreen) — never the accent, a pipeline
 * stage is a status badge, not one of red's four jobs.
 */
const STATUS_PILL: Record<ApplicationStatus, Tone> = {
  APPLIED: 'neutral',
  VIEWED: 'info',
  SHORTLISTED: 'warning',
  CONNECTED: 'success',
  REJECTED: 'danger',
}

export function ApplicantDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'ApplicantDetail'>>()
  const { id } = route.params

  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadApplication = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchApplicationDetail(id)
      setApplication(data)
    } catch (err) {
      console.error('Failed to load application', err)
      setError(err instanceof Error ? err : new Error('We could not load this applicant.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadApplication()
  }, [loadApplication])

  const handleStatusMove = async (to: 'SHORTLISTED' | 'REJECTED' | 'CONNECTED', reason?: string) => {
    if (!application) return
    try {
      setActionLoading(true)
      await updateApplicationStatus(id, {
        to,
        from: application.status,
        reason,
      })
      loadApplication()
    } catch (err) {
      console.error('Failed to update application status', err)
    } finally {
      setActionLoading(false)
    }
  }

  const promptDecline = () => {
    Alert.prompt
      ? Alert.prompt(
          'Decline application',
          'Optionally enter a feedback reason for the candidate:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Decline',
              style: 'destructive',
              onPress: (reason) => handleStatusMove('REJECTED', reason?.trim() || undefined),
            },
          ],
        )
      : Alert.alert('Decline application', 'Are you sure you want to decline this candidate?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => handleStatusMove('REJECTED'),
          },
        ])
  }

  const candidate = application?.candidate

  return (
    <EmployerShell
      back={{ label: 'APPLICANTS', onPress: () => navigation.goBack() }}
      footer={
        application ? (
          application.status === 'CONNECTED' ? (
            <Button variant="secondary" size="lg" full label="Open Chat →" />
          ) : (
            <View style={styles.actionButtonsRow}>
              {application.status !== 'SHORTLISTED' && (
                <Button
                  variant="outline"
                  size="lg"
                  style={styles.flex1}
                  disabled={actionLoading}
                  label="Shortlist"
                  onPress={() => handleStatusMove('SHORTLISTED')}
                />
              )}

              {candidate?.available === false ? (
                <View style={styles.flex2}>
                  <DisabledAction
                    tone="neutral"
                    action={<Button variant="secondary" size="lg" full disabled label="Connect & Chat" />}
                    reason="This candidate is no longer available to connect with."
                  />
                </View>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  style={styles.flex2}
                  disabled={actionLoading}
                  label="Connect & Chat"
                  onPress={() => handleStatusMove('CONNECTED')}
                />
              )}

              {application.status !== 'REJECTED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading}
                  label="Decline"
                  onPress={promptDecline}
                />
              )}
            </View>
          )
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load this applicant."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={loadApplication} />}
        />
      ) : !application ? (
        <EmptyState
          title="Application not found"
          body="This application may have been withdrawn or removed."
        />
      ) : (
        <>
          {/* Candidate Header */}
          <View style={styles.header}>
            <View style={styles.avatarRow}>
              {/* Poster thumbnail — no shared avatar primitive exists yet, so this
                  stays a themed box, same as the applicants list card. */}
              <View style={styles.posterBox}>
                {candidate?.photoUrl ? (
                  <Image source={{ uri: candidate.photoUrl }} style={styles.posterImg} />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Display level="xs">{candidate?.name?.charAt(0) || 'C'}</Display>
                  </View>
                )}
              </View>

              <View style={styles.headerInfo}>
                <Display level="sm">{candidate?.name || 'Candidate'}</Display>
                <Body size="xs" tone="muted">
                  {[candidate?.qualification, candidate?.city, `${candidate?.experienceYears ?? 0}y exp`]
                    .filter(Boolean)
                    .join(' · ')}
                </Body>
                <View style={styles.subRow}>
                  <StatusPill tone={STATUS_PILL[application.status]} label={application.statusLabel} />
                  {candidate?.verifiedInterview?.verified && (
                    <VerifiedSeal
                      date={
                        candidate.verifiedInterview.at
                          ? new Date(candidate.verifiedInterview.at).toLocaleDateString('en-IN', {
                              dateStyle: 'medium',
                            })
                          : undefined
                      }
                    />
                  )}
                </View>
              </View>
            </View>

            <Body size="xs" tone="muted">
              Applied for{' '}
              <Body size="xs" weight="semibold">
                {application.job.title}
              </Body>{' '}
              on {new Date(application.appliedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Body>
          </View>
          <Divider />

          {/* Note from Candidate */}
          {application.message && (
            <View style={styles.section}>
              <Eyebrow>Note from candidate</Eyebrow>
              <Card style={styles.messageCard}>
                <Body size="sm" style={styles.messageBody}>
                  &ldquo;{application.message}&rdquo;
                </Body>
              </Card>
            </View>
          )}

          {/* Skills */}
          {candidate?.skills && candidate.skills.length > 0 && (
            <View style={styles.section}>
              <Eyebrow>Key skills</Eyebrow>
              <View style={styles.skillWrap}>
                {candidate.skills.map((s) => (
                  <Tag key={s} label={s} />
                ))}
              </View>
            </View>
          )}

          {/* Candidate Profile Link */}
          {candidate?.id && (
            <Card style={styles.profileLinkCard}>
              <ObjectRow
                last
                title="View full candidate profile & video"
                status={
                  <Body size="sm" tone="muted">
                    →
                  </Body>
                }
                onPress={() => navigation.navigate('CandidateProfile', { id: candidate.id })}
              />
            </Card>
          )}
        </>
      )}
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space.xs,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  posterBox: {
    width: 52,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  section: {
    gap: space.xs,
  },
  messageCard: {
    padding: space.sm,
  },
  messageBody: {
    fontStyle: 'italic',
  },
  skillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  profileLinkCard: {
    overflow: 'hidden',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
})
