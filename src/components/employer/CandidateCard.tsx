import React, { useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Video from 'react-native-video'
import { color, radius, space, fontFamilyNative } from '../../theme'
import type { CandidateCard as CandidateCardType } from '../../lib/api/employerFeed'
import { CertificateRail } from './CertificateRail'

function formatSalaryLakh(salary: { minPaise: number | null; maxPaise: number | null }): string {
  if (!salary.minPaise && !salary.maxPaise) return 'Competitive'
  const minLakh = salary.minPaise ? Math.round(salary.minPaise / 10000000) : null
  const maxLakh = salary.maxPaise ? Math.round(salary.maxPaise / 10000000) : null
  if (minLakh && maxLakh && minLakh !== maxLakh) {
    return `${minLakh}–${maxLakh}`
  }
  return String(minLakh ?? maxLakh ?? '12')
}

export function CandidateCard({
  candidate,
  onPressProfile,
  onPressVideo,
  onSwipe,
}: {
  candidate: CandidateCardType
  onPressProfile?: () => void
  onPressVideo?: () => void
  onSwipe?: (direction: 'RIGHT' | 'LEFT') => void
}) {
  const [muted, setMuted] = useState(true)

  const interviewDateStr = candidate.verifiedInterview.at
    ? new Date(candidate.verifiedInterview.at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const salaryStr = formatSalaryLakh(candidate.expectedSalary)

  return (
    <View style={styles.card}>
      {/* Media Row: 9:16 Video Frame + Certificate Rail */}
      <View style={styles.mediaRow}>
        {/* Video Frame */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setMuted(!muted)}
          style={styles.frame}
        >
          {candidate.streamUrl ? (
            <Video
              source={{ uri: candidate.streamUrl }}
              poster={candidate.posterUrl || candidate.photoUrl || undefined}
              paused={false}
              muted={muted}
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
            <View style={styles.placeholderFrame}>
              <Text style={styles.placeholderName}>{candidate.name}</Text>
              <Text style={styles.placeholderSub}>Verified Interview</Text>
            </View>
          )}

          {/* Top Label */}
          <View style={styles.frameTopBadge}>
            <Text style={styles.frameBadgeText}>Video resume</Text>
          </View>

          {/* Bottom Mute Indicator */}
          <View style={styles.frameBottomBar}>
            {muted && <Text style={styles.tapSoundText}>Tap for sound</Text>}
            <View style={styles.audioTrack}>
              <View style={styles.audioTrackActive} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Certificate Rail */}
        <CertificateRail
          interviewDate={interviewDateStr}
          shortlistCount={candidate.shortlistCount}
          onFullVideo={onPressVideo}
        />
      </View>

      {/* Candidate Ledger */}
      <View style={styles.ledger}>
        {/* Name and Qualification */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPressProfile}
          style={styles.nameRow}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {candidate.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.nameCol}>
            <Text style={styles.candidateName} numberOfLines={1}>
              {candidate.name}
            </Text>
            <Text style={styles.tierLine} numberOfLines={1}>
              {candidate.tier ? `Tier ${candidate.tier}` : 'Verified'}
              {candidate.qualification ? ` · ${candidate.qualification}` : ''}
            </Text>
          </View>
          <Text style={styles.profileArrow}>Profile →</Text>
        </TouchableOpacity>

        {/* Salary & Joins */}
        <View style={styles.salaryRow}>
          <View style={styles.salaryCol}>
            <Text style={styles.salaryFigure}>{salaryStr}</Text>
            <Text style={styles.salaryLabel}>Lakh / yr Expected</Text>
          </View>
          <View style={styles.joinsCol}>
            <Text style={styles.joinsLabel}>JOINS</Text>
            <Text style={styles.joinsValue}>{candidate.availability || 'Immediate'}</Text>
          </View>
        </View>

        {/* Location & Experience */}
        <Text style={styles.metaLine} numberOfLines={1}>
          {[
            candidate.city,
            `${candidate.experienceYears} yrs exp`,
            candidate.languages?.slice(0, 2).join(', '),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {/* Skills Chips */}
        {candidate.skills && candidate.skills.length > 0 && (
          <View style={styles.skillsRow}>
            {candidate.skills.slice(0, 3).map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
            {candidate.skills.length > 3 && (
              <View style={styles.skillChip}>
                <Text style={styles.skillText}>+{candidate.skills.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions: Pass & Shortlist */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onSwipe?.('LEFT')}
            style={styles.passBtn}
          >
            <Text style={styles.passBtnText}>← Pass (90d)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onSwipe?.('RIGHT')}
            style={styles.shortlistBtn}
          >
            <Text style={styles.shortlistBtnText}>🔖 Shortlist</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 342,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.sm,
    gap: space.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  frame: {
    width: 218,
    height: 388,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.ink,
    justifyContent: 'space-between',
    padding: space.xs,
  },
  placeholderFrame: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ink,
    padding: space.md,
  },
  placeholderName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 4,
  },
  frameTopBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  frameBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  frameBottomBar: {
    gap: 4,
    width: '100%',
  },
  tapSoundText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  audioTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    width: '100%',
  },
  audioTrackActive: {
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    width: '35%',
  },
  ledger: {
    gap: space.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '600',
    fontSize: 13,
    color: color.text,
  },
  nameCol: {
    flex: 1,
  },
  candidateName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    fontWeight: '500',
    color: color.text,
  },
  tierLine: {
    fontSize: 11,
    color: color.textMuted,
  },
  profileArrow: {
    fontSize: 11,
    fontWeight: '600',
    color: color.textMuted,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.xs,
  },
  salaryCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  salaryFigure: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 20,
    fontWeight: '600',
    color: color.text,
  },
  salaryLabel: {
    fontSize: 10,
    color: color.textMuted,
  },
  joinsCol: {
    alignItems: 'flex-end',
  },
  joinsLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    color: color.textMuted,
  },
  joinsValue: {
    fontSize: 11,
    fontWeight: '600',
    color: color.text,
  },
  metaLine: {
    fontSize: 11,
    color: color.textMuted,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillChip: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillText: {
    fontSize: 10,
    color: color.textMuted,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.xs,
  },
  passBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  shortlistBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortlistBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: color.textInverse,
  },
})
