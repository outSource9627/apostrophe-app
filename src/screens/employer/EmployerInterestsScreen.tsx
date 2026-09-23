import React, { useState, useEffect, useCallback } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, opacity, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import {
  fetchEmployerInterests,
  liveInterestOutcome,
  type EmployerInterestRow,
  type InterestOutcome,
} from '../../lib/api/employerInterests'
import type { RootStackParamList } from '../../../App'

/** Each interest's live outcome, as the row's status pill: tone and label. Never the accent — a status badge is not one of its four jobs. */
const STATUS_PILL: Record<InterestOutcome, { tone: Tone; label: string }> = {
  SENT: { tone: 'warning', label: 'Interest sent · Pending' },
  ACCEPTED: { tone: 'success', label: 'Accepted' },
  NOT_ACCEPTED: { tone: 'neutral', label: 'Not accepted' },
}

export function EmployerInterestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [activeTab, setActiveTab] = useState<'all' | InterestOutcome>('all')
  const [rows, setRows] = useState<EmployerInterestRow[]>([])
  const [counts, setCounts] = useState<{ all: number; SENT: number; ACCEPTED: number; NOT_ACCEPTED: number }>({
    all: 0,
    SENT: 0,
    ACCEPTED: 0,
    NOT_ACCEPTED: 0,
  })
  const [since, setSince] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadInterests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchEmployerInterests({
        outcome: activeTab === 'all' ? undefined : activeTab,
      })
      setRows(res.rows)
      setCounts(res.counts)
      setSince(res.since)
    } catch (err) {
      console.error('Failed to load interests', err)
      setError(err instanceof Error ? err : new Error('Failed to load your Interests.'))
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadInterests()
  }, [loadInterests])

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') navigation.navigate('EmployerFeed')
    else if (key === 'shortlist') navigation.navigate('EmployerShortlist')
    else if (key === 'interests') loadInterests()
    else if (key === 'jobs') navigation.navigate('EmployerJobs')
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  const now = new Date()

  return (
    <EmployerShell
      nav={<EmployerNav current="interests" onSelect={handleNavSelect} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>Outbound reach</Eyebrow>
        <Display level="lg" accessibilityRole="header">
          Interests Sent
        </Display>
        <Body size="xs" tone="muted">
          {since
            ? `Tracking outreach since ${new Date(since).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
            : 'Direct introductions and invitation tracking'}
        </Body>
      </View>

      {/* Tab strip — a scrolling chip row, the same shape the jobs screen's status filter uses. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        <Chip label={`All (${counts.all})`} selected={activeTab === 'all'} onPress={() => setActiveTab('all')} />
        <Chip
          label={`Interest sent (${counts.SENT})`}
          selected={activeTab === 'SENT'}
          onPress={() => setActiveTab('SENT')}
        />
        <Chip
          label={`Accepted (${counts.ACCEPTED})`}
          selected={activeTab === 'ACCEPTED'}
          onPress={() => setActiveTab('ACCEPTED')}
        />
        <Chip
          label={`Not accepted (${counts.NOT_ACCEPTED})`}
          selected={activeTab === 'NOT_ACCEPTED'}
          onPress={() => setActiveTab('NOT_ACCEPTED')}
        />
      </ScrollView>

      {/* Content */}
      {loading ? (
        <Skeleton lines={3} />
      ) : error ? (
        <ErrorState
          title="We could not load your Interests."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => loadInterests()} />}
        />
      ) : counts.all === 0 ? (
        <EmptyState
          title="No Interests sent yet"
          body="Discover candidates on the feed or shortlist and send an Interest to initiate a conversation."
          action={
            <Button
              variant="outline"
              size="sm"
              label="Explore candidate feed"
              onPress={() => navigation.navigate('EmployerFeed')}
            />
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No entries in this tab"
          body="No candidates currently match this status."
          action={<Button variant="outline" size="sm" label="View all" onPress={() => setActiveTab('all')} />}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const outcome = liveInterestOutcome(row, now)
            const canResend =
              row.available &&
              outcome !== 'SENT' &&
              (!row.nextEligibleAt || new Date(row.nextEligibleAt).getTime() <= now.getTime())
            const pill = STATUS_PILL[outcome]

            return (
              <Card key={row.id} style={[styles.card, !row.available && styles.cardUnavailable]}>
                <View style={styles.cardTop}>
                  <View style={styles.posterBox}>
                    {row.posterUrl ? (
                      <Image source={{ uri: row.posterUrl }} style={styles.posterImg} />
                    ) : (
                      <View style={styles.posterPlaceholder}>
                        <Display level="xs">{row.name.charAt(0)}</Display>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <Pressable
                      accessibilityRole={row.available ? 'button' : undefined}
                      onPress={() => {
                        if (row.available) {
                          navigation.navigate('CandidateProfile', { id: row.candidateId })
                        }
                      }}
                    >
                      <Display level="xs">{row.name}</Display>
                    </Pressable>

                    <Body size="xs" tone="muted">
                      {[
                        row.city || 'India',
                        `Sent ${new Date(row.sentAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
                        row.job ? `For: ${row.job.title}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Body>
                  </View>
                </View>

                {row.message && (
                  <View style={styles.messageBox}>
                    <Body size="xs" style={styles.messageText} numberOfLines={2}>
                      &ldquo;{row.message}&rdquo;
                    </Body>
                  </View>
                )}

                <View style={styles.cardFoot}>
                  {outcome === 'ACCEPTED' ? (
                    <View style={styles.statusRow}>
                      <StatusPill tone={pill.tone} label={pill.label} />
                      <Button variant="secondary" size="sm" label="Open chat" />
                    </View>
                  ) : outcome === 'SENT' ? (
                    <View style={styles.statusCol}>
                      <StatusPill tone={pill.tone} label={pill.label} />
                      <Meta>
                        Expires {new Date(row.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </Meta>
                    </View>
                  ) : (
                    <View style={styles.statusRow}>
                      <StatusPill tone={pill.tone} label={pill.label} />
                      {canResend ? (
                        <Button
                          variant="outline"
                          size="sm"
                          label="Resend"
                          onPress={() =>
                            navigation.navigate('SendInterest', {
                              candidateId: row.candidateId,
                              candidateName: row.name,
                              candidateCity: row.city,
                            })
                          }
                        />
                      ) : row.nextEligibleAt && new Date(row.nextEligibleAt).getTime() > now.getTime() ? (
                        <Meta>
                          Eligible {new Date(row.nextEligibleAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </Meta>
                      ) : null}
                    </View>
                  )}
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
  header: { gap: space.xs },
  tabRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  list: { gap: space.sm },
  card: { padding: space.lg, gap: space.sm },
  cardUnavailable: { opacity: opacity.disabled },
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
  messageBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  messageText: { fontStyle: 'italic' },
  cardFoot: {
    paddingTop: space.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusCol: { gap: space['2xs'] },
})
