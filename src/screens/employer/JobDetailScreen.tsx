import React, { useState, useEffect, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Figure,
  Skeleton,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer'
import {
  fetchEmployerJobDetail,
  type EmployerJobDetail,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

export function JobDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerJobDetail'>>()
  const { id } = route.params

  const [job, setJob] = useState<EmployerJobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadJob = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchEmployerJobDetail(id)
      setJob(data)
    } catch (err) {
      console.error('Failed to load job', err)
      setError(err instanceof Error ? err : new Error('Failed to load job.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  return (
    <EmployerShell
      back={{ label: 'JOBS', onPress: () => navigation.goBack() }}
      footer={
        job ? (
          <Button
            variant="primary"
            size="lg"
            full
            label={`View applicants (${job.counters.applications})`}
            onPress={() => navigation.navigate('JobApplications', { id: job.id })}
          />
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load this job."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={loadJob} />}
        />
      ) : !job ? (
        <EmptyState title="Job not found" body="This job posting may have been removed." />
      ) : (
        <>
          {/* Header */}
          <View style={styles.header}>
            <Eyebrow>{job.category || 'General'}</Eyebrow>
            <Display level="lg">{job.title}</Display>
            <Body tone="muted">
              {[job.location, job.remote ? 'Remote' : null, job.employmentType]
                .filter(Boolean)
                .join(' · ')}
            </Body>
            <Figure
              value={`₹${Math.round(job.salaryMinPaise / 10000000)} - ₹${Math.round(job.salaryMaxPaise / 10000000)}`}
              unit="LPA"
            />
          </View>
          <Divider />

          {/* Counters */}
          <Card style={styles.countersCard}>
            <Counter label="Views" value={job.counters.views} />
            <Counter label="Saves" value={job.counters.saves} />
            <Counter label="Shortlisted" value={job.counters.shortlisted} />
            <Counter label="Applicants" value={job.counters.applications} />
          </Card>

          {/* Description */}
          <View style={styles.section}>
            <Eyebrow>About the role</Eyebrow>
            <Body size="sm" tone="muted">
              {job.description}
            </Body>
          </View>

          {/* Responsibilities */}
          <Bullets title="Key responsibilities" items={job.responsibilities} />

          {/* Requirements */}
          <Bullets title="Requirements" items={job.requirements} />
        </>
      )}
    </EmployerShell>
  )
}

/** One counter cell — the serif value the sibling job screen gives a salary, over its mono label. Never the accent: a count is a fact, not a call to act. */
function Counter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.counterCell}>
      <Display level="xs">{value}</Display>
      <Eyebrow>{label}</Eyebrow>
    </View>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      {items.map((it, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Body size="sm" style={styles.grow}>
            {it}
          </Body>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  header: {
    gap: space.xs,
  },
  section: {
    gap: space.sm,
  },
  countersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: space.md,
  },
  counterCell: {
    alignItems: 'center',
    gap: space['2xs'],
  },
  bulletRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  bulletDot: {
    width: space.xs,
    height: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.borderStrong,
    marginTop: space.sm,
  },
})
