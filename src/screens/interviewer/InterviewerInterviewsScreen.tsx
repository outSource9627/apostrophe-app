import React, { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, StatusPill } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { formatScorecardCountdown, isScorecardOverdue, canJoinInterviewRoom, TIER_FEES_PAISE } from '../../lib/interviewer/state'
import type { InterviewSessionDto } from '../../lib/api/interviewer'

type FilterKey = 'all' | 'upcoming' | 'owed' | 'past'

export function InterviewerInterviewsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { upcomingInterviews, owedScorecards, pastInterviews } = useInterviewer()
  const [filter, setFilter] = useState<FilterKey>('all')

  const formatSlotTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const formatSlotDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  const getFilteredList = (): InterviewSessionDto[] => {
    switch (filter) {
      case 'upcoming':
        return upcomingInterviews
      case 'owed':
        return owedScorecards
      case 'past':
        return pastInterviews
      case 'all':
      default:
        // Combine deduplicated
        const combined = [...upcomingInterviews, ...owedScorecards, ...pastInterviews]
        const seen = new Set<string>()
        return combined.filter((i) => {
          if (seen.has(i.id)) return false
          seen.add(i.id)
          return true
        })
    }
  }

  const list = getFilteredList()

  return (
    <InterviewerShell navTab="interviews">
      <View style={styles.header}>
        <Eyebrow>SESSIONS</Eyebrow>
        <Text style={styles.title}>Interviews</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.tab, filter === 'all' && styles.tabActive]}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
            All
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('upcoming')}
          style={[styles.tab, filter === 'upcoming' && styles.tabActive]}
        >
          <Text style={[styles.tabText, filter === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingInterviews.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('owed')}
          style={[styles.tab, filter === 'owed' && styles.tabActive]}
        >
          <Text style={[styles.tabText, filter === 'owed' && styles.tabTextActive]}>
            Owed ({owedScorecards.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('past')}
          style={[styles.tab, filter === 'past' && styles.tabActive]}
        >
          <Text style={[styles.tabText, filter === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </Pressable>
      </View>

      {/* List of interviews */}
      {list.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>No interviews found</Text>
          <Text style={styles.emptySub}>
            {filter === 'owed'
              ? 'All scorecards are up to date. Excellent work!'
              : filter === 'upcoming'
              ? 'No upcoming sessions scheduled right now.'
              : 'No sessions recorded under this filter.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {list.map((item) => {
            const isOwed = item.status === 'COMPLETED' && !item.scorecardSubmittedAt
            const canJoin = canJoinInterviewRoom(item.slotStart)
            const fee = TIER_FEES_PAISE[item.tier as keyof typeof TIER_FEES_PAISE] ?? 4000
            const overdue = isOwed ? isScorecardOverdue(item.slotEnd) : false

            return (
              <Card key={item.id} style={styles.card}>
                {/* Header info */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.dateTime}>
                      {formatSlotDate(item.slotStart)} · {formatSlotTime(item.slotStart)}
                    </Text>
                    <Text style={styles.feeText}>Fee: {formatPaise(fee)}</Text>
                  </View>
                  <StatusPill
                    tone={
                      item.status === 'BOOKED' || (item.status as string) === 'SCHEDULED'
                        ? 'info'
                        : isOwed
                        ? 'warning'
                        : item.status === 'COMPLETED'
                        ? 'success'
                        : 'neutral'
                    }
                    label={isOwed ? 'SCORECARD OWED' : item.status}
                  />
                </View>

                {/* Candidate Info */}
                <View style={styles.studentRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.student?.name || 'C').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{item.student?.name || 'Candidate'}</Text>
                    <Text style={styles.studentSub}>
                      {item.student?.city ? `${item.student.city} · ` : ''}
                      {item.tier.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                {/* Scorecard countdown alert if owed */}
                {isOwed && (
                  <View style={[styles.owedClockRow, overdue && styles.owedClockOverdue]}>
                    <Text style={styles.clockIcon}>⏱️</Text>
                    <Text style={[styles.clockText, overdue && styles.clockTextOverdue]}>
                      {formatScorecardCountdown(item.slotEnd)}
                    </Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionsRow}>
                  <Button
                    label="Prep & Script"
                    variant="secondary"
                    size="sm"
                    onPress={() => navigation.navigate('InterviewerDetail', { id: item.id })}
                  />

                  {canJoin && (
                    <Button
                      label="Join Room"
                      variant="primary"
                      size="sm"
                      onPress={() => navigation.navigate('InterviewerDetail', { id: item.id, autoJoin: true })}
                    />
                  )}

                  {isOwed && (
                    <Button
                      label="Draft Scorecard"
                      variant="primary"
                      size="sm"
                      onPress={() => navigation.navigate('ScorecardDraft', { id: item.id })}
                    />
                  )}
                </View>
              </Card>
            )
          })}
        </View>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
    fontWeight: '700',
    color: color.text,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: space.xs,
    backgroundColor: color.surfaceSubtle,
    padding: 3,
    borderRadius: radius.md,
  },
  tab: {
    flex: 1,
    paddingVertical: space.xs,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: color.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  tabTextActive: {
    color: color.text,
    fontWeight: '700',
  },
  list: {
    gap: space.md,
  },
  card: {
    padding: space.md,
    gap: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateTime: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  feeText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
    marginTop: 2,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  studentName: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  studentSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  owedClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: '#fffbeb',
    padding: space.xs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: '#fde68a',
  },
  owedClockOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  clockIcon: {
    fontSize: 14,
  },
  clockText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  clockTextOverdue: {
    color: color.accent,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'flex-end',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
  emptyCard: {
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  emptySub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
})
