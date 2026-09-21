import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import {
  fetchEmployerJobs,
  type EmployerJobRow,
  type JobStatus,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

export function EmployerJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [activeTab, setActiveTab] = useState<'all' | JobStatus>('all')
  const [rows, setRows] = useState<EmployerJobRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<JobStatus, number>>>({})
  const [loading, setLoading] = useState(true)

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchEmployerJobs({
        status: activeTab === 'all' ? undefined : activeTab,
      })
      setRows(res.rows)
      setTotal(res.total)
      setCounts(res.counts)
    } catch (err) {
      console.error('Failed to load jobs', err)
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>HIRING ROLES</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Job Openings</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('JobEditor')}
              style={styles.newJobBtn}
            >
              <Text style={styles.newJobBtnText}>+ Post a job</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('all')}
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
              All ({total})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('PUBLISHED')}
            style={[styles.tabBtn, activeTab === 'PUBLISHED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'PUBLISHED' && styles.tabBtnTextActive]}>
              Live ({counts.PUBLISHED ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('PENDING_MODERATION')}
            style={[styles.tabBtn, activeTab === 'PENDING_MODERATION' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'PENDING_MODERATION' && styles.tabBtnTextActive]}>
              In review ({counts.PENDING_MODERATION ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('DRAFT')}
            style={[styles.tabBtn, activeTab === 'DRAFT' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'DRAFT' && styles.tabBtnTextActive]}>
              Draft ({counts.DRAFT ?? 0})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading job openings…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No job openings</Text>
            <Text style={styles.emptyBody}>
              Publish positions to reach verified candidates directly.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('JobEditor')}
              style={styles.createBtn}
            >
              <Text style={styles.createBtnText}>Post a job</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((job) => (
              <View key={job.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.titleInfo}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('EmployerJobDetail', { id: job.id })}
                    >
                      <Text style={styles.jobTitle}>{job.title}</Text>
                    </TouchableOpacity>
                    <Text style={styles.jobMeta}>
                      {[job.category, job.location, job.employmentType]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  {job.status === 'PUBLISHED' && (
                    <View style={styles.statusBadgeLive}>
                      <Text style={styles.statusBadgeLiveText}>Live</Text>
                    </View>
                  )}
                  {job.status === 'PENDING_MODERATION' && (
                    <View style={styles.statusBadgeReview}>
                      <Text style={styles.statusBadgeReviewText}>In review</Text>
                    </View>
                  )}
                  {job.status === 'DRAFT' && (
                    <View style={styles.statusBadgeDraft}>
                      <Text style={styles.statusBadgeDraftText}>Draft</Text>
                    </View>
                  )}
                  {job.status === 'PAUSED' && (
                    <View style={styles.statusBadgeDraft}>
                      <Text style={styles.statusBadgeDraftText}>Paused</Text>
                    </View>
                  )}
                  {job.status === 'CLOSED' && (
                    <View style={styles.statusBadgeDraft}>
                      <Text style={styles.statusBadgeDraftText}>Closed</Text>
                    </View>
                  )}
                </View>

                {/* Counters Row */}
                <View style={styles.countersRow}>
                  <Text style={styles.counterItem}>
                    <Text style={styles.counterValue}>{job.counters.views}</Text> views
                  </Text>
                  <Text style={styles.counterItem}>
                    <Text style={styles.counterValue}>{job.counters.saves}</Text> saves
                  </Text>
                  <Text style={styles.counterItem}>
                    <Text style={styles.counterValue}>{job.counters.shortlisted}</Text> shortlisted
                  </Text>
                  <Text style={styles.counterItemAccent}>
                    <Text style={styles.counterValueAccent}>{job.counters.applications}</Text> applicants
                  </Text>
                </View>

                {/* Foot Actions */}
                <View style={styles.cardFoot}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('JobApplications', { id: job.id })}
                    style={styles.viewApplicantsBtn}
                  >
                    <Text style={styles.viewApplicantsBtnText}>
                      Applicants ({job.counters.applications})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('EmployerJobDetail', { id: job.id })}
                    style={styles.detailLink}
                  >
                    <Text style={styles.detailLinkText}>Details →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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
  header: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.accent,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 24,
    color: color.text,
  },
  newJobBtn: {
    backgroundColor: color.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  newJobBtnText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    gap: 6,
    paddingVertical: 2,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  tabBtnActive: {
    backgroundColor: color.text,
  },
  tabBtnText: {
    fontSize: 12,
    color: color.textMuted,
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: color.textInverse,
    fontWeight: '600',
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
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.lg,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  emptyBody: {
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  createBtn: {
    backgroundColor: color.text,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  createBtnText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: space.sm,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  titleInfo: {
    flex: 1,
    gap: 2,
  },
  jobTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 17,
    color: color.text,
  },
  jobMeta: {
    fontSize: 12,
    color: color.textMuted,
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeLiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.success,
  },
  statusBadgeReview: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeReviewText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.warning,
  },
  statusBadgeDraft: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeDraftText: {
    fontSize: 10,
    fontWeight: '500',
    color: color.textMuted,
  },
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 4,
  },
  counterItem: {
    fontSize: 11,
    color: color.textMuted,
  },
  counterValue: {
    fontWeight: '600',
    color: color.text,
  },
  counterItemAccent: {
    fontSize: 11,
    color: color.accent,
  },
  counterValueAccent: {
    fontWeight: 'bold',
    color: color.accent,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  viewApplicantsBtn: {
    backgroundColor: color.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  viewApplicantsBtnText: {
    color: color.textInverse,
    fontSize: 11,
    fontWeight: '600',
  },
  detailLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailLinkText: {
    fontSize: 12,
    color: color.textMuted,
    fontWeight: '500',
  },
})
