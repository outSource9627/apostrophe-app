import React, { useState } from 'react'
import { Animated, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { untilLabel } from '../../lib/home/dashboard'
import { fmtShortDate, fmtTime, splitByTime } from '../../lib/interviews/slots'
import { feedbackNote, statusMark } from '../../lib/interviews/status'
import {
  LIVE_POLL_MS, isLate, lateClock, lateJoin, nearStart, studentLateInput, useLateRules, useTicker, type LateJoin, type LateRules,
} from '../../lib/interviews/late'
import { LateBand, LatePill, OtherLine, lateCard, lateTint } from '../../lib/interviews/LateJoin'
import { borderWidth, color, fontFamilyNative as FF, fontSize, opacity, radius, space } from '../../theme'
import { StatusPill } from '../../components/ui'
import { ChatButton } from '../../components/tab/ChatButton'
import { BookFab, CompactBar, GroupLabel, LargeTitle, Skel, StateBlock, useCollapsingTitle, useScrollingDown } from '../../components/tab/kit'

type Filter = 'All' | 'Upcoming' | 'Completed' | 'Cancelled'
const FILTERS: Filter[] = ['All', 'Upcoming', 'Completed', 'Cancelled']

/**
 * ST-25 — one list, filterable, a status per row, as the signed-off mockup
 * draws it (docs/interviews-profile-chat-final.html). The next interview is
 * lit in violet with its countdown. Join shows on a row only while its window
 * is open (roomReady), never before and never after. While it is open the row
 * carries the late-join warning (lib/interviews/late.ts): the clock to the
 * start and below zero, amber then red, and whether the interviewer is in. The
 * clock ticks each second while a row is near its start, and the list is
 * re-read every few seconds while one is in its window.
 *
 * A bottom-bar screen: there is nothing to go back to, so `onBack` is kept only
 * so the route's wiring does not change.
 */
export function InterviewsScreen({
  onOpen, onBook, onChat,
}: { onBack?: () => void; onOpen: (id: string) => void; onBook: () => void; onChat: () => void }) {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('All')
  const rules = useLateRules()
  const q = useQuery({
    queryKey: ['interviews'],
    queryFn: () => api.get<{ interviews: StudentInterview[] }>('/interviews/me'),
    // While a row's join window is open, presence and the session's start are re-read often.
    refetchInterval: (query) =>
      (query.state.data?.interviews ?? []).some((iv) => lateJoin(studentLateInput(iv), rules, Date.now()).phase !== 'off') ? LIVE_POLL_MS : false,
  })
  const tick = useTicker((q.data?.interviews ?? []).some((iv) => (iv.status === 'BOOKED' || iv.status === 'IN_PROGRESS') && nearStart(iv.slotStart, Date.now())))
  const now = tick || Date.now()
  const fab = useScrollingDown()
  const title = useCollapsingTitle(fab.onScroll)

  const header = (
    <View>
      <LargeTitle title="My interviews" right={<ChatButton onPress={onChat} />} />
    </View>
  )

  if (q.isPending) {
    return (
      <View style={[s.page, { paddingTop: insets.top }]}>
        {header}
        <View style={s.pad}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={s.skelCard}>
              <Skel w={54} h={60} />
              <View style={s.skelText}><Skel w="60%" h={16} /><Skel w="45%" h={12} /><Skel w="30%" h={14} /></View>
            </View>
          ))}
        </View>
      </View>
    )
  }

  if (q.isError) {
    return (
      <View style={[s.page, { paddingTop: insets.top }]}>
        {header}
        <StateBlock
          icon="alert"
          title="Could not load your interviews."
          body="Nothing has changed on your bookings. Try again."
          action="Try again"
          onAction={() => { void q.refetch() }}
        />
      </View>
    )
  }

  const all = q.data!.interviews
  if (all.length === 0) {
    return (
      <View style={[s.page, { paddingTop: insets.top }]}>
        {header}
        <StateBlock
          icon="cal"
          title="Nothing booked yet."
          body="Your interview, and the video resume it becomes, both start here."
          action="Book an interview"
          onAction={onBook}
        />
      </View>
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
  const shownUpcoming = shown.filter((iv) => upcoming.includes(iv))
  const shownPast = shown.filter((iv) => !upcoming.includes(iv))

  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <CompactBar title="My interviews" opacity={title.barOpacity} />
      <Animated.ScrollView
        onScroll={title.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      >
        {header}
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f }}
              onPress={() => setFilter(f)}
              style={[s.chip, filter === f && s.chipOn]}
            >
              <Text style={[s.chipText, filter === f && s.chipTextOn]}>{`${f} (${inFilter[f].length})`}</Text>
            </Pressable>
          ))}
        </Animated.ScrollView>

        <View style={s.list}>
          {shown.length === 0 ? (
            <Text style={s.none}>No {filter.toLowerCase()} interviews.</Text>
          ) : (
            <>
              {shownUpcoming.length > 0 && <GroupLabel style={s.groupTop}>Upcoming</GroupLabel>}
              {shownUpcoming.map((iv, i) => (
                <Row key={iv.id} iv={iv} now={now} rules={rules} next={i === 0 && upcoming[0]?.id === iv.id} onOpen={() => onOpen(iv.id)} />
              ))}
              {shownPast.length > 0 && <GroupLabel style={s.groupPast}>Past</GroupLabel>}
              {shownPast.map((iv) => <Row key={iv.id} iv={iv} now={now} rules={rules} onOpen={() => onOpen(iv.id)} />)}
            </>
          )}
        </View>
      </Animated.ScrollView>

      <BookFab label="Book an interview" compact={fab.down} onPress={onBook} />
    </View>
  )
}

function Row({ iv, now, rules, next, onOpen }: { iv: StudentInterview; now: number; rules: LateRules; next?: boolean; onOpen: () => void }) {
  const mark = statusMark(iv.status)
  const late = lateJoin(studentLateInput(iv), rules, now)
  const on = late.phase !== 'off'
  const [, dayNum, mon] = fmtShortDate(iv.slotStart).split(' ')
  // SP-08 — a COMPLETED interview whose feedback is still expected, or never coming, says so quietly (the scorecard itself is on the detail screen, once it exists).
  const note = iv.status === 'COMPLETED' ? feedbackNote(iv.feedback) : null
  const action = iv.roomReady ? 'Join interview' : iv.status === 'COMPLETED' ? 'View details' : iv.canReschedule || iv.canCancel ? 'Manage' : 'View details'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${relativeWhen(iv.slotStart)}, ${mark.label}`}
      onPress={onOpen}
      style={({ pressed }) => [s.card, next && s.cardNext, lateCard(late, false), pressed && s.pressed]}
    >
      <View style={[s.dateTile, next && s.dateTileNext]}>
        <Text style={[s.mon, next && s.monNext]}>{mon}</Text>
        <Text style={[s.day, next && s.dayNext]}>{dayNum}</Text>
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <View style={s.whenCol}>
            <Text style={s.when} numberOfLines={2}>{relativeWhen(iv.slotStart)}</Text>
            {next && !on && <Text style={s.until}>{untilLabel(iv, now)}</Text>}
          </View>
          {isLate(late) ? <LatePill j={late} /> : <StatusPill tone={mark.tone} label={mark.label} dot={mark.live} />}
        </View>
        <Text style={s.sub}>{iv.durationMin} minutes · {iv.tier}{iv.interviewer ? ` · with ${iv.interviewer.name}` : ''}</Text>
        {!!note && <Text style={s.sub}>{note}</Text>}
        {on && (
          <View style={s.lateStack}>
            <LateBand j={late} />
            <OtherLine j={late} who="Interviewer" />
          </View>
        )}
        {on ? (
          <View style={s.lateFoot}>
            <RowClock late={late} />
            <Text style={[s.action, late.phase === 'red' && s.actionRed]}>{action} →</Text>
          </View>
        ) : (
          <Text style={s.action}>{action} →</Text>
        )}
      </View>
    </Pressable>
  )
}

/** "Starts in 04:12", then "−02:14" in the late colour. */
function RowClock({ late }: { late: LateJoin }) {
  return (
    <Text style={[s.clock, { color: lateTint(late, false) ?? color.text }]}>
      {late.secondsLate > 0 ? lateClock(late) : `Starts in ${lateClock(late)}`}
    </Text>
  )
}

function relativeWhen(iso: string): string {
  const t = fmtTime(iso)
  const key = (d: Date) => {
    const x = new Date(d.getTime() + (5 * 60 + 30) * 60000)
    return `${x.getUTCFullYear()}-${x.getUTCMonth()}-${x.getUTCDate()}`
  }
  const today = key(new Date())
  const slot = key(new Date(iso))
  const tomorrow = key(new Date(Date.now() + 86400000))
  if (slot === today) return `Today · ${t}`
  if (slot === tomorrow) return `Tomorrow · ${t}`
  return `${fmtShortDate(iso)} · ${t}`
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  pad: { paddingHorizontal: 20, gap: 10, paddingTop: 6 },
  content: { paddingBottom: 140 },
  chipScroll: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  chip: {
    height: 40, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.textSecondary },
  chipTextOn: { color: color.textInverse },
  list: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  groupTop: { paddingHorizontal: 4, paddingTop: 6 },
  groupPast: { paddingHorizontal: 4, paddingTop: 10 },
  none: { fontFamily: FF.body, fontSize: 14, color: color.textMuted, paddingHorizontal: 4, paddingTop: 4 },

  skelCard: {
    flexDirection: 'row', gap: 14, padding: 14, minHeight: 104, borderRadius: 18,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  skelText: { flex: 1, gap: 10, justifyContent: 'center' },

  card: {
    flexDirection: 'row', gap: 14, padding: 14, minHeight: 104, borderRadius: 18,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  cardNext: { borderColor: color.accentEdge, backgroundColor: color.accentWash },
  pressed: { opacity: opacity.pressed },
  dateTile: { width: 54, height: 60, borderRadius: 12, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  dateTileNext: { backgroundColor: color.accent },
  mon: { fontFamily: FF.bodyMedium, fontSize: 10, color: color.textMuted },
  monNext: { color: color.accentMuted },
  day: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 24, letterSpacing: -0.66, color: color.text },
  dayNext: { color: color.textInverse },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  whenCol: { flex: 1, minWidth: 0 },
  when: { fontFamily: FF.bodySemiBold, fontSize: 16.5, letterSpacing: -0.16, color: color.text },
  until: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.accent, marginTop: 2, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  action: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.accent, marginTop: 3 },
  actionRed: { color: color.danger },
  lateStack: { gap: space.sm, marginTop: space.xs },
  lateFoot: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  clock: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-base'], fontVariant: ['tabular-nums'] },
})
