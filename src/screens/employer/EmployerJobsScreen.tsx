import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, space } from '../../theme'
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
} from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import {
  fetchEmployerJobs,
  type EmployerJobRow,
  type JobStatus,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

/** Each job's status, as the card's pill: label and tone. Never the accent — a status badge is not one of its four jobs. */
const STATUS_PILL: Record<JobStatus, { tone: Tone; label: string }> = {
  PUBLISHED: { tone: 'success', label: 'Live' },
  PENDING_MODERATION: { tone: 'warning', label: 'In review' },
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PAUSED: { tone: 'neutral', label: 'Paused' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
}

export function EmployerJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [activeTab, setActiveTab] = useState<'all' | JobStatus>('all')
  const [rows, setRows] = useState<EmployerJobRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<JobStatus, number>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchEmployerJobs({
        status: activeTab === 'all' ? undefined : activeTab,
      })
      setRows(res.rows)
      setTotal(res.total)
      setCounts(res.counts)
    } catch (err) {
      console.error('Failed to load jobs', err)
      setError(err instanceof Error ? err : new Error('Failed to load your job openings.'))
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') navigation.navigate('EmployerFeed')
    else if (key === 'shortlist') navigation.navigate('EmployerShortlist')
    else if (key === 'interests') navigation.navigate('EmployerInterests')
    else if (key === 'jobs') loadJobs()
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  return (
    <EmployerShell
      nav={<EmployerNav current="jobs" onSelect={handleNavSelect} />}
    >
      {/* Header — the screen's one crimson lives here, on the one primary action. */}
      <View style={styles.header}>
        <Eyebrow>Hiring roles</Eyebrow>
        <View style={styles.titleRow}>
          <Display level="lg" accessibilityRole="header">
            Job openings
          </Display>
          <Button
            variant="primary"
            size="sm"
            label="+ Post a job"
            onPress={() => navigation.navigate('JobEditor')}
          />
        </View>
      </View>

      {/* Status filter — a scrolling chip row past three options, as the foundations call for. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        <Chip label={`All (${total})`} selected={activeTab === 'all'} onPress={() => setActiveTab('all')} />
        <Chip
          label={`Live (${counts.PUBLISHED ?? 0})`}
          selected={activeTab === 'PUBLISHED'}
          onPress={() => setActiveTab('PUBLISHED')}
        />
        <Chip
          label={`In review (${counts.PENDING_MODERATION ?? 0})`}
          selected={activeTab === 'PENDING_MODERATION'}
          onPress={() => setActiveTab('PENDING_MODERATION')}
        />
        <Chip
          label={`Draft (${counts.DRAFT ?? 0})`}
          selected={activeTab === 'DRAFT'}
          onPress={() => setActiveTab('DRAFT')}
        />
      </ScrollView>

      {/* Content */}
      {loading ? (
        <Skeleton lines={3} />
      ) : error ? (
        <ErrorState
          title="We could not load your job openings."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => loadJobs()} />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No job openings"
          body="Publish positions to reach verified candidates directly."
          action={
            <Button variant="outline" size="sm" label="Post a job" onPress={() => navigation.navigate('JobEditor')} />
          }
        />
      ) : (
        <View style={styles.list}>
          {rows.map((job) => {
            const pill = STATUS_PILL[job.status]
            return (
              <Card key={job.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.titleInfo}
                    onPress={() => navigation.navigate('EmployerJobDetail', { id: job.id })}
                  >
                    <Display level="xs">{job.title}</Display>
                    <Body size="xs" tone="muted">
                      {[job.category, job.location, job.employmentType].filter(Boolean).join(' · ')}
                    </Body>
                  </Pressable>
                  <StatusPill tone={pill.tone} label={pill.label} />
                </View>

                <View style={styles.countersRow}>
                  <Body size="xs" tone="muted">{`${job.counters.views} views`}</Body>
                  <Body size="xs" tone="muted">{`${job.counters.saves} saves`}</Body>
                  <Body size="xs" tone="muted">{`${job.counters.shortlisted} shortlisted`}</Body>
                  {/* Emphasis, not the accent — a counter is never one of its four jobs. */}
                  <Body size="xs" weight="semibold">{`${job.counters.applications} applicants`}</Body>
                </View>

                <View style={styles.cardFoot}>
                  <Button
                    variant="secondary"
                    size="sm"
                    label={`Applicants (${job.counters.applications})`}
                    onPress={() => navigation.navigate('JobApplications', { id: job.id })}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => navigation.navigate('EmployerJobDetail', { id: job.id })}
                  >
                    <Body size="xs" tone="muted">
                      Details →
                    </Body>
                  </Pressable>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  tabRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  list: { gap: space.sm },
  card: { padding: space.lg, gap: space.sm },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  titleInfo: { flex: 1, gap: space['2xs'] },
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.md,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
})
