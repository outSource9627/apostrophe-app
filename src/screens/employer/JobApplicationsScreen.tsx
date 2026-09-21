import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Image,
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
  fetchJobApplications,
  updateApplicationStatus,
  type ApplicationRow,
  type ApplicationStatus,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

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
  const [actionRunningId, setActionRunningId] = useState<string | null>(null)

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchJobApplications(id, {
        status: activeTab === 'all' ? undefined : activeTab,
      })
      setJobTitle(res.job.title)
      setRows(res.rows)
      setTotal(res.total)
      setCounts(res.counts)
    } catch (err) {
      console.error('Failed to load applications', err)
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PIPELINE</Text>
          <Text style={styles.title}>{jobTitle ? `Applicants: ${jobTitle}` : 'Applicants'}</Text>
        </View>

        {/* Status Tabs */}
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
            onPress={() => setActiveTab('APPLIED')}
            style={[styles.tabBtn, activeTab === 'APPLIED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'APPLIED' && styles.tabBtnTextActive]}>
              New ({counts.APPLIED ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('VIEWED')}
            style={[styles.tabBtn, activeTab === 'VIEWED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'VIEWED' && styles.tabBtnTextActive]}>
              Viewed ({counts.VIEWED ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('SHORTLISTED')}
            style={[styles.tabBtn, activeTab === 'SHORTLISTED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'SHORTLISTED' && styles.tabBtnTextActive]}>
              Shortlisted ({counts.SHORTLISTED ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('CONNECTED')}
            style={[styles.tabBtn, activeTab === 'CONNECTED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'CONNECTED' && styles.tabBtnTextActive]}>
              Connected ({counts.CONNECTED ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('REJECTED')}
            style={[styles.tabBtn, activeTab === 'REJECTED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'REJECTED' && styles.tabBtnTextActive]}>
              Rejected ({counts.REJECTED ?? 0})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading applicants…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No applicants found</Text>
            <Text style={styles.emptyBody}>
              Applications received for this position will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const candidate = row.candidate
              const isActionRunning = actionRunningId === row.id

              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.posterBox}>
                      {candidate?.photoUrl ? (
                        <Image source={{ uri: candidate.photoUrl }} style={styles.posterImg} />
                      ) : (
                        <View style={styles.posterPlaceholder}>
                          <Text style={styles.monogramLetter}>{candidate?.name?.charAt(0) || 'C'}</Text>
                        </View>
                      )}
                      {candidate?.verifiedInterview?.verified && (
                        <View style={styles.verifiedDot}>
                          <Text style={styles.verifiedDotText}>✓</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardInfo}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('ApplicantDetail', { id: row.id })}
                      >
                        <Text style={styles.candidateName}>{candidate?.name || 'Candidate'}</Text>
                      </TouchableOpacity>

                      <Text style={styles.candidateMeta}>
                        {[
                          candidate?.headline,
                          candidate?.city,
                          candidate?.experienceYears != null ? `${candidate.experienceYears}y exp` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>

                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{row.statusLabel}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Message from Candidate */}
                  {row.message && (
                    <View style={styles.messageBox}>
                      <Text style={styles.messageText} numberOfLines={2}>
                        &ldquo;{row.message}&rdquo;
                      </Text>
                    </View>
                  )}

                  {/* Foot actions */}
                  <View style={styles.cardFoot}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('ApplicantDetail', { id: row.id })}
                      style={styles.reviewBtn}
                    >
                      <Text style={styles.reviewBtnText}>Review →</Text>
                    </TouchableOpacity>

                    <View style={styles.quickActions}>
                      {(row.status === 'APPLIED' || row.status === 'VIEWED') && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleMoveStatus(row.id, 'SHORTLISTED', row.status)}
                            disabled={isActionRunning}
                            style={styles.quickBtn}
                          >
                            <Text style={styles.quickBtnText}>Shortlist</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleMoveStatus(row.id, 'CONNECTED', row.status)}
                            disabled={isActionRunning}
                            style={styles.quickBtnAccent}
                          >
                            <Text style={styles.quickBtnAccentText}>Connect</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {row.status === 'SHORTLISTED' && (
                        <TouchableOpacity
                          onPress={() => handleMoveStatus(row.id, 'CONNECTED', row.status)}
                          disabled={isActionRunning}
                          style={styles.quickBtnAccent}
                        >
                          <Text style={styles.quickBtnAccentText}>Connect</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
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
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: color.text,
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
    gap: space.sm,
  },
  posterBox: {
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
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
  monogramLetter: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.textSubtle,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: color.accent,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    fontSize: 7,
    color: color.textInverse,
    fontWeight: 'bold',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  candidateName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    color: color.text,
  },
  candidateMeta: {
    fontSize: 12,
    color: color.textMuted,
  },
  statusBadge: {
    backgroundColor: color.surfaceMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  statusBadgeText: {
    fontSize: 10,
    color: color.textSubtle,
    fontWeight: '500',
  },
  messageBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: 6,
  },
  messageText: {
    fontSize: 11,
    color: color.text,
    fontStyle: 'italic',
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  reviewBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  reviewBtnText: {
    fontSize: 12,
    color: color.text,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceMuted,
  },
  quickBtnText: {
    fontSize: 11,
    color: color.text,
  },
  quickBtnAccent: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: color.text,
  },
  quickBtnAccentText: {
    fontSize: 11,
    color: color.textInverse,
    fontWeight: '600',
  },
})
