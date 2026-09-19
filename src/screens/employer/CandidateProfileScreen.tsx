import React, { useState, useEffect } from 'react'
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
import Video from 'react-native-video'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  fetchCandidateDetail,
  postSwipe,
  type CandidateDetail,
} from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateProfile'>

export function CandidateProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const { id } = route.params

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [shortlisted, setShortlisted] = useState(false)

  useEffect(() => {
    let active = true
    fetchCandidateDetail(id)
      .then((data) => {
        if (active) {
          setCandidate(data)
          setShortlisted(data.shortlisted)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const toggleShortlist = async () => {
    if (!candidate) return
    const nextState = !shortlisted
    setShortlisted(nextState)
    try {
      await postSwipe(candidate.id, nextState ? 'RIGHT' : 'LEFT')
    } catch {
      setShortlisted(!nextState)
    }
  }

  if (loading) {
    return (
      <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
        <View style={styles.centre}>
          <ActivityIndicator color={color.text} size="small" />
          <Text style={styles.loadingText}>Loading candidate profile…</Text>
        </View>
      </EmployerShell>
    )
  }

  if (!candidate) {
    return (
      <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
        <View style={styles.centre}>
          <Text style={styles.errorTitle}>Profile not found</Text>
        </View>
      </EmployerShell>
    )
  }

  const interviewDateStr = candidate.verifiedInterview.at
    ? new Date(candidate.verifiedInterview.at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const salaryLakh =
    candidate.expectedSalary.minPaise || candidate.expectedSalary.maxPaise
      ? `${Math.round((candidate.expectedSalary.minPaise || 0) / 10000000)}–${Math.round(
          (candidate.expectedSalary.maxPaise || 0) / 10000000,
        )} Lakh`
      : 'Competitive'

  const footActions = (
    <View style={styles.footRow}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleShortlist}
        style={[styles.actionBtn, shortlisted ? styles.shortlistedBtn : styles.secondaryBtn]}
      >
        <Text style={shortlisted ? styles.shortlistedBtnText : styles.secondaryBtnText}>
          {shortlisted ? '🔖 Shortlisted' : '🔖 Shortlist'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => Alert.alert('Send Interest', 'Send Interest sheet opens (EM-15 in Phase 2)')}
        style={[styles.actionBtn, styles.primaryBtn]}
      >
        <Text style={styles.primaryBtnText}>Send Interest</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <EmployerShell
      back={{ label: 'FEED', onPress: () => navigation.goBack() }}
      footer={footActions}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Video Preview & Verification */}
        <View style={styles.videoCard}>
          {candidate.streamUrl ? (
            <Video
              source={{ uri: candidate.streamUrl }}
              poster={candidate.posterUrl || candidate.photoUrl || undefined}
              paused={false}
              muted={false}
              repeat
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : candidate.posterUrl || candidate.photoUrl ? (
            <Image
              source={{ uri: candidate.posterUrl || candidate.photoUrl || '' }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.placeholderName}>{candidate.name}</Text>
              <Text style={styles.placeholderSub}>Verified Video Resume</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={styles.vmark}>
              <Text style={styles.vmarkCheck}>✓</Text>
              <Text style={styles.vmarkText}>Verified Interview</Text>
            </View>
            {interviewDateStr && <Text style={styles.vmarkDate}>{interviewDateStr}</Text>}
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.candidateName}>{candidate.name}</Text>
          <Text style={styles.tierLine}>
            {candidate.tier ? `Tier ${candidate.tier}` : 'Verified candidate'}
            {candidate.qualification ? ` · ${candidate.qualification}` : ''}
            {candidate.city ? ` · ${candidate.city}` : ''}
          </Text>
          {candidate.headline && (
            <Text style={styles.headlineText}>{candidate.headline}</Text>
          )}
        </View>

        {/* Full 16:9 Video Link */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CandidateVideo', { id: candidate.id })}
          style={styles.fullVideoBox}
        >
          <View style={styles.fullVideoCol}>
            <Text style={styles.fullVideoTitle}>Complete 16:9 Interview Recording</Text>
            <Text style={styles.fullVideoSub}>Watch the full unedited interview</Text>
          </View>
          <Text style={styles.fullVideoArrow}>Play ▶</Text>
        </TouchableOpacity>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>EXPECTED SALARY</Text>
            <Text style={styles.metricValue}>{salaryLakh}</Text>
            <Text style={styles.metricSub}>Annual CTC</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>JOINING</Text>
            <Text style={styles.metricValue}>{candidate.availability || 'Immediate'}</Text>
            <Text style={styles.metricSub}>Availability</Text>
          </View>
        </View>

        {/* Skills Section */}
        {candidate.skills && candidate.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KEY SKILLS</Text>
            <View style={styles.tagsWrap}>
              {candidate.skills.map((s) => (
                <View key={s} style={styles.tag}>
                  <Text style={styles.tagText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experience Section */}
        {candidate.experience && candidate.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EXPERIENCE</Text>
            {candidate.experience.map((exp, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>{exp.title}</Text>
                  <Text style={styles.timelineDates}>
                    {exp.from} – {exp.to || 'Present'}
                  </Text>
                </View>
                <Text style={styles.timelineCompany}>{exp.company}</Text>
                {exp.description && (
                  <Text style={styles.timelineDesc}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education Section */}
        {candidate.education && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            <View style={styles.eduCard}>
              <Text style={styles.eduDegree}>
                {candidate.education.qualification || 'Degree'}
                {candidate.education.fieldOfStudy ? ` in ${candidate.education.fieldOfStudy}` : ''}
              </Text>
              {candidate.education.institution && (
                <Text style={styles.eduSchool}>{candidate.education.institution}</Text>
              )}
              {candidate.education.score && (
                <Text style={styles.eduScore}>
                  Academic Claim: {candidate.education.score} {candidate.education.scoreType || '%'}
                </Text>
              )}
            </View>
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
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 13,
    color: color.textMuted,
    marginTop: space.sm,
  },
  errorTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  videoCard: {
    height: 380,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.ink,
    justifyContent: 'flex-end',
    padding: space.sm,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  placeholderName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  placeholderSub: {
    fontSize: 12,
    color: color.textSubtle,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: space.xs,
    paddingVertical: 4,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  vmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vmarkCheck: {
    fontSize: 10,
    color: color.accent,
    fontWeight: '700',
  },
  vmarkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vmarkDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  headingBlock: {
    gap: space['2xs'],
  },
  candidateName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 26,
    color: color.text,
  },
  tierLine: {
    fontSize: 13,
    color: color.textMuted,
  },
  headlineText: {
    fontSize: 14,
    color: color.text,
    lineHeight: 20,
    marginTop: 2,
  },
  fullVideoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  fullVideoCol: {
    flex: 1,
    gap: 2,
  },
  fullVideoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  fullVideoSub: {
    fontSize: 11,
    color: color.textMuted,
  },
  fullVideoArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: color.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: space.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 2,
  },
  metricLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    color: color.textMuted,
  },
  metricValue: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 16,
    fontWeight: '600',
    color: color.text,
  },
  metricSub: {
    fontSize: 10,
    color: color.textSubtle,
  },
  section: {
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '600',
    color: color.textMuted,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 11,
    color: color.text,
    fontWeight: '500',
  },
  timelineItem: {
    gap: 2,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
    paddingLeft: space.sm,
    marginBottom: space.xs,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  timelineDates: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
  },
  timelineCompany: {
    fontSize: 12,
    color: color.textMuted,
  },
  timelineDesc: {
    fontSize: 12,
    color: color.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  eduCard: {
    backgroundColor: color.surfaceMuted,
    padding: space.sm,
    borderRadius: radius.md,
    gap: 2,
  },
  eduDegree: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  eduSchool: {
    fontSize: 12,
    color: color.textMuted,
  },
  eduScore: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
    marginTop: 2,
  },
  footRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  shortlistedBtn: {
    backgroundColor: color.text,
  },
  shortlistedBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: color.textInverse,
  },
  primaryBtn: {
    backgroundColor: color.accent,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
