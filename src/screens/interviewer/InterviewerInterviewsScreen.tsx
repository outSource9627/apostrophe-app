import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { formatScorecardCountdown, isScorecardOverdue, canJoinInterviewRoom, TIER_FEES_PAISE } from '../../lib/interviewer/state'
import type { InterviewSessionDto } from '../../lib/api/interviewer'

type FilterKey = 'all' | 'upcoming' | 'owed' | 'past'

export function InterviewerInterviewsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { upcomingInterviews, owedScorecards, pastInterviews, loading, error, refresh } = useInterviewer()
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

  if (loading) {
    return (
      <InterviewerShell navTab="interviews">
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && list.length === 0) {
    return (
      <InterviewerShell navTab="interviews">
        <ErrorState
          title="We could not load your interviews."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell navTab="interviews">
      <View style={styles.header}>
        <Eyebrow>SESSIONS</Eyebrow>
        <Display level="lg" accessibilityRole="header">
          Interviews
        </Display>
      </View>

      {/* Filter Tabs — a scrolling chip row, same as the status filter on Job openings. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip
          label={`Upcoming (${upcomingInterviews.length})`}
          selected={filter === 'upcoming'}
          onPress={() => setFilter('upcoming')}
        />
        <Chip
          label={`Owed (${owedScorecards.length})`}
          selected={filter === 'owed'}
          onPress={() => setFilter('owed')}
        />
        <Chip label="Past" selected={filter === 'past'} onPress={() => setFilter('past')} />
      </ScrollView>

      {/* List of interviews */}
      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="No interviews found"
            body={
              filter === 'owed'
                ? 'All scorecards are up to date. Excellent work!'
                : filter === 'upcoming'
                ? 'No upcoming sessions scheduled right now.'
                : 'No sessions recorded under this filter.'
            }
          />
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
                    <Display level="xs">
                      {formatSlotDate(item.slotStart)} · {formatSlotTime(item.slotStart)}
                    </Display>
                    <Meta style={styles.feeText}>{`Fee: ${formatPaise(fee)}`}</Meta>
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
                <ObjectRow
                  last
                  thumb={
                    <View style={styles.avatar}>
                      <Body weight="semibold">
                        {(item.student?.name || 'C').slice(0, 1).toUpperCase()}
                      </Body>
                    </View>
                  }
                  title={item.student?.name || 'Candidate'}
                  meta={`${item.student?.city ? `${item.student.city} · ` : ''}${item.tier.replace('_', ' ')}`}
                />

                {/* Scorecard countdown alert if owed — never the accent, a countdown is a passive readout. */}
                {isOwed && (
                  <StatusPill
                    tone={overdue ? 'danger' : 'warning'}
                    dot
                    label={formatScorecardCountdown(item.slotEnd)}
                  />
                )}

                {/* Action buttons — secondary only: a list of rows never carries the screen's one accent action. */}
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
                      variant="secondary"
                      size="sm"
                      onPress={() => navigation.navigate('InterviewerDetail', { id: item.id, autoJoin: true })}
                    />
                  )}

                  {isOwed && (
                    <Button
                      label="Draft Scorecard"
                      variant="secondary"
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
  tabRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
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
  feeText: {
    marginTop: space['2xs'],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'flex-end',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
})
