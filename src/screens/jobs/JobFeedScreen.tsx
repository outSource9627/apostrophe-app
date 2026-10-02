import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import Video from 'react-native-video'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { ApiClientError } from '../../lib/api'
import { getFeed, getFilters, swipeJob, undoSwipe, type JobCard, type JobFilters } from '../../lib/api/jobs'
import {
  activeFilterCount, applicationMark, dateLine, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange,
} from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, EmptyState, ErrorState } from '../../components/ui'
import {
  FeedActions, FeedCardFrame, FeedCardTop, FeedFilmBar, FeedGlassButton, FeedHud, FeedMeta, FeedPill, FeedPills, FeedShade,
  FeedSkeleton, FeedStamp, FeedTag, FeedToast, FeedTopButton, feedText,
} from '../../components/ui/feed-deck'
import { useLightStatusBar } from '../../lib/useLightStatusBar'
import { useDarkTabBar } from '../../navigation/tabBarTone'
import { JobFilterSheet } from './JobFilterSheet'
import { JobDetailsSheet } from './JobDetailsSheet'

/**
 * The job feed (docs/tinder-feed-mockups.html · design 1, student mode).
 *
 * One job per card. The card runs from under the tabs to just above the tab
 * bar; its facts sit at the foot and the four round buttons are fixed over it.
 *
 * - swipe right / ♥ → Save (never applies);
 * - swipe left / ✕ → Not interested (the server hides it; the toast says for how long);
 * - drag up → Skip: nothing is sent or saved, and the toast's Back returns it;
 * - ↺ → Undo the last save or not-interested (the server keeps one);
 * - ✈ → Apply with the video resume; ⌃ → the full post.
 *
 * States: loading (a dark card), the deck, caught up (with "Show skipped jobs"
 * when any were skipped), no match for the filters, and an error. The page and
 * the tab bar are dark only while a card or the loading card is up; the empty
 * and error states are drawn on the light page.
 */

const PAGE = 15
/** A committed drag, or a quick flick past a smaller distance — sideways, and upward for a skip. */
const COMMIT_X = 120
const FLICK_X = 40
const COMMIT_Y = 110
const FLICK_Y = 40
const FLICK_V = 800
/** Which way a drag goes is decided once, after this much movement — one drag never does two things. */
const AXIS_LOCK = 12
const TOAST_MS = 4000
const DAY_MS = 86_400_000

type Direction = 'RIGHT' | 'LEFT'
type Deck = { cards: JobCard[]; i: number }
type Toast =
  | { kind: 'decision'; message: string; note: string }
  | { kind: 'skip'; message: string; note: string; card: JobCard }
  | { kind: 'error'; message: string; note?: string }

const initialsOf = (name?: string | null) =>
  (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'
const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** Put `card` back on top of the deck, wherever it sits now (a skip may have come after it). */
function restore(d: Deck, card: JobCard): Deck {
  const at = d.cards.findIndex((c) => c.id === card.id)
  if (at === d.i - 1) return { ...d, i: d.i - 1 }
  if (at === d.i) return d
  const cards = at === -1 ? [...d.cards] : d.cards.filter((_, k) => k !== at)
  const i = at !== -1 && at < d.i ? d.i - 1 : d.i
  cards.splice(i, 0, card)
  return { cards, i }
}

export function JobFeedScreen({ onBack, onOpen, onSaved, onApplied, onApply, onChat }: {
  onBack: () => void
  /** The full Job page — kept for deep links; the ⌃ on a card opens the details sheet. */
  onOpen: (id: string) => void
  onSaved: () => void
  onApplied?: () => void
  onApply?: (id: string) => void
  onChat: () => void
}) {
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const { width, height: screenH } = useWindowDimensions()

  const [deck, setDeck] = useState<Deck>({ cards: [], i: 0 })
  const [cursor, setCursor] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<JobFilters>({})
  const [last, setLast] = useState<{ card: JobCard; direction: Direction } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [muted, setMuted] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [details, setDetails] = useState<JobCard | null>(null)
  /** Bumped by every reset, so a page that lands after the filters changed is dropped. */
  const gen = useRef(0)

  const { cards, i } = deck
  const current = cards[i] ?? null
  const next = cards[i + 1] ?? null
  const activeCount = activeFilterCount(filters)
  const dark = !!current || (loading && !error)
  useLightStatusBar(dark)
  useDarkTabBar(dark)

  const fetchMore = useCallback(async (reset: boolean, applyFilters?: JobFilters) => {
    const my = reset ? ++gen.current : gen.current
    setLoading(true)
    if (reset) setError(null)
    try {
      let cur: string | null = reset ? null : cursor
      let done = false
      const collected: JobCard[] = []
      // A page can come back empty while more remain (everything on it was hidden); walk on a little.
      for (let round = 0; round < 4; round++) {
        const r = await getFeed({ ...(applyFilters ?? filters), cursor: cur ?? undefined, limit: PAGE })
        collected.push(...r.cards)
        cur = r.nextCursor
        if (r.nextCursor === null) { done = true; break }
        if (collected.length > 0) break
      }
      if (my !== gen.current) return
      setCursor(cur)
      setExhausted(done)
      setDeck((d) => {
        if (reset) return { cards: collected, i: 0 }
        const have = new Set(d.cards.map((c) => c.id))
        return { ...d, cards: [...d.cards, ...collected.filter((c) => !have.has(c.id))] }
      })
      if (reset) setSkipped(false)
    } catch (e) {
      if (my !== gen.current) return
      if (e instanceof ApiClientError && e.isPaywall) { onBack(); return }
      if (e instanceof ApiClientError && e.status === 404) { setError('Finish your profile first.'); return }
      setError(e instanceof Error ? e.message : 'Could not load jobs.')
    } finally {
      if (my === gen.current) setLoading(false)
    }
  }, [cursor, filters, onBack])

  useEffect(() => {
    getFilters().then((r) => { setFilters(r.filters); fetchMore(true, r.filters) }).catch(() => fetchMore(true, {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a few cards ahead. Never after a failed page — "Try again" asks again.
  useEffect(() => {
    if (!loading && !exhausted && !error && cards.length - i <= 3) fetchMore(false)
  }, [i, cards.length, loading, exhausted, error, fetchMore])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const applyFilters = useCallback((f: JobFilters) => {
    setFilters(f)
    setExhausted(false)
    setToast(null)
    fetchMore(true, f)
  }, [fetchMore])

  // ── the gesture ────────────────────────────────────────────────────────────
  const gx = useRef(new Animated.Value(0)).current
  const gy = useRef(new Animated.Value(0)).current
  const lockX = useRef(new Animated.Value(1)).current
  const lockY = useRef(new Animated.Value(1)).current
  const axis = useRef<'x' | 'y' | null>(null)
  const tx = useMemo(() => Animated.multiply(gx, lockX), [gx, lockX])
  const ty = useMemo(() => Animated.multiply(gy, lockY), [gy, lockY])

  const unlock = useCallback(() => {
    axis.current = null
    lockX.setValue(1)
    lockY.setValue(1)
  }, [lockX, lockY])

  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(gx, { toValue: 0, friction: 7, useNativeDriver: true }),
      Animated.spring(gy, { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start(unlock)
  }, [gx, gy, unlock])

  // The next card is on top once React has drawn it; only then snap the values home.
  useLayoutEffect(() => {
    gx.setValue(0)
    gy.setValue(0)
    unlock()
  }, [i, current?.id, gx, gy, unlock])

  /** Records a decision for a card that has already left the screen; a refusal puts it back. */
  const commit = useCallback(async (card: JobCard, direction: Direction, my: number) => {
    try {
      let until: string | null = null
      try {
        until = (await swipeJob(card.id, direction)).suppressedUntil
      } catch (e) {
        // The server already holds a decision for this job — it stands, as if just made.
        if (!(e instanceof ApiClientError && e.code === 'CONFLICT')) throw e
      }
      const days = until ? Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS)) : null
      setLast({ card, direction })
      setToast({
        kind: 'decision',
        message: `${direction === 'RIGHT' ? 'Saved' : 'Not interested'} · ${card.title}`,
        note: direction === 'RIGHT'
          ? 'In your saved jobs. Nothing was sent.'
          : `Nothing was sent.${days ? ` Hidden for ${days} ${days === 1 ? 'day' : 'days'}.` : ''}`,
      })
    } catch (e) {
      if (my === gen.current) setDeck((d) => restore(d, card))
      setToast({ kind: 'error', message: 'That didn’t save — the job is back.', note: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }, [])

  const fling = useCallback((direction: Direction) => {
    if (!current || busy) {
      springBack()
      return
    }
    const card = current
    const my = gen.current
    setBusy(true)
    setToast(null)
    lockY.setValue(0)
    Animated.timing(gx, { toValue: (direction === 'RIGHT' ? 1 : -1) * width * 1.4, duration: 220, useNativeDriver: true }).start(() => {
      if (my === gen.current) setDeck((d) => (d.cards[d.i]?.id === card.id ? { ...d, i: d.i + 1 } : d))
      commit(card, direction, my)
    })
  }, [current, busy, springBack, gx, lockY, width, commit])

  /** Skip: nothing is sent, nothing is saved; Back puts the card on top again. */
  const skip = useCallback(() => {
    if (!current || busy) {
      springBack()
      return
    }
    const card = current
    const my = gen.current
    // Held for the 240 ms the card takes to leave, so an Undo or Back can't land mid-flight.
    setBusy(true)
    lockX.setValue(0)
    Animated.timing(gy, { toValue: -screenH, duration: 240, useNativeDriver: true }).start(() => {
      setBusy(false)
      if (my !== gen.current) return
      setDeck((d) => (d.cards[d.i]?.id === card.id ? { ...d, i: d.i + 1 } : d))
      setSkipped(true)
      setToast({ kind: 'skip', card, message: `Skipped · ${card.title}`, note: 'Nothing was saved. It can come back later.' })
    })
  }, [current, busy, springBack, gy, lockX, screenH])

  const onGesture = useMemo(
    () => Animated.event([{ nativeEvent: { translationX: gx, translationY: gy } }], {
      useNativeDriver: true,
      listener: (e: PanGestureHandlerGestureEvent) => {
        if (axis.current) return
        const { translationX: x, translationY: y } = e.nativeEvent
        if (Math.abs(x) < AXIS_LOCK && Math.abs(y) < AXIS_LOCK) return
        axis.current = Math.abs(x) >= Math.abs(y) ? 'x' : 'y'
        lockX.setValue(axis.current === 'x' ? 1 : 0)
        lockY.setValue(axis.current === 'y' ? 1 : 0)
      },
    }),
    [gx, gy, lockX, lockY],
  )

  const onStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state: st, translationX: x, translationY: y, velocityX: vx, velocityY: vy } = e.nativeEvent
    if (st !== State.END && st !== State.CANCELLED && st !== State.FAILED) return
    const a = axis.current
    if (a === 'y' && st === State.END && (y < -COMMIT_Y || (y < -FLICK_Y && vy < -FLICK_V))) skip()
    else if (a === 'x' && st === State.END && (x > COMMIT_X || (x > FLICK_X && vx > FLICK_V))) fling('RIGHT')
    else if (a === 'x' && st === State.END && (x < -COMMIT_X || (x < -FLICK_X && vx < -FLICK_V))) fling('LEFT')
    else springBack()
  }, [fling, skip, springBack])

  const undo = useCallback(async () => {
    if (busy || !last) return
    setBusy(true)
    try {
      const r = await undoSwipe()
      if (r.undone && r.jobId === last.card.id) setDeck((d) => restore(d, last.card))
      // The server undid a different decision than the one in hand: read the deck again.
      else if (r.undone) fetchMore(true)
      setLast(null)
      setToast(null)
    } catch (e) {
      setToast({ kind: 'error', message: 'Couldn’t undo that.', note: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }, [busy, last, fetchMore])

  const back = useCallback((card: JobCard) => {
    setDeck((d) => restore(d, card))
    setToast(null)
  }, [])

  const apply = useCallback((id: string) => {
    if (onApply) onApply(id)
    else onOpen(id)
  }, [onApply, onOpen])

  const rotate = tx.interpolate({ inputRange: [-width, 0, width], outputRange: ['-10deg', '0deg', '10deg'] })
  const saveStamp = tx.interpolate({ inputRange: [FLICK_X, COMMIT_X + 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const passStamp = tx.interpolate({ inputRange: [-(COMMIT_X + 20), -FLICK_X], outputRange: [1, 0], extrapolate: 'clamp' })
  const skipStamp = ty.interpolate({ inputRange: [-(COMMIT_Y + 20), -FLICK_Y], outputRange: [1, 0], extrapolate: 'clamp' })
  // The next card grows into place as the top one leaves, sideways or upward.
  const grow = Animated.add(
    tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [1, 0, 1], extrapolate: 'clamp' }),
    ty.interpolate({ inputRange: [-200, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
  )
  const nextScale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1], extrapolate: 'clamp' })
  const nextLift = grow.interpolate({ inputRange: [0, 1], outputRange: [space.md, 0], extrapolate: 'clamp' })

  const playing = focused && !sheetOpen && !details

  let stage: React.ReactNode
  if (current) {
    // The top card and the one behind it, in a fixed order with the top raised — so when
    // the deck moves on, the card behind keeps its player (and its loaded first frame).
    const pair = [current, next].filter((c): c is JobCard => !!c)
    stage = (
      <>
        <PanGestureHandler onGestureEvent={onGesture} onHandlerStateChange={onStateChange} activeOffsetX={[-10, 10]} activeOffsetY={[-10, 10]}>
          <Animated.View style={StyleSheet.absoluteFill}>
            {pair.map((c) => {
              const top = c.id === current.id
              return (
                <Animated.View
                  key={c.id}
                  pointerEvents={top ? 'auto' : 'none'}
                  style={[
                    StyleSheet.absoluteFill,
                    top
                      ? [s.top1, { transform: [{ translateX: tx }, { translateY: ty }, { rotate }] }]
                      : [s.top0, { transform: [{ translateY: nextLift }, { scale: nextScale }] }],
                  ]}
                  accessibilityActions={top ? [{ name: 'skip', label: 'Skip this job' }] : undefined}
                  onAccessibilityAction={top ? (ev) => ev.nativeEvent.actionName === 'skip' && skip() : undefined}
                >
                  <JobCardView
                    card={c}
                    active={top && playing}
                    muted={!top || muted}
                    onToggleMute={() => setMuted((m) => !m)}
                    onOpen={() => setDetails(c)}
                    stamps={top && (
                      <>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: saveStamp }]} pointerEvents="none"><FeedStamp kind="like" label="SAVE" /></Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: passStamp }]} pointerEvents="none"><FeedStamp kind="pass" label="NOT INTERESTED" /></Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: skipStamp }]} pointerEvents="none"><FeedStamp kind="skip" label="SKIP" /></Animated.View>
                      </>
                    )}
                  />
                </Animated.View>
              )
            })}
          </Animated.View>
        </PanGestureHandler>

        <FeedActions
          canUndo={!!last}
          disabled={busy}
          passLabel="Not interested"
          likeLabel="Save"
          planeLabel="Apply with video resume"
          onUndo={() => { undo() }}
          onPass={() => fling('LEFT')}
          onLike={() => fling('RIGHT')}
          onPlane={() => apply(current.id)}
        />
      </>
    )
  } else if (loading && !error) {
    stage = <FeedSkeleton label="Loading jobs" />
  } else if (error) {
    stage = (
      <View style={s.state}>
        <ErrorState
          title="Could not load jobs."
          body={error}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => { fetchMore(true) }} />}
        />
      </View>
    )
  } else {
    stage = (
      <View style={s.state}>
        <EmptyState
          title={activeCount > 0 ? 'No jobs match your filters.' : 'You are all caught up.'}
          body={activeCount > 0
            ? 'Widen or clear your filters to see more.'
            : skipped ? 'You skipped some jobs on the way — they are still here.' : 'New jobs land here daily.'}
          action={
            <View style={s.stateActions}>
              {skipped && <Button variant="primary" size="md" label="Show skipped jobs" onPress={() => { fetchMore(true) }} />}
              {activeCount > 0
                ? <Button variant="outline" size="md" label="Adjust filters" onPress={() => setSheetOpen(true)} />
                : <Button variant={skipped ? 'outline' : 'primary'} size="md" label="Your saved jobs" onPress={onSaved} />}
            </View>
          }
        />
      </View>
    )
  }

  return (
    <View style={[s.page, { backgroundColor: dark ? color.inkDeep : color.background }]}>
      <View style={[s.bar, { paddingTop: insets.top + spaceHalf['1.5'] }]}>
        <View style={[s.tabs, dark ? s.tabsDark : s.tabsLight]}>
          <Tab label="For you" on dark={dark} />
          <Tab label="Saved" dark={dark} onPress={onSaved} />
          <Tab label="Applied" dark={dark} onPress={onApplied} />
        </View>
        <View style={s.barRight}>
          <FeedTopButton icon="filter" label="Filters" dark={dark} badge={activeCount} onPress={() => setSheetOpen(true)} />
          <FeedTopButton icon="chat" label="Chats" dark={dark} onPress={onChat} />
        </View>
      </View>

      <View style={s.stage}>
        {stage}
        {!!toast && (
          <FeedToast
            message={toast.message}
            note={toast.note}
            action={toast.kind === 'skip' ? 'Back' : toast.kind === 'decision' && last ? 'Undo' : undefined}
            disabled={busy}
            onAction={() => {
              if (toast.kind === 'skip') back(toast.card)
              else undo()
            }}
          />
        )}
      </View>

      <JobDetailsSheet
        card={details}
        busy={busy}
        onClose={() => setDetails(null)}
        onSkip={() => { setDetails(null); fling('LEFT') }}
        onSave={() => { setDetails(null); fling('RIGHT') }}
        onApply={(id) => { setDetails(null); apply(id) }}
      />

      <JobFilterSheet
        open={sheetOpen}
        initial={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => { setSheetOpen(false); applyFilters(f) }}
      />
    </View>
  )
}

// ── one job, as a feed card ──────────────────────────────────────────────────

function JobCardView({
  card, active, muted, onToggleMute, onOpen, stamps,
}: {
  card: JobCard
  active: boolean
  muted: boolean
  onToggleMute: () => void
  onOpen: () => void
  stamps?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const url = card.video?.url ?? null
  const hasVideo = !!url && !failed
  const pay = salaryRange(card.salary)
  const type = employmentLabel(card.employmentType)
  const status = card.applicationStatus ? applicationMark(card.applicationStatus).label : null
  // Each fact once: a post whose location is "Remote", and is remote, and is a Remote job, says so in its pill only.
  const said = new Set([type.toLowerCase()])
  const meta = [...(locationLine(card.location, card.remote) ?? '').split(' · '), experienceLine(card.experience), deadlineLine(card.applicationDeadline)]
    .filter((part): part is string => {
      if (!part || said.has(part.toLowerCase())) return false
      said.add(part.toLowerCase())
      return true
    })
    .join(' · ')

  return (
    <FeedCardFrame>
      {hasVideo ? (
        <Video
          source={{ uri: url! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          muted={muted}
          repeat
          paused={!active}
          playInBackground={false}
          progressUpdateInterval={250}
          onProgress={(p) => {
            if (p.seekableDuration > 0) progress.setValue(Math.min(1, p.currentTime / p.seekableDuration))
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id={`jobGround-${card.id}`} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={color.accentDeep} />
              <Stop offset="0.6" stopColor={color.inkRaised} />
              <Stop offset="1" stopColor={color.inkDeep} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#jobGround-${card.id})`} />
        </Svg>
      )}
      <FeedShade />
      {hasVideo && <FeedFilmBar progress={progress} />}

      <FeedCardTop
        left={<FeedTag label={hasVideo ? `Video pitch · ${fmtDuration(card.video!.durationSec)}` : card.category?.trim() || 'Job post'} />}
        right={hasVideo ? <FeedGlassButton icon={muted ? 'mute' : 'sound'} label={muted ? 'Turn the sound on' : 'Mute'} onPress={onToggleMute} /> : null}
      />

      {stamps}

      <FeedHud>
        <View style={s.company}>
          <View style={s.logo}><Text style={s.logoText}>{initialsOf(card.company?.name)}</Text></View>
          <View style={s.grow}>
            <Text style={feedText.name} numberOfLines={1}>{card.company?.name}</Text>
            {!!card.publishedAt && <Text style={feedText.sub} numberOfLines={1}>{`Posted ${dateLine(card.publishedAt)}`}</Text>}
          </View>
          <FeedGlassButton icon="chevU" tone="light" label="Full job details" onPress={onOpen} />
        </View>
        <Text style={feedText.title} numberOfLines={2}>{card.title}</Text>
        <FeedPills>
          {!!pay && <FeedPill tone="pink" label={pay} />}
          <FeedPill tone="pink" label={type} />
          {!!status && <FeedPill tone="dark" label={status} />}
          {card.skills.slice(0, 3).map((sk) => <FeedPill key={sk} tone="dark" label={sk} />)}
        </FeedPills>
        {!!meta && <FeedMeta label={meta} />}
      </FeedHud>
    </FeedCardFrame>
  )
}

function Tab({ label, on, dark, onPress }: { label: string; on?: boolean; dark: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!on }}
      onPress={on ? undefined : onPress}
      style={({ pressed }) => [s.tab, on && (dark ? s.tabOnDark : s.tabOnLight), pressed && s.pressed]}
    >
      <Text style={[s.tabText, { color: on ? (dark ? color.ink : color.accent) : dark ? color.textOnInkMuted : color.textMuted }]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  page: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },

  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  barRight: { flexDirection: 'row', gap: space.sm },
  tabs: { flexDirection: 'row', gap: space.xs, borderRadius: radius.pill, padding: space.xs },
  tabsDark: { backgroundColor: color.inkRaised },
  tabsLight: { backgroundColor: color.surfaceMuted },
  tab: { paddingVertical: spaceHalf['1.5'], paddingHorizontal: space.md, borderRadius: radius.pill },
  tabOnDark: { backgroundColor: color.textOnInk },
  tabOnLight: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  tabText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'] },

  /** The card runs from under the tabs straight into the tab bar; its foot fades into the same black. */
  stage: { flex: 1, marginHorizontal: spaceHalf['2.5'] },
  top0: { zIndex: 1 },
  top1: { zIndex: 2 },
  state: { flex: 1, justifyContent: 'center', paddingHorizontal: space.sm },
  stateActions: { gap: space.sm, alignItems: 'center' },

  company: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  logo: {
    width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.onInkEdge, borderWidth: borderWidth.thin, borderColor: color.onInkOutline,
  },
  logoText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInk },
})
