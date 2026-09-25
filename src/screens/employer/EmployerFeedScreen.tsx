import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmEmpty, EmError } from '../../components/employer/em'
import {
  FEED_HOW, FeedChips, FeedControls, FeedFilmCard, FeedLockCard, FeedStamp, FeedToast, FeedTop,
} from '../../components/employer/feed'
import { ApiClientError } from '../../lib/api'
import {
  clearFeedFilters, fetchCandidateFeed, fetchFeedFilters, fetchLastSwipe, fetchMatchCount, postSwipe, saveFeedFilters,
  undoLastSwipe, type CandidateCard, type CandidateFilters, type CandidateMatchCount, type QuotaView,
} from '../../lib/api/employerFeed'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { filterChips, filterCount, normalize, rowLabel, withoutChip, withoutRow } from '../../lib/employer/feedFilters'
import { FeedFiltersSheet } from './FeedFiltersModal'
import { SavedSearchesSheet } from './SavedSearchesModal'
import { CandidateProfileSheet } from './CandidateProfileSheet'
import type { RootStackParamList } from '../../../App'

const PAGE = 15
/** A committed drag, or a quick flick past a smaller distance. */
const COMMIT_X = 120
const FLICK_X = 40
const FLICK_V = 800
const TOAST_MS = 4000

type Direction = 'RIGHT' | 'LEFT'
type LastSwipe = { card: CandidateCard | null; name: string; direction: Direction }

/**
 * EM-08 · the candidate feed (Employer Android). Drag the card right to
 * shortlist (private), left to pass; the round buttons do the same. The next
 * card grows into place as the top one leaves, a short drag springs back, and
 * the stamps fade in with the drag. A tap on the caption, or the info button,
 * opens the profile sheet; Full opens the full interview.
 *
 * Numbers are the server's: the position is the feed's own quota, how long a
 * pass hides someone is `passHideDays`, and the filters are the set persisted
 * on the account (GET/PUT /employers/feed/filters) — the same on the web.
 *
 * States: pending verification (EM-08b, a static drawing, nothing fetched),
 * loading (EM-08c), caught up (EM-08d), an error (EM-08e), the day's cards
 * spent (EM-08f).
 */
export function EmployerFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { width } = useWindowDimensions()
  const { state } = useEmployer()
  const config = useEmployerConfig()
  const passDays = config.passHideDays
  const known = state !== null
  const verified = Boolean(state?.verified)

  const [filters, setFilters] = useState<CandidateFilters>({})
  const [filtersReady, setFiltersReady] = useState(false)
  const [items, setItems] = useState<CandidateCard[]>([])
  const [i, setI] = useState(0)
  const cursor = useRef<string | null>(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cardLimit, setCardLimit] = useState(false)
  const [gated, setGated] = useState(false)
  const [quota, setQuota] = useState<QuotaView | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<LastSwipe | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [saveDraft, setSaveDraft] = useState<CandidateFilters | null>(null)
  const [relax, setRelax] = useState<CandidateMatchCount['narrowest']>(null)
  const request = useRef(0)
  const refreshedAt = useRef(0)

  // The persisted filters, and the swipe the server would undo (so Undo works after a reload).
  useEffect(() => {
    if (!verified) return
    let alive = true
    fetchFeedFilters()
      .then((v) => alive && setFilters(v.filters ?? {}))
      .catch(() => {})
      .finally(() => alive && setFiltersReady(true))
    fetchLastSwipe()
      .then((l) => alive && l && setLast((cur) => cur ?? { card: null, name: l.name, direction: l.direction }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [verified])

  /** One page of the deck. Not verified, or the day's cards spent, is a state — not an error. */
  const load = useCallback(async (reset: boolean) => {
    const mine = ++request.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCandidateFeed({ cursor: reset ? undefined : cursor.current ?? undefined, limit: PAGE })
      if (mine !== request.current) return
      const list = res.items ?? res.cards ?? []
      setItems((prev) => (reset ? list : [...prev, ...list.filter((c) => !prev.some((p) => p.id === c.id))]))
      if (reset) setI(0)
      cursor.current = res.nextCursor ?? null
      setMore(Boolean(res.nextCursor))
      if (res.quota) setQuota(res.quota)
      setCardLimit(false)
    } catch (e) {
      if (mine !== request.current) return
      if (e instanceof ApiClientError && e.isUnverified) setGated(true)
      else if (e instanceof ApiClientError && (e.code === 'RATE_LIMITED' || e.meta?.reason === 'CARD_LIMIT_REACHED')) setCardLimit(true)
      else setError(e instanceof Error ? e.message : 'Could not load the candidate feed.')
    } finally {
      if (mine === request.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (verified && filtersReady) load(true)
  }, [verified, filtersReady, load])

  // Keep a few cards ahead.
  useEffect(() => {
    if (!loading && more && !cardLimit && items.length - i <= 3) load(false)
  }, [i, items.length, more, loading, cardLimit, load])

  // The toast says what happened, then gets out of the controls' way; Undo stays on the round button.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const current = items[i]
  const next = items[i + 1] ?? null
  const caughtUp = verified && filtersReady && !loading && !current && !error && !cardLimit

  // On "caught up", ask which one filter is holding the deck back (free).
  useEffect(() => {
    if (!caughtUp || filterCount(filters) === 0) {
      setRelax(null)
      return
    }
    let alive = true
    fetchMatchCount(normalize(filters)).then((r) => alive && setRelax(r.narrowest)).catch(() => {})
    return () => {
      alive = false
    }
  }, [caughtUp, filters])

  async function applyFilters(nextFilters: CandidateFilters) {
    const n = normalize(nextFilters)
    setFiltersOpen(false)
    setSavedOpen(false)
    setFilters(n)
    setItems([])
    cursor.current = null
    try {
      const v = filterCount(n) === 0 ? await clearFeedFilters() : await saveFeedFilters(n)
      setFilters(v.filters ?? {})
    } catch {
      /* the deck still reloads under what the server holds */
    }
    load(true)
  }

  // ── the swipe ──────────────────────────────────────────────────────────────
  const tx = useRef(new Animated.Value(0)).current
  const ty = useRef(new Animated.Value(0)).current
  const ty4 = useMemo(() => Animated.multiply(ty, 0.25), [ty])

  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(tx, { toValue: 0, friction: 6, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, friction: 6, useNativeDriver: true }),
    ]).start()
  }, [tx, ty])

  const commit = useCallback(async (card: CandidateCard, direction: Direction) => {
    try {
      await postSwipe(card.id, direction)
      setLast({ card, name: card.name, direction })
      setToast(
        direction === 'RIGHT'
          ? `Shortlisted ${card.name} · private`
          : `Passed on ${card.name}${passDays ? ` · hidden for ${passDays} days` : ''}`,
      )
    } catch (e) {
      // The card comes back and the swipe can be made again.
      setItems((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev.slice(0, i), card, ...prev.slice(i)]))
      if (e instanceof ApiClientError && e.code === 'RATE_LIMITED') setCardLimit(true)
    } finally {
      setBusy(false)
    }
  }, [passDays, i])

  const fling = useCallback((direction: Direction) => {
    if (!current || busy) {
      springBack()
      return
    }
    const card = current
    setBusy(true)
    setProfileOpen(false)
    Animated.timing(tx, { toValue: (direction === 'RIGHT' ? 1 : -1) * width * 1.4, duration: 220, useNativeDriver: true }).start(() => {
      setI((n) => n + 1)
      commit(card, direction)
    })
  }, [current, busy, springBack, tx, width, commit])

  // The next card is on top once React has drawn it; only then snap the values home.
  useLayoutEffect(() => {
    tx.setValue(0)
    ty.setValue(0)
  }, [i, current?.id, tx, ty])

  const onGestureEvent = useMemo(
    () => Animated.event([{ nativeEvent: { translationX: tx, translationY: ty } }], { useNativeDriver: true }),
    [tx, ty],
  )
  const onHandlerStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state: s, translationX, velocityX } = e.nativeEvent
    if (s !== State.END && s !== State.CANCELLED && s !== State.FAILED) return
    if (translationX > COMMIT_X || (translationX > FLICK_X && velocityX > FLICK_V)) fling('RIGHT')
    else if (translationX < -COMMIT_X || (translationX < -FLICK_X && velocityX < -FLICK_V)) fling('LEFT')
    else springBack()
  }, [fling, springBack])

  const undo = useCallback(async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      const r = await undoLastSwipe()
      if (r.undone && last.card) {
        const back = last.card
        setItems((prev) => {
          const copy = prev.filter((c) => c.id !== back.id)
          copy.splice(i, 0, back)
          return copy
        })
      } else if (r.undone) {
        // Undone from an earlier visit: the card is not in hand, so read the deck again.
        load(true)
      }
      setLast(null)
      setToast(null)
    } catch {
      /* nothing to undo */
    } finally {
      setBusy(false)
    }
  }, [last, busy, i, load])

  /** A signed film address lapsed: one page read again for fresh ones, at most every half minute. */
  const refreshStreams = useCallback(() => {
    if (Date.now() - refreshedAt.current < 30_000) return
    refreshedAt.current = Date.now()
    fetchCandidateFeed({ limit: PAGE })
      .then((res) => {
        const fresh = new Map((res.items ?? res.cards ?? []).map((c) => [c.id, c]))
        setItems((prev) => prev.map((c) => (fresh.has(c.id) ? { ...c, streamUrl: fresh.get(c.id)!.streamUrl, posterUrl: fresh.get(c.id)!.posterUrl } : c)))
      })
      .catch(() => {})
  }, [])

  const rotate = tx.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-6deg', '0deg', '6deg'] })
  const shortOpacity = tx.interpolate({ inputRange: [FLICK_X, COMMIT_X + 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = tx.interpolate({ inputRange: [-(COMMIT_X + 20), -FLICK_X], outputRange: [1, 0], extrapolate: 'clamp' })
  // The next card grows into place as the top one is dragged away.
  const nextScale = tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [1, 0.95, 1], extrapolate: 'clamp' })
  const nextLift = tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [0, space.md, 0], extrapolate: 'clamp' })

  const pending = known && (!verified || gated)
  const chips = filterChips(filters)
  const seen = quota ? Math.min(quota.limit, Math.max(0, quota.used - Math.max(0, items.length - (i + 1)))) : null
  const position = pending ? 'PREVIEW' : quota ? `${current ? Math.max(1, seen ?? 0) : quota.used} OF ${quota.limit} TODAY` : ' '
  const openFull = () =>
    current?.hasVideo &&
    navigation.navigate('CandidateVideo', { id: current.id, name: current.name, photoUrl: current.photoUrl, interviewAt: current.verifiedInterview?.at })

  let stage: React.ReactNode
  if (!known || (verified && (!filtersReady || (loading && items.length === 0 && !error && !cardLimit)))) {
    stage = <View style={styles.skeleton} accessibilityLabel="Loading candidates" />
  } else if (pending) {
    stage = <FeedLockCard />
  } else if (cardLimit) {
    const cards = quota?.limit ?? config.feedDailyCardLimit
    const videos = config.feedDailyVideoPlayLimit
    stage = (
      <View style={styles.center}>
        <EmEmpty
          icon="clock"
          title={cards ? `That’s ${cards} today.` : 'That’s today’s cards.'}
          body={`To protect candidates, each account sees ${cards ? `${cards} cards` : 'a set number of cards'}${videos ? ` and ${videos} full videos` : ''} a day. Resets at midnight IST.`}
          action={<Button variant="secondary" size="pair" label="Open shortlist" onPress={() => navigation.navigate('EmployerShortlist')} />}
        />
      </View>
    )
  } else if (error && items.length === 0) {
    stage = (
      <View style={styles.center}>
        <EmError
          title="Couldn’t load candidates."
          body="Your filters, shortlist and last swipe are safe."
          action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load(true) }} />}
        />
      </View>
    )
  } else if (current) {
    stage = (
      <>
        {next && (
          <Animated.View style={[styles.layer, { transform: [{ scale: nextScale }, { translateY: nextLift }] }]} pointerEvents="none">
            <FeedFilmCard card={next} active={false} muted />
          </Animated.View>
        )}
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange} activeOffsetX={[-10, 10]}>
          <Animated.View key={current.id} style={[styles.layer, { transform: [{ translateX: tx }, { translateY: ty4 }, { rotate }] }]}>
            <FeedFilmCard
              card={current}
              active={focused && !profileOpen && !filtersOpen && !savedOpen}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenFull={openFull}
              onOpenProfile={() => setProfileOpen(true)}
              onStreamFail={refreshStreams}
            >
              <Animated.View style={[styles.stamp, styles.stampLeft, { opacity: shortOpacity }]} pointerEvents="none">
                <FeedStamp kind="shortlist" />
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampRight, { opacity: passOpacity }]} pointerEvents="none">
                <FeedStamp kind="pass" passDays={passDays} />
              </Animated.View>
            </FeedFilmCard>
          </Animated.View>
        </PanGestureHandler>
      </>
    )
  } else {
    stage = (
      <View style={styles.caught}>
        <View style={styles.caughtMark}><Icon name="check" size={space['2xl'] - 6} tint={color.success} weight={2.4} /></View>
        <Text style={[text.displaySm, styles.centerText]}>You’re caught up.</Text>
        <Text style={[text.uiMd, styles.muted, styles.centerText]}>
          Every candidate matching these filters is done. New interviews publish daily.
        </Text>
        <Button variant="secondary" size="pair" label="Widen filters" onPress={() => setFiltersOpen(true)} />
        {!!relax && relax.matchesWithout > 0 && (
          <Button
            variant="text"
            size="sm"
            label={`Clear ${rowLabel(relax.key).toLowerCase()} to see ${relax.matchesWithout}`}
            onPress={() => { applyFilters(withoutRow(filters, relax.key)) }}
          />
        )}
      </View>
    )
  }

  return (
    <EmployerShell bar={false} scroll={false}>
      <FeedTop
        position={position}
        filterCount={filterCount(filters)}
        companyName={state?.company.name}
        locked={pending}
        onSaved={() => {
          setSaveDraft(null)
          setSavedOpen(true)
        }}
        onFilters={() => setFiltersOpen(true)}
        onAccount={() => navigation.navigate('EmployerAccount')}
      />
      <FeedChips
        chips={chips}
        locked={pending || !filtersReady}
        onRemove={(key) => { applyFilters(withoutChip(filters, key)) }}
        onClear={() => { applyFilters({}) }}
      />

      <View style={styles.stack}>{stage}</View>

      {pending ? (
        <View style={styles.how}>
          {FEED_HOW.map((h) => (
            <View key={h.text} style={styles.howRow}>
              <Icon name={h.icon} size={space.lg - 1} tint={color.accent} weight={2} />
              <Text style={[text.uiSm, styles.secondary]}>{h.text}</Text>
            </View>
          ))}
        </View>
      ) : (current || (loading && items.length === 0)) && !cardLimit ? (
        <FeedControls
          canUndo={!!last}
          disabled={busy || !current}
          onUndo={() => { undo() }}
          onPass={() => fling('LEFT')}
          onShortlist={() => fling('RIGHT')}
          onProfile={() => setProfileOpen(true)}
        />
      ) : (
        <View style={styles.ctlSpacer} />
      )}

      {!!toast && <FeedToast message={toast} disabled={busy} onUndo={() => { undo() }} />}

      {current && (
        <CandidateProfileSheet
          open={profileOpen}
          card={current}
          passDays={passDays}
          onClose={() => setProfileOpen(false)}
          onPass={() => fling('LEFT')}
          onShortlist={() => fling('RIGHT')}
          onOpenFull={openFull}
          onInterestSent={(id) => setItems((prev) => prev.map((c) => (c.id === id ? { ...c, interest: 'SENT' } : c)))}
        />
      )}

      <FeedFiltersSheet
        open={filtersOpen}
        applied={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => { applyFilters(f) }}
        onSaveAs={(draft) => {
          setSaveDraft(draft)
          setFiltersOpen(false)
          setSavedOpen(true)
        }}
      />

      <SavedSearchesSheet
        open={savedOpen}
        current={saveDraft ?? filters}
        onClose={() => setSavedOpen(false)}
        onApply={(s) => { applyFilters(s.filters) }}
      />
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  centerText: { textAlign: 'center' },
  stack: { flex: 1, marginHorizontal: space.lg },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  skeleton: { flex: 1, borderRadius: radius.deck, backgroundColor: color.surfaceSunken },
  center: { flex: 1, justifyContent: 'center' },
  stamp: { position: 'absolute', top: height.fab + space.xs },
  stampLeft: { left: spaceHalf['4.5'] + space.xs },
  stampRight: { right: spaceHalf['4.5'] + space.xs },
  caught: {
    flex: 1, borderRadius: radius.deck, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space['2xl'],
  },
  caughtMark: { width: height.fab, height: height.fab, borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  how: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: spaceHalf['2.5'], gap: spaceHalf['1.5'] },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ctlSpacer: { height: space.lg },
})
