import React, { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { fmtShortDate, fmtTime, splitByTime } from '../../lib/interviews/slots'
import { statusMark } from '../../lib/interviews/status'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Chip, EmptyState, ErrorState, Fab, Skeleton, StatusPill, TabTitle, text } from '../../components/ui'

type Filter = 'All' | 'Upcoming' | 'Completed' | 'Cancelled'
const FILTERS: Filter[] = ['All', 'Upcoming', 'Completed', 'Cancelled']

/**
 * ST-25 — one list, filterable, a status per row. Join shows on a row only while
 * its window is open (roomReady), never before and never after.
 *
 * A bottom-bar screen: there is nothing to go back to, so `onBack` is kept only
 * so the route's wiring does not change.
 */
export function InterviewsScreen({
  onOpen, onBook,
}: { onBack?: () => void; onOpen: (id: string) => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('All')
  const q = useQuery({ queryKey: ['interviews'], queryFn: () => api.get<{ interviews: StudentInterview[] }>('/interviews/me') })

  const frame = (child: React.ReactNode, withFab = true) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <TabTitle title="My interviews" />
      {child}
      {withFab && <Fab label="Book an interview" onPress={onBook} glyph={<Text style={styles.fabPlus}>+</Text>} />}
    </View>
  )

  if (q.isPending) return frame(<View style={styles.list}><Skeleton lines={3} /></View>, false)
  if (q.isError) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load your interviews."
        body="Nothing has changed on your bookings. Try again."
        action={<Button variant="outline" size="sm" label="Try again" onPress={() => { void q.refetch() }} />}
      />
    </View>,
    false,
  )

  const all = q.data!.interviews
  if (all.length === 0) {
    return frame(
      <View style={styles.centre}>
        <EmptyState
          title="Nothing booked yet."
          body="Your interview, and the video resume it becomes, both start here."
          action={<Button variant="primary" size="md" label="Book an interview" onPress={onBook} />}
        />
      </View>,
      false,
    )
  }

  const { upcoming, past } = splitByTime(all)
  const inFilter: Record<Filter, StudentInterview[]> = {
    All: [...upcoming, ...past],
    Upcoming: upcoming,
    Completed: past.filter((iv) => iv.status === 'COMPLETED'),
    Cancelled: past.filter((iv) => iv.status === 'CANCELLED'),
  }
  const shown = inFilter[filter]

  return frame(
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f} label={`${f} (${inFilter[f].length})`} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      >
        {shown.length === 0 ? (
          <Text style={[text.uiMd, styles.none]}>No {filter.toLowerCase()} interviews.</Text>
        ) : (
          shown.map((iv) => <Row key={iv.id} iv={iv} onOpen={() => onOpen(iv.id)} />)
        )}
      </ScrollView>
    </>,
  )
}

function Row({ iv, onOpen }: { iv: StudentInterview; onOpen: () => void }) {
  const mark = statusMark(iv.status)
  const [, dayNum, mon] = fmtShortDate(iv.slotStart).split(' ')
  const action = iv.roomReady ? 'Join interview' : iv.status === 'COMPLETED' ? 'View details' : iv.canReschedule || iv.canCancel ? 'Manage' : 'View details'
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.dateTile}>
        <Text style={[text.metaXs, styles.mon]}>{mon?.toUpperCase()}</Text>
        <Text style={text.displaySm}>{dayNum}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[text.uiBaseSemi, styles.when]} numberOfLines={1}>{relativeWhen(iv.slotStart)}</Text>
          <StatusPill tone={mark.tone} label={mark.label} dot={mark.live} />
        </View>
        <Text style={[text.uiXs, styles.sub]}>{iv.durationMin} minutes · {iv.tier}{iv.interviewer ? ` · with ${iv.interviewer.name}` : ''}</Text>
        <Text style={[text.uiSmSemi, styles.action]}>{action} →</Text>
      </View>
    </Pressable>
  )
}

function relativeWhen(iso: string): string {
  const t = fmtTime(iso)
  const key = (d: Date) => {
    const s = new Date(d.getTime() + (5 * 60 + 30) * 60000)
    return `${s.getUTCFullYear()}-${s.getUTCMonth()}-${s.getUTCDate()}`
  }
  const today = key(new Date())
  const slot = key(new Date(iso))
  const tomorrow = key(new Date(Date.now() + 86400000))
  if (slot === today) return `Today · ${t}`
  if (slot === tomorrow) return `Tomorrow · ${t}`
  return `${fmtShortDate(iso)} · ${t}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  filterScroll: { flexGrow: 0 },
  filters: { gap: spaceHalf['1.5'], paddingHorizontal: space.lg, paddingBottom: space.md },
  list: { paddingHorizontal: space.lg, gap: spaceHalf['2.5'], paddingBottom: height.fab + space.lg * 2 },
  none: { color: color.textMuted, paddingHorizontal: space.xs, paddingTop: space.sm },
  fabPlus: { color: color.textInverse, fontSize: height.glyph - 4 },
  card: {
    flexDirection: 'row',
    gap: spaceHalf['3.5'],
    padding: spaceHalf['3.5'],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  pressed: { backgroundColor: color.surfaceMuted },
  dateTile: {
    width: height['date-tile-w'],
    height: height['date-tile-h'],
    borderRadius: radius.tile,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mon: { color: color.textMuted, letterSpacing: trackingNative.meta },
  rowBody: { flex: 1, minWidth: 0, gap: space.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  when: { flexShrink: 1 },
  sub: { color: color.textMuted },
  action: { color: color.accent, marginTop: space['2xs'] },
})
