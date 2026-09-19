import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
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

  const loadJob = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchEmployerJobDetail(id)
      setJob(data)
    } catch (err) {
      console.error('Failed to load job', err)
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
          <View style={styles.footRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('JobApplications', { id: job.id })}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>
                View applicants ({job.counters.applications})
              </Text>
            </TouchableOpacity>
          </View>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading job details…</Text>
          </View>
        ) : !job ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Job not found</Text>
          </View>
        ) : (
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.category}>{job.category || 'General'}</Text>
              <Text style={styles.title}>{job.title}</Text>
              <Text style={styles.meta}>
                {[job.location, job.remote ? 'Remote' : null, job.employmentType]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.salary}>
                ₹{Math.round(job.salaryMinPaise / 10000000)} - ₹{Math.round(job.salaryMaxPaise / 10000000)} LPA
              </Text>
            </View>

            {/* Counters */}
            <View style={styles.countersBox}>
              <View style={styles.counterCol}>
                <Text style={styles.counterNum}>{job.counters.views}</Text>
                <Text style={styles.counterLabel}>Views</Text>
              </View>
              <View style={styles.counterCol}>
                <Text style={styles.counterNum}>{job.counters.saves}</Text>
                <Text style={styles.counterLabel}>Saves</Text>
              </View>
              <View style={styles.counterCol}>
                <Text style={styles.counterNum}>{job.counters.shortlisted}</Text>
                <Text style={styles.counterLabel}>Shortlisted</Text>
              </View>
              <View style={styles.counterCol}>
                <Text style={styles.counterNumAccent}>{job.counters.applications}</Text>
                <Text style={styles.counterLabel}>Applicants</Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ABOUT THE ROLE</Text>
              <Text style={styles.bodyText}>{job.description}</Text>
            </View>

            {/* Responsibilities */}
            {job.responsibilities?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>KEY RESPONSIBILITIES</Text>
                {job.responsibilities.map((r, i) => (
                  <Text key={i} style={styles.bulletItem}>• {r}</Text>
                ))}
              </View>
            )}

            {/* Requirements */}
            {job.requirements?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>REQUIREMENTS</Text>
                {job.requirements.map((r, i) => (
                  <Text key={i} style={styles.bulletItem}>• {r}</Text>
                ))}
              </View>
            )}
          </View>
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
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 13,
    color: color.textMuted,
    marginTop: space.xs,
  },
  emptyCard: {
    padding: space.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  container: {
    gap: space.md,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    gap: 2,
  },
  category: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: color.text,
  },
  meta: {
    fontSize: 13,
    color: color.textMuted,
  },
  salary: {
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
    marginTop: 4,
  },
  countersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  counterCol: {
    alignItems: 'center',
    gap: 2,
  },
  counterNum: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  counterNumAccent: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.accent,
    fontWeight: 'bold',
  },
  counterLabel: {
    fontSize: 10,
    color: color.textMuted,
  },
  section: {
    gap: space.xs,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.textSubtle,
  },
  bodyText: {
    fontSize: 13,
    color: color.text,
    lineHeight: 18,
  },
  bulletItem: {
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
    paddingLeft: 4,
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
})
