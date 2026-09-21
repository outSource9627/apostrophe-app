import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { color, radius, space, fontFamilyNative } from '../../theme'

export function CertificateRail({
  interviewDate,
  shortlistCount,
  onFullVideo,
  limitReached = false,
  resetAt,
}: {
  interviewDate?: string | null
  shortlistCount: number
  onFullVideo?: () => void
  limitReached?: boolean
  resetAt?: string
}) {
  return (
    <View style={styles.rail}>
      {/* Top Group: Verified badge + Shortlist count */}
      <View style={styles.topGroup}>
        {/* Verified Badge */}
        <View style={styles.vmarkGroup}>
          <View style={styles.badge}>
            <Text style={styles.badgeCheck}>✓</Text>
            <Text style={styles.badgeText}>Verified</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.metaLabel}>Interview</Text>
            <Text style={styles.dateText}>{interviewDate || 'Verified'}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Shortlist Counter */}
        <View style={styles.counterGroup}>
          <Text style={styles.counterNumber}>{shortlistCount}</Text>
          <View style={styles.counterLabels}>
            <Text style={styles.metaLabel}>Employers</Text>
            <Text style={styles.metaLabel}>shortlisted</Text>
          </View>
        </View>
      </View>

      {/* Bottom Group: Full Video Link */}
      {limitReached ? (
        <View style={styles.bottomGroup}>
          <View style={[styles.videoBtn, styles.videoBtnDisabled]}>
            <Text style={styles.videoIcon}>▶</Text>
          </View>
          <View style={styles.videoLabels}>
            <Text style={styles.videoTitleDisabled}>Full video</Text>
            <Text style={styles.resetLabel}>Plays reset</Text>
            {resetAt && <Text style={styles.resetLabel}>{resetAt}</Text>}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onFullVideo}
          activeOpacity={0.8}
          style={styles.bottomGroup}
        >
          <View style={styles.videoBtn}>
            <Text style={styles.videoIcon}>▶</Text>
          </View>
          <View style={styles.videoLabels}>
            <Text style={styles.videoTitle}>Full video</Text>
            <Text style={styles.durationLabel}>18:36</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {
    width: 96,
    flexShrink: 0,
    justifyContent: 'space-between',
  },
  topGroup: {
    gap: space.md,
  },
  vmarkGroup: {
    alignItems: 'flex-start',
    gap: space.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: color.accentSoft,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeCheck: {
    fontSize: 10,
    color: color.accent,
    fontWeight: '700',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: color.accent,
  },
  dateBlock: {
    gap: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: color.textMuted,
    lineHeight: 14,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    color: color.text,
  },
  divider: {
    height: 1,
    backgroundColor: color.border,
    width: '100%',
  },
  counterGroup: {
    gap: 2,
  },
  counterNumber: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 28,
    fontWeight: '600',
    color: color.text,
    lineHeight: 32,
  },
  counterLabels: {
    gap: 1,
  },
  bottomGroup: {
    alignItems: 'flex-start',
    gap: space.xs,
  },
  videoBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBtnDisabled: {
    opacity: 0.5,
    backgroundColor: color.surfaceSunken,
  },
  videoIcon: {
    fontSize: 12,
    color: color.text,
    marginLeft: 2,
  },
  videoLabels: {
    gap: 1,
  },
  videoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  videoTitleDisabled: {
    fontSize: 12,
    fontWeight: '600',
    color: color.textSubtle,
  },
  durationLabel: {
    fontSize: 11,
    color: color.textSubtle,
  },
  resetLabel: {
    fontSize: 10,
    color: color.warning,
  },
})
