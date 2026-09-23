import React, { useState, useEffect, useCallback } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Skeleton,
  StatusPill,
  VerifiedSeal,
} from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  fetchJobApplications,
  updateApplicationStatus,
  type ApplicationRow,
  type ApplicationStatus,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

/**
 * Each application's stage, as the card's pill: label and tone. Never the
 * accent — a pipeline stage is a status badge, not one of its four jobs, so
 * "Shortlisted" reads as `warning` (in review, pending a decision) rather
 * than crimson.
 */
const STATUS_PILL: Record<ApplicationStatus, Tone> = {
  APPLIED: 'neutral',
  VIEWED: 'info',
  SHORTLISTED: 'warning',
  CONNECTED: 'success',
  REJECTED: 'danger',
}

export function JobApplicationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'JobApplications'>>()
  const { id } = route.params

  const [jobTitle, setJobTitle] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | ApplicationStatus>('all')
  const [rows, setRows] = useState<ApplicationRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<ApplicationStatus, number>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [actionRunningId, setActionRunningId] = useState<string | null>(null)

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchJobApplications(id, {
        status: activeTab === 'all' ? undefined : activeTab,
      })
      setJobTitle(res.job.title)
      setRows(res.rows)
      setTotal(res.total)
      setCounts(res.counts)
    } catch (err) {
      console.error('Failed to load applications', err)
      setError(err instanceof Error ? err : new Error('We could not load applicants for this role.'))
    } finally {
      setLoading(false)
    }
  }, [id, activeTab])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const handleMoveStatus = async (
    applicationId: string,
    to: 'SHORTLISTED' | 'REJECTED' | 'CONNECTED',
    from: ApplicationStatus,
  ) => {
    try {
      setActionRunningId(applicationId)
      await updateApplicationStatus(applicationId, { to, from })
      loadApplications()
    } catch (err) {
      console.error('Failed to move application status', err)
    } finally {
      setActionRunningId(null)
    }
  }

  return (
    <EmployerShell
      back={{ label: 'ROLES', onPress: () => navigation.goBack() }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>Pipeline</Eyebrow>
        <Display level="lg" accessibilityRole="header">
          {jobTitle ? `Applicants: ${jobTitle}` : 'Applicants'}
        </Display>
      </View>

      {/* Status tabs — the same scrolling chip row the jobs/interests filters use. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        <Chip label={`All (${total})`} selected={activeTab === 'all'} onPress={() => setActiveTab('all')} />
        <Chip
          label={`New (${counts.APPLIED ?? 0})`}
          selected={activeTab === 'APPLIED'}
          onPress={() => setActiveTab('APPLIED')}
        />
        <Chip
          label={`Viewed (${counts.VIEWED ?? 0})`}
          selected={activeTab === 'VIEWED'}
          onPress={() => setActiveTab('VIEWED')}
        />
        <Chip
          label={`Shortlisted (${counts.SHORTLISTED ?? 0})`}
          selected={activeTab === 'SHORTLISTED'}
          onPress={() => setActiveTab('SHORTLISTED')}
        />
        <Chip
          label={`Connected (${counts.CONNECTED ?? 0})`}
          selected={activeTab === 'CONNECTED'}
          onPress={() => setActiveTab('CONNECTED')}
        />
        <Chip
          label={`Rejected (${counts.REJECTED ?? 0})`}
          selected={activeTab === 'REJECTED'}
          onPress={() => setActiveTab('REJECTED')}
        />
      </ScrollView>

      {/* Content */}
      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load applicants."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => loadApplications()} />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No applicants found"
          body="Applications received for this position will appear here."
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const candidate = row.candidate
            const isActionRunning = actionRunningId === row.id

            return (
              <Card key={row.id} style={styles.card}>
                <View style={styles.cardTop}>
                  {/* Poster thumbnail — no shared avatar primitive exists yet, so this stays a themed box, same as the shortlist card. */}
                  <View style={styles.posterBox}>
                    {candidate?.photoUrl ? (
                      <Image source={{ uri: candidate.photoUrl }} style={styles.posterImg} />
                    ) : (
                      <View style={styles.posterPlaceholder}>
                        <Display level="xs">{candidate?.name?.charAt(0) || 'C'}</Display>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => navigation.navigate('ApplicantDetail', { id: row.id })}
                    >
                      <Display level="xs">{candidate?.name || 'Candidate'}</Display>
                    </Pressable>

                    <Body size="xs" tone="muted">
                      {[
                        candidate?.headline,
                        candidate?.city,
                        candidate?.experienceYears != null ? `${candidate.experienceYears}y exp` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Body>

                    <View style={styles.subRow}>
                      <StatusPill tone={STATUS_PILL[row.status]} label={row.statusLabel} />
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

                {/* Message from candidate */}
                {row.message && (
                  <View style={styles.messageBox}>
                    <Body size="xs" style={styles.messageText} numberOfLines={2}>
                      &ldquo;{row.message}&rdquo;
                    </Body>
                  </View>
                )}

                {/* Foot actions */}
                <View style={styles.cardFoot}>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => navigation.navigate('ApplicantDetail', { id: row.id })}
                  >
                    <Body size="xs" weight="semibold">
                      Review →
                    </Body>
                  </Pressable>

                  <View style={styles.quickActions}>
                    {(row.status === 'APPLIED' || row.status === 'VIEWED') && (
                      <>
                        <Button
                          variant="quiet"
                          size="sm"
                          label="Shortlist"
                          disabled={isActionRunning}
                          onPress={() => handleMoveStatus(row.id, 'SHORTLISTED', row.status)}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          label="Connect"
                          disabled={isActionRunning}
                          onPress={() => handleMoveStatus(row.id, 'CONNECTED', row.status)}
                        />
                      </>
                    )}

                    {row.status === 'SHORTLISTED' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Connect"
                        disabled={isActionRunning}
                        onPress={() => handleMoveStatus(row.id, 'CONNECTED', row.status)}
                      />
                    )}
                  </View>
                </View>
              </Card>
            )
          })}
        </View>
      )}
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
    paddingBottom: space.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  tabRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  list: { gap: space.sm },
  card: { padding: space.lg, gap: space.sm },
  cardTop: {
    flexDirection: 'row',
    gap: space.sm,
  },
  posterBox: {
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  cardInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  messageBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  messageText: {
    fontStyle: 'italic',
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
})
