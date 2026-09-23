import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { ApiClientError } from '../../lib/api'
import { getFeed, getFilters, swipeJob, undoSwipe, type JobCard, type JobFilters } from '../../lib/api/jobs'
import { activeFilterCount, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange } from '../../lib/jobs/format'
import { color, space, radius, borderWidth, height } from '../../theme'
import { AppBar, Banner, Body, Button, Display, EmptyState, ErrorState, Figure, Meta, Skeleton, StatusPill, Tag } from '../../components/ui'
import { JobFilterSheet } from './JobFilterSheet'

/**
 * ST-35 — the job feed. A SWIPE SAVES; IT NEVER APPLIES. Right saves, left marks
 * not-interested (60-day suppression), the last swipe is undoable — and the
 * card carries NO Apply, no send language, no match celebration. The swipe
 * overlay reads only as "saved" or "dismissed" (muted, never crimson for
 * dismiss). Buttons back the gesture for reach and accessibility.
 */
export function JobFeedScreen({ onBack, onOpen, onSaved }: {
  onBack: () => void
  onOpen: (id: string) => void
  onSaved: () => void
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

  const pos = useRef(new Animated.ValueXY()).current

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
    if (!current || busy) return
    const card = current
    Animated.timing(pos, { toValue: { x: direction === 'RIGHT' ? 500 : -500, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 })
      setI((n) => n + 1)
      void commitSwipe(card, direction)
    })
  }, [current, busy, pos, commitSwipe])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: (_e, g) => pos.setValue({ x: g.dx, y: g.dy / 4 }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 120) fling('RIGHT')
        else if (g.dx < -120) fling('LEFT')
        else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
      },
    }),
  ).current

  async function undo() {
    setBusy(true)
    try {
      const r = await undoSwipe()
      if (r.undone && last && last.card.id === r.jobId) setCards((prev) => { const n = [...prev]; n.splice(i, 0, last.card); return n })
      setLast(null)
    } catch { /* nothing */ } finally { setBusy(false) }
  }

  const rotate = pos.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-6deg', '0deg', '6deg'] })
  const saveOpacity = pos.x.interpolate({ inputRange: [40, 140], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = pos.x.interpolate({ inputRange: [-140, -40], outputRange: [1, 0], extrapolate: 'clamp' })

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar
        title="Home"
        onBack={onBack}
        action={
          <Pressable onPress={() => setSheetOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M3 5h18M6 12h12M10 19h4" stroke={color.textMuted} strokeWidth={1.7} strokeLinecap="round" /></Svg>
            <Meta style={{ color: color.textMuted }}>FILTERS{activeCount > 0 ? ` · ${activeCount}` : ''}</Meta>
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
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.card, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }]}
              >
                <Animated.View style={[styles.stamp, styles.stampSave, { opacity: saveOpacity }]}><Meta style={{ color: color.success }}>SAVE</Meta></Animated.View>
                <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}><Meta style={{ color: color.textMuted }}>NOT INTERESTED</Meta></Animated.View>
                <JobCardBody card={current} onOpen={() => onOpen(current.id)} />
              </Animated.View>
            </View>
            <View style={styles.actions}>
              <Button variant="outline" size="block" full label="Not interested" onPress={() => fling('LEFT')} disabled={busy} />
              <View style={{ width: space.md }} />
              <Button variant="secondary" size="block" full label="Save" onPress={() => fling('RIGHT')} disabled={busy} />
            </View>
            <Meta style={{ color: color.textSubtle, textAlign: 'center', marginTop: space.sm }}>Swipe → to save · ← not interested</Meta>
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
        <View style={[styles.undo, { paddingBottom: insets.bottom + space.md }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body size="sm" weight="medium" numberOfLines={1}>{last.direction === 'RIGHT' ? 'Saved' : 'Not interested'} · {last.card.title}</Body>
            <Meta style={{ color: color.textSubtle }}>Nothing was sent.{last.direction === 'LEFT' ? ' Hidden for 60 days.' : ''}</Meta>
          </View>
          <Button variant="text" size="md" label="Undo" onPress={undo} disabled={busy} />
        </View>
      )}

      <JobFilterSheet open={sheetOpen} initial={filters} onClose={() => setSheetOpen(false)} onApply={(f) => { setSheetOpen(false); applyFilters(f) }} />
    </View>
  )
}

function JobCardBody({ card, onOpen }: { card: JobCard; onOpen: () => void }) {
  const salary = salaryRange(card.salary)
  const deadline = deadlineLine(card.applicationDeadline)
  return (
    <Pressable onPress={onOpen} style={{ gap: space.md }}>
      {card.video?.url ? <View style={styles.video} /> : null}
      <View style={{ gap: space.xs }}>
        <Display level="md">{card.title}</Display>
        <Display level="xs" style={{ color: color.textMuted }}>{card.company.name}</Display>
      </View>
      {salary ? <Figure value={salary} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <Meta style={{ color: color.textMuted }}>{locationLine(card.location, card.remote).toUpperCase()}</Meta>
        <Meta style={{ color: color.textMuted }}>{employmentLabel(card.employmentType).toUpperCase()}</Meta>
        <Meta style={{ color: color.textMuted }}>{experienceLine(card.experience).toUpperCase()}</Meta>
        {deadline ? <Meta style={{ color: color.textSubtle }}>{deadline.toUpperCase()}</Meta> : null}
      </View>
      {card.skills.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {card.skills.slice(0, 6).map((s) => <Tag key={s} label={s} />)}
        </View>
      )}
      {card.saved ? <StatusPill tone="success" label="Saved" /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  body: { flex: 1, padding: space.xl },
  deck: { flex: 1, justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, padding: space.lg, gap: space.md },
  video: { aspectRatio: 9 / 16, maxHeight: 360, borderRadius: radius.md, backgroundColor: color.ink },
  stamp: { position: 'absolute', top: space.lg, zIndex: 2, borderRadius: radius.sm, borderWidth: borderWidth.medium, paddingHorizontal: space.sm, paddingVertical: space.xs },
  stampSave: { right: space.lg, borderColor: color.success },
  stampPass: { left: space.lg, borderColor: color.borderStrong },
  actions: { flexDirection: 'row', marginTop: space.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: space['4xl'] },
  undo: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: space.xl, paddingTop: space.md },
})
