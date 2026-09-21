import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
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
  fetchApplicationDetail,
  updateApplicationStatus,
  type ApplicationDetail,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

export function ApplicantDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'ApplicantDetail'>>()
  const { id } = route.params

  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const loadApplication = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchApplicationDetail(id)
      setApplication(data)
    } catch (err) {
      console.error('Failed to load application', err)
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
          <View style={styles.footRow}>
            {application.status === 'CONNECTED' ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionBtnPrimary}
              >
                <Text style={styles.actionBtnPrimaryText}>Open Chat →</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButtonsRow}>
                {application.status !== 'SHORTLISTED' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleStatusMove('SHORTLISTED')}
                    disabled={actionLoading}
                    style={styles.actionBtnOutline}
                  >
                    <Text style={styles.actionBtnOutlineText}>Shortlist</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleStatusMove('CONNECTED')}
                  disabled={actionLoading}
                  style={styles.actionBtnPrimary}
                >
                  <Text style={styles.actionBtnPrimaryText}>Connect & Chat</Text>
                </TouchableOpacity>

                {application.status !== 'REJECTED' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={promptDecline}
                    disabled={actionLoading}
                    style={styles.actionBtnGhost}
                  >
                    <Text style={styles.actionBtnGhostText}>Decline</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading applicant review…</Text>
          </View>
        ) : !application ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Application not found</Text>
          </View>
        ) : (
          <View style={styles.container}>
            {/* Candidate Header */}
            <View style={styles.header}>
              <View style={styles.avatarRow}>
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

                <View style={styles.headerInfo}>
                  <Text style={styles.candidateName}>{candidate?.name || 'Candidate'}</Text>
                  <Text style={styles.candidateMeta}>
                    {[candidate?.qualification, candidate?.city, `${candidate?.experienceYears ?? 0}y exp`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>{application.statusLabel}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.appliedDate}>
                Applied for <Text style={styles.jobTitleBold}>{application.job.title}</Text> on{' '}
                {new Date(application.appliedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </Text>
            </View>

            {/* Verified Badge Banner */}
            {candidate?.verifiedInterview?.verified && (
              <View style={styles.verifiedBanner}>
                <Text style={styles.verifiedBannerIcon}>✓</Text>
                <View style={styles.verifiedBannerText}>
                  <Text style={styles.verifiedBannerTitle}>Verified Interview Passed</Text>
                  <Text style={styles.verifiedBannerSub}>
                    Conducted by independent subject-matter expert
                  </Text>
                </View>
              </View>
            )}

            {/* Note from Candidate */}
            {application.message && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NOTE FROM CANDIDATE</Text>
                <View style={styles.messageCard}>
                  <Text style={styles.messageBody}>&ldquo;{application.message}&rdquo;</Text>
                </View>
              </View>
            )}

            {/* Skills */}
            {candidate?.skills && candidate.skills.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>KEY SKILLS</Text>
                <View style={styles.skillWrap}>
                  {candidate.skills.map((s) => (
                    <View key={s} style={styles.skillPill}>
                      <Text style={styles.skillText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Candidate Profile Link */}
            {candidate?.id && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('CandidateProfile', { id: candidate.id })}
                style={styles.profileLinkCard}
              >
                <Text style={styles.profileLinkText}>View full candidate profile & video →</Text>
              </TouchableOpacity>
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
    fontSize: 22,
    color: color.textSubtle,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: color.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    fontSize: 8,
    color: color.textInverse,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  candidateName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 20,
    color: color.text,
  },
  candidateMeta: {
    fontSize: 12,
    color: color.textMuted,
  },
  stageBadge: {
    backgroundColor: color.surfaceMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.text,
  },
  appliedDate: {
    fontSize: 12,
    color: color.textMuted,
    marginTop: 4,
  },
  jobTitleBold: {
    fontWeight: '600',
    color: color.text,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
  },
  verifiedBannerIcon: {
    backgroundColor: color.accent,
    color: color.textInverse,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10,
    fontWeight: 'bold',
  },
  verifiedBannerText: {
    flex: 1,
    gap: 1,
  },
  verifiedBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  verifiedBannerSub: {
    fontSize: 11,
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
  messageCard: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.sm,
  },
  messageBody: {
    fontSize: 13,
    color: color.text,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  skillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillPill: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  skillText: {
    fontSize: 12,
    color: color.text,
  },
  profileLinkCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    alignItems: 'center',
  },
  profileLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: color.accent,
  },
  footRow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  actionBtnPrimary: {
    flex: 2,
    backgroundColor: color.text,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    color: color.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutlineText: {
    color: color.text,
    fontSize: 13,
    fontWeight: '500',
  },
  actionBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGhostText: {
    color: color.danger,
    fontSize: 13,
    fontWeight: '500',
  },
})
