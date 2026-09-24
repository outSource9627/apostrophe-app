import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { ApiClientError } from '../../lib/api'
import { getFeed, getFilters, swipeJob, undoSwipe, type JobCard, type JobFilters } from '../../lib/api/jobs'
import { activeFilterCount, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange } from '../../lib/jobs/format'
import { color, space, radius, borderWidth, height } from '../../theme'
import { Banner, Button, DeckActions, DeckStamp, EmptyState, ErrorState, JobDeckCard, JobsHeader, Skeleton, UndoToast, text } from '../../components/ui'
import { JobFilterSheet } from './JobFilterSheet'
import { JobDetailsSheet } from './JobDetailsSheet'

/**
 * ST-35 — the job feed. A SWIPE SAVES; IT NEVER APPLIES. Right saves, left marks
 * not-interested (60-day suppression), the last swipe is undoable — and the
 * card carries NO Apply, no send language, no match celebration. The swipe
 * overlay reads only as "saved" or "dismissed" (muted, never crimson for
 * dismiss). Buttons back the gesture for reach and accessibility.
 */
export function JobFeedScreen({ onBack, onOpen, onSaved, onApplied, onApply }: {
  onBack: () => void
  /** The full Job page — kept for deep links; a tap in the deck opens the details sheet. */
  onOpen: (id: string) => void
  onSaved: () => void
  onApplied?: () => void
  onApply?: (id: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [cards, setCards] = useState<JobCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [i, setI] = useState(0)
  const [filters, setFilters] = useState<JobFilters>({})
  const [last, setLast] = useState<{ card: JobCard; direction: 'RIGHT' | 'LEFT' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [details, setDetails] = useState<JobCard | null>(null)

  // The drag runs on the UI thread: the finger drives these two values natively
  // (Animated.event with the native driver), so the card tracks the thumb without
  // a JS round trip per frame. JS only decides, on release, where the card goes.
  const tx = useRef(new Animated.Value(0)).current
  const ty = useRef(new Animated.Value(0)).current
  const ty4 = useMemo(() => Animated.multiply(ty, 0.25), [ty])
  const { width } = useWindowDimensions()

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
      if (reset) setI(0)
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
    if (!loading && !exhausted && cards.length - i <= 2) void fetchMore(false)
  }, [i, cards.length, loading, exhausted, fetchMore])

  const applyFilters = useCallback((f: JobFilters) => { setFilters(f); setExhausted(false); void fetchMore(true, f) }, [fetchMore])

  const current = cards[i]
  const activeCount = activeFilterCount(filters)

  const commitSwipe = useCallback(async (card: JobCard, direction: 'RIGHT' | 'LEFT') => {
    setBusy(true); setError(null)
    try { await swipeJob(card.id, direction); setLast({ card, direction }) }
    catch (e) { if (!(e instanceof ApiClientError && e.code === 'CONFLICT')) setError(e instanceof Error ? e.message : 'Could not save that.') }
    finally { setBusy(false) }
  }, [])

  const fling = useCallback((direction: 'RIGHT' | 'LEFT') => {
    if (!current || busy) {
      Animated.parallel([
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, useNativeDriver: true }),
      ]).start()
      return
    }
    const card = current
    Animated.timing(tx, { toValue: (direction === 'RIGHT' ? 1 : -1) * width * 1.4, duration: 220, useNativeDriver: true }).start(() => {
      setI((n) => n + 1)
      void commitSwipe(card, direction)
    })
  }, [current, busy, tx, ty, width, commitSwipe])

  // The next card is on top once React has drawn it; only then snap the values
  // home, so the old card never flashes back to the centre for a frame.
  useLayoutEffect(() => { tx.setValue(0); ty.setValue(0) }, [i, current?.id, tx, ty])

  const onGestureEvent = useMemo(
    () => Animated.event([{ nativeEvent: { translationX: tx, translationY: ty } }], { useNativeDriver: true }),
    [tx, ty],
  )
  const onHandlerStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationX, velocityX } = e.nativeEvent
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return
    // A committed drag, or a quick flick past a smaller distance.
    if (translationX > 120 || (translationX > 40 && velocityX > 800)) fling('RIGHT')
    else if (translationX < -120 || (translationX < -40 && velocityX < -800)) fling('LEFT')
    else {
      Animated.parallel([
        Animated.spring(tx, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start()
    }
  }, [fling, tx, ty])

  async function undo() {
    setBusy(true)
    try {
      const r = await undoSwipe()
      if (r.undone && last && last.card.id === r.jobId) setCards((prev) => { const n = [...prev]; n.splice(i, 0, last.card); return n })
      setLast(null)
    } catch { /* nothing */ } finally { setBusy(false) }
  }

  const rotate = tx.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-6deg', '0deg', '6deg'] })
  const saveOpacity = tx.interpolate({ inputRange: [40, 140], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = tx.interpolate({ inputRange: [-140, -40], outputRange: [1, 0], extrapolate: 'clamp' })
  // The next card grows into place as the top one is dragged away.
  const nextScale = tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [1, 0.95, 1], extrapolate: 'clamp' })
  const nextLift = tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [0, space.md, 0], extrapolate: 'clamp' })

  const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const cardMeta = (c: JobCard) =>
    [locationLine(c.location, c.remote), employmentLabel(c.employmentType), experienceLine(c.experience), deadlineLine(c.applicationDeadline)]
      .filter(Boolean).join('  ·  ').toUpperCase()

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <JobsHeader
        active="For you"
        onSaved={onSaved}
        onApplied={onApplied}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={() => setSheetOpen(true)} style={styles.filterBtn}>
            <Svg width={height.glyph - 6} height={height.glyph - 6} viewBox="0 0 24 24" fill="none"><Path d="M3 5h18M6 12h12M10 19h4" stroke={color.text} strokeWidth={1.8} strokeLinecap="round" /></Svg>
            {activeCount > 0 && <View style={styles.filterBadge}><Text style={[text.metaXs, styles.filterBadgeText]}>{activeCount}</Text></View>}
          </Pressable>
        }
      />

      <View style={styles.body}>
        {/* A load failure with nothing on screen gets the full ErrorState below;
            the banner is for a swipe-commit failure, which happens with a card
            already showing, so the two never stack. */}
        {error && cards.length > 0 ? <Banner tone="danger">{error}</Banner> : null}

        {loading && cards.length === 0 ? (
          <View style={styles.deck}><Skeleton lines={3} block /></View>
        ) : error && cards.length === 0 ? (
          <View style={styles.deck}>
            <ErrorState
              title="Could not load jobs."
              body={error}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  label="Try again"
                  // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
                  hitSlop={(height.tap - height['control-xs']) / 2}
                  onPress={() => fetchMore(true)}
                />
              }
            />
          </View>
        ) : current ? (
          <>
            <View style={styles.deck}>
              {cards[i + 1] && (
                <Animated.View style={[styles.behind, { transform: [{ scale: nextScale }, { translateY: nextLift }] }]} pointerEvents="none">
                  <JobDeckCard
                    company={cards[i + 1].company.name}
                    title={cards[i + 1].title}
                    pay={salaryRange(cards[i + 1].salary)}
                    meta={cardMeta(cards[i + 1])}
                    skills={cards[i + 1].skills}
                    saved={cards[i + 1].saved}
                    video={cards[i + 1].video?.url ? { duration: fmtDuration(cards[i + 1].video!.durationSec) } : null}
                  />
                </Animated.View>
              )}
              <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                activeOffsetX={[-10, 10]}
              >
              <Animated.View
                key={current.id}
                style={[styles.card, { transform: [{ translateX: tx }, { translateY: ty4 }, { rotate }] }]}
              >
                <Animated.View style={[styles.stampWrap, styles.stampWrapLeft, { opacity: saveOpacity }]}><DeckStamp kind="save" /></Animated.View>
                <Animated.View style={[styles.stampWrap, styles.stampWrapRight, { opacity: passOpacity }]}><DeckStamp kind="skip" /></Animated.View>
                <Pressable accessibilityRole="button" accessibilityHint="Opens the full job" onPress={() => setDetails(current)} style={styles.cardPress}>
                  <JobDeckCard
                    company={current.company.name}
                    title={current.title}
                    pay={salaryRange(current.salary)}
                    meta={cardMeta(current)}
                    skills={current.skills}
                    saved={current.saved}
                    video={current.video?.url ? { duration: fmtDuration(current.video.durationSec) } : null}
                  />
                </Pressable>
              </Animated.View>
              </PanGestureHandler>
            </View>
            <DeckActions
              canUndo={!!last}
              disabled={busy}
              onUndo={undo}
              onSkip={() => fling('LEFT')}
              onSave={() => fling('RIGHT')}
              onInfo={() => setDetails(current)}
            />
          </>
        ) : (
          <View style={styles.empty}>
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

      {last && (
        <View style={styles.toastWrap}>
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
        onSkip={() => { setDetails(null); fling('LEFT') }}
        onSave={() => { setDetails(null); fling('RIGHT') }}
        onApply={(id) => { setDetails(null); if (onApply) onApply(id); else onOpen(id) }}
      />

      <JobFilterSheet open={sheetOpen} initial={filters} onClose={() => setSheetOpen(false)} onApply={(f) => { setSheetOpen(false); applyFilters(f) }} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  filterBtn: { width: height.tap, height: height.tap, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -space['2xs'], right: -space['2xs'], minWidth: space.lg, height: space.lg, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: color.textInverse },
  body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg },
  deck: { flex: 1 },
  behind: { ...StyleSheet.absoluteFill },
  card: { flex: 1, borderRadius: radius.xl, backgroundColor: color.surface, shadowColor: color.ink, shadowOpacity: 0.1, shadowRadius: space.xl, shadowOffset: { width: 0, height: space.md }, elevation: 6 },
  cardPress: { flex: 1 },
  stampWrap: { position: 'absolute', top: 0, zIndex: 2 },
  stampWrapLeft: { left: 0 },
  stampWrapRight: { right: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: space['4xl'] },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: space.lg },
})
