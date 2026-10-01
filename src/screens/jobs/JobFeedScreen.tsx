import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ApiClientError } from '../../lib/api'
import { getFeed, getFilters, swipeJob, undoSwipe, type JobCard, type JobFilters } from '../../lib/api/jobs'
import { activeFilterCount, dateLine, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange } from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF, opacity, radius } from '../../theme'
import { Banner, Button, DeckStamp, EmptyState, ErrorState, Skeleton, UndoToast } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { useLightStatusBar } from '../../lib/useLightStatusBar'
import { JobFilterSheet } from './JobFilterSheet'
import { JobDetailsSheet } from './JobDetailsSheet'

/**
 * The job feed, as the signed-off mockup draws it (docs/home-jobs-mockup.html):
 * one job per screen, and the candidate SCROLLS UP for the next one.
 *
 * Moving on is not a decision. Only the two buttons on the rail record one:
 * Save (never applies) and Not interested (hidden for 60 days). Undo reverses
 * the last of those. Looking at the next job costs nothing — which is what the
 * old deck, which only advanced by swiping left or right, could not offer.
 */

// Decorative page grounds: violet, green, rose, blue — each dark enough for white type.
const GROUNDS: [string, string, string][] = [
  [color.accentBright, color.accentDeep, color.inkRaised],
  [color.successFill, '#0B5B47', '#0B1A1A'],
  ['#E0366B', '#7A1F46', '#1B0F18'],
  ['#2F6BFF', '#1B3A8F', '#0B1226'],
]
const RAIL_BOTTOM = 24
const RAIL_W = 84

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const cardMeta = (c: JobCard) =>
  [locationLine(c.location, c.remote), employmentLabel(c.employmentType), experienceLine(c.experience), deadlineLine(c.applicationDeadline)]
    .filter(Boolean).join(' · ').toUpperCase()

export function JobFeedScreen({ onBack, onOpen, onSaved, onApplied, onApply, onChat }: {
  onBack: () => void
  /** The full Job page — kept for deep links; a tap on a card opens the details sheet. */
  onOpen: (id: string) => void
  onSaved: () => void
  onApplied?: () => void
  onApply?: (id: string) => void
  onChat: () => void
}) {
  const insets = useSafeAreaInsets()
  const list = useRef<FlatList<JobCard>>(null)
  const [cards, setCards] = useState<JobCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [i, setI] = useState(0)
  const [pageH, setPageH] = useState(0)
  const [filters, setFilters] = useState<JobFilters>({})
  const [last, setLast] = useState<{ card: JobCard; direction: 'RIGHT' | 'LEFT'; index: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [details, setDetails] = useState<JobCard | null>(null)

  const hasCards = cards.length > 0
  useLightStatusBar(hasCards)

  const scrollTo = useCallback((index: number, animated = true) => {
    if (!pageH) return
    list.current?.scrollToOffset({ offset: index * pageH, animated })
    setI(index)
  }, [pageH])

  const fetchMore = useCallback(async (reset: boolean, applyFilters?: JobFilters) => {
    setLoading(true)
    try {
      let cur: string | null = reset ? null : cursor
      const collected: JobCard[] = []
      for (let round = 0; round < 4; round++) {
        const r = await getFeed({ ...(applyFilters ?? filters), cursor: cur ?? undefined, limit: 20 })
        collected.push(...r.cards)
        cur = r.nextCursor
        if (r.nextCursor === null) { setExhausted(true); break }
        if (collected.length > 0) break
      }
      setCursor(cur)
      setCards((prev) => (reset ? collected : [...prev, ...collected]))
      if (reset) { setI(0); list.current?.scrollToOffset({ offset: 0, animated: false }) }
    } catch (e) {
      if (e instanceof ApiClientError && e.isPaywall) { onBack(); return }
      if (e instanceof ApiClientError && e.status === 404) { setError('Finish your profile first.'); return }
      setError(e instanceof Error ? e.message : 'Could not load jobs.')
    } finally { setLoading(false) }
  }, [cursor, filters, onBack])

  useEffect(() => {
    void getFilters().then((r) => { setFilters(r.filters); void fetchMore(true, r.filters) }).catch(() => void fetchMore(true, {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!loading && !exhausted && cards.length - i <= 3) void fetchMore(false)
  }, [i, cards.length, loading, exhausted, fetchMore])

  const applyFilters = useCallback((f: JobFilters) => { setFilters(f); setExhausted(false); void fetchMore(true, f) }, [fetchMore])

  const current = cards[i]
  const activeCount = activeFilterCount(filters)

  /** Records one decision. Save marks the card and moves on; Not interested removes it. */
  const decide = useCallback(async (card: JobCard, direction: 'RIGHT' | 'LEFT') => {
    if (busy) return
    setBusy(true)
    setError(null)
    const index = cards.findIndex((c) => c.id === card.id)
    try {
      await swipeJob(card.id, direction)
    } catch (e) {
      // The server already has a swipe recorded for this job — nothing to roll back.
      if (!(e instanceof ApiClientError && e.code === 'CONFLICT')) {
        setError(e instanceof Error ? e.message : 'Could not save that.')
        setBusy(false)
        return
      }
    }
    setLast({ card, direction, index })
    if (direction === 'RIGHT') {
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, saved: true } : c)))
      // A beat to see it marked, then on to the next job.
      setTimeout(() => { if (index + 1 < cards.length) scrollTo(index + 1) }, 450)
    } else {
      const left = cards.length - 1
      setCards((prev) => prev.filter((c) => c.id !== card.id))
      if (index >= left) requestAnimationFrame(() => scrollTo(Math.max(0, left - 1), false))
    }
    setBusy(false)
  }, [busy, cards, scrollTo])

  async function undo() {
    if (busy) return
    setBusy(true)
    try {
      const r = await undoSwipe()
      if (r.undone && last && last.card.id === r.jobId) {
        if (last.direction === 'LEFT') {
          setCards((prev) => { const n = [...prev]; n.splice(Math.min(last.index, n.length), 0, last.card); return n })
          requestAnimationFrame(() => scrollTo(last.index, false))
        } else {
          setCards((prev) => prev.map((c) => (c.id === last.card.id ? { ...c, saved: false } : c)))
        }
      }
      setLast(null)
    } catch { /* nothing */ } finally { setBusy(false) }
  }

  const onPagerLayout = (e: LayoutChangeEvent) => setPageH(Math.round(e.nativeEvent.layout.height))
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageH) setI(Math.round(e.nativeEvent.contentOffset.y / pageH))
  }

  return (
    <View style={s.page}>
      {/* ── the pager (or its stand-in states) ───────────────────── */}
      <View style={s.pager} onLayout={onPagerLayout}>
        {loading && !hasCards ? (
          <View style={[s.state, { paddingTop: insets.top + 96 }]}><Skeleton lines={3} block /></View>
        ) : error && !hasCards ? (
          <View style={[s.state, s.stateCentre]}>
            <ErrorState
              title="Could not load jobs."
              body={error}
              action={<Button variant="outline" size="sm" label="Try again" onPress={() => fetchMore(true)} />}
            />
          </View>
        ) : hasCards && pageH > 0 ? (
          <FlatList
            ref={list}
            data={cards}
            keyExtractor={(c) => c.id}
            renderItem={({ item, index }) => (
              <JobPage
                card={item}
                index={index}
                height={pageH}
                locked={busy}
                onDetails={() => setDetails(item)}
                onSwipe={(dir) => { void decide(item, dir) }}
              />
            )}
            getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
            pagingEnabled
            snapToInterval={pageH}
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            windowSize={3}
            maxToRenderPerBatch={2}
          />
        ) : (
          <View style={[s.state, s.stateCentre]}>
            <EmptyState
              title={activeCount > 0 ? 'No jobs match your filters.' : 'You are all caught up.'}
              body={activeCount > 0 ? 'Widen or clear your filters to see more.' : 'New posts land here as employers publish them.'}
              action={activeCount > 0
                ? <Button variant="outline" size="md" label="Adjust filters" onPress={() => setSheetOpen(true)} />
                : <Button variant="primary" size="md" label="Your saved jobs" onPress={onSaved} />}
            />
          </View>
        )}
      </View>

      {/* ── top bar: tabs, filters, chat ─────────────────────────── */}
      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[s.tabs, !hasCards && s.tabsLight]}>
          <Tab label="For you" on dark={hasCards} />
          <Tab label="Saved" dark={hasCards} onPress={onSaved} />
          <Tab label="Applied" dark={hasCards} onPress={onApplied} />
        </View>
        <View style={s.topRight}>
          <RoundBtn icon="filter" label="Filters" dark={hasCards} badge={activeCount} onPress={() => setSheetOpen(true)} />
          <RoundBtn icon="chat" label="Chat" dark={hasCards} onPress={onChat} />
        </View>
      </View>

      {hasCards && !!error && (
        <View style={[s.errorWrap, { top: insets.top + 64 }]}><Banner tone="danger">{error}</Banner></View>
      )}

      {/* ── position + action rail ───────────────────────────────── */}
      {hasCards && <Dots count={cards.length} index={i} />}
      {hasCards && !!current && (
        <View style={s.rail}>
          <RailBtn icon="undo" label="Undo" disabled={busy || !last} onPress={undo} />
          <RailBtn icon="x" label={'Not\ninterested'} tint={color.dangerOnInk} disabled={busy} onPress={() => decide(current, 'LEFT')} />
          <RailBtn icon="heart" label={current.saved ? 'Saved' : 'Save'} primary saved={current.saved} disabled={busy || current.saved} onPress={() => decide(current, 'RIGHT')} />
          <RailBtn icon="info" label="Details" onPress={() => setDetails(current)} />
        </View>
      )}

      {!!last && (
        <View style={s.toastWrap}>
          <UndoToast
            title={`${last.direction === 'RIGHT' ? 'Saved' : 'Not interested'} · ${last.card.title}`}
            note={`Nothing was sent.${last.direction === 'LEFT' ? ' Hidden for 60 days.' : ''}`}
            onUndo={undo}
            disabled={busy}
          />
        </View>
      )}

      <JobDetailsSheet
        card={details}
        busy={busy}
        onClose={() => setDetails(null)}
        onSkip={() => { const c = details; setDetails(null); if (c) void decide(c, 'LEFT') }}
        onSave={() => { const c = details; setDetails(null); if (c) void decide(c, 'RIGHT') }}
        onApply={(id) => { setDetails(null); if (onApply) onApply(id); else onOpen(id) }}
      />

      <JobFilterSheet open={sheetOpen} initial={filters} onClose={() => setSheetOpen(false)} onApply={(f) => { setSheetOpen(false); applyFilters(f) }} />
    </View>
  )
}

// ── one job, one screen ───────────────────────────────────────────────────────

const JobPage = React.memo(function JobPage({
  card, index, height, locked, onDetails, onSwipe,
}: { card: JobCard; index: number; height: number; locked: boolean; onDetails: () => void; onSwipe: (dir: 'RIGHT' | 'LEFT') => void }) {
  const [a, b, c] = GROUNDS[index % GROUNDS.length]
  const pay = salaryRange(card.salary)
  const id = `ground${index % GROUNDS.length}`
  const { width } = useWindowDimensions()

  // A horizontal drag decides: right saves, left is not interested. A vertical drag fails this handler
  // (failOffsetY), so the list keeps scrolling to the next job and nothing is recorded.
  const tx = useRef(new Animated.Value(0)).current
  const onGestureEvent = useMemo(() => Animated.event([{ nativeEvent: { translationX: tx } }], { useNativeDriver: true }), [tx])
  const home = useCallback(() => Animated.spring(tx, { toValue: 0, friction: 6, useNativeDriver: true }).start(), [tx])
  const onStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationX, velocityX } = e.nativeEvent
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return
    const right = translationX > 110 || (translationX > 40 && velocityX > 800)
    const left = translationX < -110 || (translationX < -40 && velocityX < -800)
    // Already saved, or a decision is in flight: nothing to record, so the card just settles back.
    if ((!right && !left) || locked || (right && card.saved)) { home(); return }
    const dir = right ? 'RIGHT' : 'LEFT'
    Animated.timing(tx, { toValue: (right ? 1 : -1) * width * 1.2, duration: 200, useNativeDriver: true }).start(() => {
      onSwipe(dir)
      // A saved card stays in the list, marked; bring it back. A dismissed one is removed.
      if (right) tx.setValue(0)
    })
  }, [card.saved, home, locked, onSwipe, tx, width])
  const saveStamp = tx.interpolate({ inputRange: [40, 140], outputRange: [0, 1], extrapolate: 'clamp' })
  const skipStamp = tx.interpolate({ inputRange: [-140, -40], outputRange: [1, 0], extrapolate: 'clamp' })
  const tilt = tx.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-4deg', '0deg', '4deg'] })

  return (
    <View style={[s.job, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="0.6" stopColor={b} />
            <Stop offset="1" stopColor={c} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>

      <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onStateChange} activeOffsetX={[-20, 20]} failOffsetY={[-14, 14]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }, { rotate: tilt }] }]}>
      <Animated.View style={[s.stamp, s.stampLeft, { opacity: saveStamp }]} pointerEvents="none"><DeckStamp kind="save" /></Animated.View>
      <Animated.View style={[s.stamp, s.stampRight, { opacity: skipStamp }]} pointerEvents="none"><DeckStamp kind="skip" /></Animated.View>
      {card.video?.url ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Play the job film" onPress={onDetails} style={s.play}>
          <Svg width={32} height={32} viewBox="0 0 24 24"><Path d="M8 5.5v13l11-6.5z" fill={color.textInverse} /></Svg>
        </Pressable>
      ) : (
        <View style={s.logoBig}><Text style={s.logoBigText}>{initialsOf(card.company.name)}</Text></View>
      )}

      <Pressable accessibilityRole="button" accessibilityHint="Opens the full job" onPress={onDetails} style={s.info}>
        {card.saved && <View style={s.savedPill}><Text style={s.savedText}>SAVED</Text></View>}
        {!!card.video?.url && (
          <View style={s.glass}><Text style={s.glassText}>{`VIDEO JOB · ${fmtDuration(card.video.durationSec)}`}</Text></View>
        )}
        <View style={s.companyRow}>
          <View style={s.logoSm}><Text style={s.logoSmText}>{initialsOf(card.company.name)}</Text></View>
          <View style={s.grow}>
            <Text style={s.company} numberOfLines={1}>{card.company.name}</Text>
            {!!card.publishedAt && <Text style={s.posted}>{`Posted ${dateLine(card.publishedAt)}`}</Text>}
          </View>
        </View>
        <Text style={s.title} numberOfLines={3}>{card.title}</Text>
        {!!pay && <Text style={s.pay}>{pay}</Text>}
        <Text style={s.meta}>{cardMeta(card)}</Text>
        <View style={s.chips}>
          {card.skills.slice(0, 4).map((k) => (
            <View key={k} style={s.chip}><Text style={s.chipText}>{k.toUpperCase()}</Text></View>
          ))}
        </View>
        <View style={s.hint}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M6 15l6-6 6 6" stroke={color.textOnInkMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          <Text style={s.hintText}>Scroll up for next · swipe right to save</Text>
        </View>
      </Pressable>
      </Animated.View>
      </PanGestureHandler>
    </View>
  )
})

function Tab({ label, on, dark, onPress }: { label: string; on?: boolean; dark: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!on }}
      onPress={on ? undefined : onPress}
      style={[s.tab, on && (dark ? s.tabOnDark : s.tabOnLight)]}
    >
      <Text style={[s.tabText, { color: on ? (dark ? color.ink : color.accent) : dark ? color.textOnInkMuted : color.textMuted }]}>{label}</Text>
    </Pressable>
  )
}

function RoundBtn({
  icon, label, dark, badge, onPress,
}: { icon: IconName; label: string; dark: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.round, dark ? s.roundDark : s.roundLight, pressed && s.pressed]}
    >
      <Icon name={icon} size={22} tint={dark ? color.textInverse : color.text} />
      {!!badge && <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>}
    </Pressable>
  )
}

function RailBtn({
  icon, label, tint, primary, saved, disabled, onPress,
}: { icon: IconName; label: string; tint?: string; primary?: boolean; saved?: boolean; disabled?: boolean; onPress?: () => void }) {
  return (
    <View style={s.railItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label.replace('\n', ' ')}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          s.railBtn,
          primary ? (saved ? s.railSaved : s.railPrimary) : s.roundDark,
          disabled && !saved && s.dim,
          pressed && s.pressed,
        ]}
      >
        <Icon
          name={icon}
          size={24}
          tint={primary ? (saved ? color.accent : color.textInverse) : tint ?? color.textInverse}
          fill={primary && saved ? color.accent : undefined}
        />
      </Pressable>
      <Text style={s.railLabel}>{label}</Text>
    </View>
  )
}

/** Up to five marks beside the page: the lit one is where you are. */
function Dots({ count, index }: { count: number; index: number }) {
  const shown = Math.min(count, 5)
  const start = Math.max(0, Math.min(index - 2, count - shown))
  return (
    <View style={s.dots} pointerEvents="none">
      {Array.from({ length: shown }, (_, k) => (
        <View key={k} style={[s.dot, start + k === index && s.dotOn]} />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  pager: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },
  state: { flex: 1, paddingHorizontal: 16 },
  stateCentre: { justifyContent: 'center' },

  job: { width: '100%', overflow: 'hidden' },
  stamp: { position: 'absolute', top: 96, zIndex: 2 },
  stampLeft: { left: 16 },
  stampRight: { right: 16 },
  play: {
    position: 'absolute', alignSelf: 'center', top: '30%', width: 78, height: 78, borderRadius: 39,
    backgroundColor: color.onInkPlay, borderWidth: borderWidth.medium, borderColor: color.onInkOutline,
    alignItems: 'center', justifyContent: 'center',
  },
  logoBig: {
    position: 'absolute', alignSelf: 'center', top: '28%', width: 96, height: 96, borderRadius: 28,
    backgroundColor: color.onInkPlay, borderWidth: borderWidth.medium, borderColor: color.onInkOutline,
    alignItems: 'center', justifyContent: 'center',
  },
  logoBigText: { fontFamily: FF.bodyBold, fontSize: 34, color: color.textInverse },
  info: { position: 'absolute', left: 20, right: RAIL_W, bottom: RAIL_BOTTOM, gap: 10 },
  savedPill: { alignSelf: 'flex-start', backgroundColor: color.successSoft, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  savedText: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1, color: color.success },
  glass: { alignSelf: 'flex-start', backgroundColor: color.onInkGround, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  glassText: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1, color: color.textInverse },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSm: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: color.onInkPlay, borderWidth: borderWidth.medium,
    borderColor: color.onInkOutline, alignItems: 'center', justifyContent: 'center',
  },
  logoSmText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.textInverse },
  company: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.textInverse },
  posted: { fontFamily: FF.body, fontSize: 12.5, color: color.textOnInkMuted },
  title: { fontFamily: FF.bodyBold, fontSize: 32, lineHeight: 34, letterSpacing: -1.28, color: color.textInverse },
  pay: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.textInverse },
  meta: { fontFamily: FF.monoMedium, fontSize: 11, lineHeight: 19, letterSpacing: 1.1, color: color.textOnInkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: borderWidth.thin, borderColor: color.onInkOutline, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  chipText: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 0.9, color: color.textInverse },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontFamily: FF.body, fontSize: 13, color: color.textOnInkMuted },

  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: color.scrim, borderRadius: radius.pill, padding: 4 },
  tabsLight: { backgroundColor: color.surfaceMuted },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill },
  tabOnDark: { backgroundColor: color.textInverse },
  tabOnLight: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  tabText: { fontFamily: FF.bodySemiBold, fontSize: 14 },
  topRight: { flexDirection: 'row', gap: 8 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  roundDark: { backgroundColor: color.scrim },
  roundLight: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: FF.bodyBold, fontSize: 11, color: color.textInverse },
  errorWrap: { position: 'absolute', left: 16, right: 16 },

  rail: { position: 'absolute', right: 14, bottom: RAIL_BOTTOM, gap: 14, alignItems: 'center' },
  railItem: { alignItems: 'center', gap: 4 },
  railBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  railPrimary: { backgroundColor: color.accent },
  railSaved: { backgroundColor: color.textInverse },
  railLabel: { fontFamily: FF.bodySemiBold, fontSize: 11.5, textAlign: 'center', color: color.textInverse },
  dots: { position: 'absolute', right: 6, top: '45%', gap: 6 },
  dot: { width: 4, height: 14, borderRadius: 4, backgroundColor: color.onInkTrack },
  dotOn: { height: 28, backgroundColor: color.textInverse },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 16 },
})
