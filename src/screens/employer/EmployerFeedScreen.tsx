import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import {
  PanGestureHandler, State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { DeckCard, FEED_HOW, FeedChips, FeedLockCard, FeedTop } from '../../components/employer/feed'
import { StudioCard, StudioLabel, StudioState } from '../../components/employer/studio'
import { FeedActions, FeedSkeleton, FeedStamp, FeedToast } from '../../components/ui/feed-deck'
import { ApiClientError } from '../../lib/api'
import {
  clearFeedFilters, fetchFeedFilters, fetchLastSwipe, fetchMatchCount, listSavedSearches, postSwipe,
  saveFeedFilters, undoLastSwipe, type CandidateCard, type CandidateFilters, type CandidateMatchCount,
} from '../../lib/api/employerFeed'
import { fetchEmployerInterests, liveInterestOutcome } from '../../lib/api/employerInterests'
import { fetchShortlist } from '../../lib/api/employerShortlist'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import {
  advanceDeck, ensureDeck, loadDeck, markCardLimit, patchCards, refreshDeckMedia, resetDeck, restoreCard, useFeedDeck,
} from '../../lib/employer/feedDeck'
import { filterChips, filterCount, normalize, rowLabel, withoutChip, withoutRow } from '../../lib/employer/feedFilters'
import { useLightStatusBar } from '../../lib/useLightStatusBar'
import { useDarkTabBar } from '../../navigation/tabBarTone'
import { CandidateProfileSheet } from './CandidateProfileSheet'
import { FeedFiltersSheet } from './FeedFiltersModal'
import { SavedSearchesSheet } from './SavedSearchesModal'
import { SendInterestSheet } from './SendInterestModal'
import type { RootStackParamList } from '../../../App'

const PAGE = 15
/** A committed drag, or a quick flick past a smaller distance — sideways as today, and upward for a skip. */
const COMMIT_X = 120
const FLICK_X = 40
const COMMIT_Y = 110
const FLICK_Y = 40
const FLICK_V = 800
/** Which way a drag goes is decided once, after this much movement — one drag never does two things. */
const AXIS_LOCK = 12
const TOAST_MS = 4000
const SOON_MS = 48 * 60 * 60 * 1000

type Direction = 'RIGHT' | 'LEFT'
type LastSwipe = { card: CandidateCard | null; name: string; direction: Direction }
type Toast = { kind: 'swipe'; message: string } | { kind: 'skip'; message: string; card: CandidateCard }

/** '6 h 12 min' until the reset, from the quota's resetAt. */
function untilReset(resetAt: string | undefined, now: number) {
  if (!resetAt) return null
  const mins = Math.max(0, Math.round((new Date(resetAt).getTime() - now) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`
}

/**
 * The candidate feed (docs/employer-app-studio.html · F0–F7, drawn as the video
 * feed of docs/tinder-feed-mockups.html · design 1). While a card is up the
 * page and the tab bar are ink, the card runs down to the bar, and the four
 * round buttons sit over its foot; the lock, limit, caught-up and error states
 * keep the light page.
 *
 * Gestures (one card, four of them; the axis is chosen once per drag):
 * - swipe right → Shortlist, privately (as before);
 * - swipe left → Pass, hidden for `passHideDays` (as before);
 * - scroll down — drag the card UP — → Skip: the next card rises, NOTHING is
 *   sent or saved, and the toast's Back returns the card. A skipped person is
 *   not excluded, so they can come back when the deck restarts; the card was
 *   already counted in the day's allowance when it loaded (the server charges
 *   on delivery), so a skip does not give it back;
 * - tap the name or facts → the profile page; tap the film → sound.
 *
 * The deck is shared with Home (lib/employer/feedDeck): Home's “Today’s feed”
 * films are this deck's first cards, so nothing is read — or charged — twice.
 *
 * States: pending (a locked drawing, nothing fetched), loading, caught up (with
 * the narrowest filter to clear), an error, the day's cards spent.
 */
export function EmployerFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { width, height: screenH } = useWindowDimensions()
  const { state } = useEmployer()
  const config = useEmployerConfig()
  const passDays = config.passHideDays
  const known = state !== null
  const verified = Boolean(state?.verified)
  const deck = useFeedDeck()
  // The latest deck for effects that run on focus, without re-running on every deck change.
  const deckRef = useRef(deck)
  deckRef.current = deck

  const [filters, setFilters] = useState<CandidateFilters>({})
  const [filtersReady, setFiltersReady] = useState(false)
  const [matches, setMatches] = useState<CandidateMatchCount | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<LastSwipe | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [muted, setMuted] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [interestOpen, setInterestOpen] = useState(false)
  const [profileCard, setProfileCard] = useState<CandidateCard | null>(null)
  const [saveDraft, setSaveDraft] = useState<CandidateFilters | null>(null)
  const [now, setNow] = useState(() => Date.now())

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

  // The first page — unless Home already read it.
  useEffect(() => {
    if (verified && filtersReady) ensureDeck(PAGE)
  }, [verified, filtersReady])

  /**
   * A deck that ran out starts again from page one each time the feed comes
   * back into view. A walk keeps its order for the day, so candidates published
   * after it began — or ranked above where it had reached — would otherwise
   * never appear. Free on the server: a candidate already dealt today is never
   * charged again (one card per candidate per day), so the restart re-shows the
   * ones skipped and adds the new ones.
   */
  useEffect(() => {
    if (!focused || !verified || !filtersReady) return
    const d = deckRef.current
    if (d.started && !d.loading && !d.more && !d.cardLimit && d.items.length <= d.i) {
      resetDeck()
      loadDeck(true, PAGE)
    }
  }, [focused, verified, filtersReady])

  // How many match the filters (free, no card charged).
  useEffect(() => {
    if (!verified || !filtersReady) return
    let alive = true
    fetchMatchCount(normalize(filters)).then((r) => alive && setMatches(r)).catch(() => alive && setMatches(null))
    return () => {
      alive = false
    }
  }, [verified, filtersReady, filters])

  const { items, i } = deck
  // Keep a few cards ahead.
  useEffect(() => {
    if (!deck.loading && deck.more && !deck.cardLimit && items.length - i <= 3) loadDeck(false, PAGE)
  }, [i, items.length, deck.more, deck.loading, deck.cardLimit])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const current = items[i]
  const next = items[i + 1] ?? null
  const caughtUp = verified && filtersReady && !deck.loading && deck.started && !current && !deck.error && !deck.cardLimit

  useEffect(() => {
    if (deck.cardLimit) setNow(Date.now())
  }, [deck.cardLimit])

  async function applyFilters(nextFilters: CandidateFilters) {
    const n = normalize(nextFilters)
    setFiltersOpen(false)
    setSavedOpen(false)
    setFilters(n)
    resetDeck()
    try {
      const v = filterCount(n) === 0 ? await clearFeedFilters() : await saveFeedFilters(n)
      setFilters(v.filters ?? {})
    } catch {
      /* the deck still reloads under what the server holds */
    }
    loadDeck(true, PAGE)
  }

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

  const commit = useCallback(async (card: CandidateCard, direction: Direction) => {
    try {
      await postSwipe(card.id, direction)
      setLast({ card, name: card.name, direction })
      setToast({
        kind: 'swipe',
        message: direction === 'RIGHT'
          ? `Shortlisted ${card.name} · private`
          : `Passed on ${card.name}${passDays ? ` · hidden for ${passDays} days` : ''}`,
      })
    } catch (e) {
      // The card comes back and the swipe can be made again.
      restoreCard(card)
      if (e instanceof ApiClientError && e.code === 'RATE_LIMITED') markCardLimit()
    } finally {
      setBusy(false)
    }
  }, [passDays])

  const fling = useCallback((direction: Direction) => {
    if (!current || busy) {
      springBack()
      return
    }
    const card = current
    setBusy(true)
    lockY.setValue(0)
    Animated.timing(gx, { toValue: (direction === 'RIGHT' ? 1 : -1) * width * 1.4, duration: 220, useNativeDriver: true }).start(() => {
      advanceDeck()
      commit(card, direction)
    })
  }, [current, busy, springBack, gx, lockY, width, commit])

  /** Skip: nothing is sent, nothing is saved; Back puts the card on top again. */
  const skip = useCallback(() => {
    if (!current || busy) {
      springBack()
      return
    }
    const card = current
    // Held for the 240 ms the card takes to leave, so an Undo or Back can't land mid-flight.
    setBusy(true)
    lockX.setValue(0)
    Animated.timing(gy, { toValue: -screenH, duration: 240, useNativeDriver: true }).start(() => {
      setBusy(false)
      advanceDeck()
      setToast({ kind: 'skip', card, message: `Skipped ${card.name.split(/\s+/)[0]} — may show up again later` })
    })
  }, [current, busy, springBack, gy, lockX, screenH])

  // The next card is on top once React has drawn it; only then snap the values home.
  useLayoutEffect(() => {
    gx.setValue(0)
    gy.setValue(0)
    unlock()
  }, [i, current?.id, gx, gy, unlock])

  const onGestureEvent = useMemo(
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
  const onHandlerStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state: s, translationX, translationY, velocityX, velocityY } = e.nativeEvent
    if (s !== State.END && s !== State.CANCELLED && s !== State.FAILED) return
    const a = axis.current
    if (a === 'y' && s === State.END && (translationY < -COMMIT_Y || (translationY < -FLICK_Y && velocityY < -FLICK_V))) skip()
    else if (a === 'x' && s === State.END && (translationX > COMMIT_X || (translationX > FLICK_X && velocityX > FLICK_V))) fling('RIGHT')
    else if (a === 'x' && s === State.END && (translationX < -COMMIT_X || (translationX < -FLICK_X && velocityX < -FLICK_V))) fling('LEFT')
    else springBack()
  }, [fling, skip, springBack])

  const undo = useCallback(async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      const r = await undoLastSwipe()
      if (r.undone && last.card) restoreCard(last.card)
      // Undone from an earlier visit: the card is not in hand, so read the deck again.
      else if (r.undone) loadDeck(true, PAGE)
      setLast(null)
      setToast(null)
    } catch {
      /* nothing to undo */
    } finally {
      setBusy(false)
    }
  }, [last, busy])

  const back = useCallback((card: CandidateCard) => {
    restoreCard(card)
    setToast(null)
  }, [])

  /** A signed film address lapsed: re-sign the cards in hand, free (lib/employer/feedDeck · refreshDeckMedia). */
  const refreshStreams = useCallback(() => {
    refreshDeckMedia()
  }, [])

  const rotate = tx.interpolate({ inputRange: [-width, 0, width], outputRange: ['-10deg', '0deg', '10deg'] })
  const shortOpacity = tx.interpolate({ inputRange: [FLICK_X, COMMIT_X + 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = tx.interpolate({ inputRange: [-(COMMIT_X + 20), -FLICK_X], outputRange: [1, 0], extrapolate: 'clamp' })
  const skipOpacity = ty.interpolate({ inputRange: [-(COMMIT_Y + 20), -FLICK_Y], outputRange: [1, 0], extrapolate: 'clamp' })
  // The next card grows into place as the top one leaves, sideways or upward.
  const grow = Animated.add(
    tx.interpolate({ inputRange: [-160, 0, 160], outputRange: [1, 0, 1], extrapolate: 'clamp' }),
    ty.interpolate({ inputRange: [-200, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
  )
  const nextScale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1], extrapolate: 'clamp' })
  const nextLift = grow.interpolate({ inputRange: [0, 1], outputRange: [space.md, 0], extrapolate: 'clamp' })

  const pending = known && (!verified || deck.gated)
  const chips = filterChips(filters)
  const quota = deck.quota
  const seen = quota ? Math.min(quota.limit, Math.max(0, quota.used - Math.max(0, items.length - (i + 1)))) : null
  const position = quota && current ? `${Math.max(1, seen ?? 0)} / ${quota.limit}` : null
  const openFull = () =>
    current?.hasVideo &&
    navigation.navigate('CandidateVideo', { id: current.id, name: current.name, photoUrl: current.photoUrl, interviewAt: current.verifiedInterview?.at })
  const openProfile = () => current && setProfileCard(current)

  let stage: React.ReactNode
  const waiting = !known || (verified && !deck.gated && (!filtersReady || ((!deck.started || deck.loading) && items.length <= i && !deck.error && !deck.cardLimit)))
  const showCards = !waiting && !pending && !deck.cardLimit && !(deck.error && items.length <= i) && !!current
  // The light page until the account is known to be verified; after that, loading draws the dark card.
  const loadingDark = known && verified && !deck.gated && !deck.cardLimit && !(deck.error && items.length <= i) && !current && !caughtUp
  const dark = showCards || loadingDark
  useLightStatusBar(dark)
  useDarkTabBar(dark)

  if (waiting) {
    stage = known ? <FeedSkeleton label="Loading candidates" /> : <View style={styles.skeleton} accessibilityLabel="Loading candidates" />
  } else if (pending) {
    stage = <FeedLockCard />
  } else if (deck.cardLimit) {
    stage = <LimitState limit={quota?.limit ?? config.feedDailyCardLimit} videos={config.feedDailyVideoPlayLimit} reset={untilReset(quota?.resetAt, now)} />
  } else if (deck.error && items.length <= i) {
    stage = (
      <View style={styles.center}>
        <StudioState icon="alert" tone="danger" title="Couldn’t load candidates." body="Your filters, shortlist and last swipe are safe.">
          <Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { loadDeck(true, PAGE) }} />
        </StudioState>
      </View>
    )
  } else if (current) {
    stage = (
      <>
        {next && (
          <Animated.View style={[styles.layer, { transform: [{ translateY: nextLift }, { scale: nextScale }] }]} pointerEvents="none">
            <DeckCard card={next} active={false} muted />
          </Animated.View>
        )}
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange} activeOffsetX={[-10, 10]} activeOffsetY={[-10, 10]}>
          <Animated.View
            key={current.id}
            style={[styles.layer, { transform: [{ translateX: tx }, { translateY: ty }, { rotate }] }]}
            accessibilityActions={[{ name: 'skip', label: 'Skip this candidate' }]}
            onAccessibilityAction={(ev) => ev.nativeEvent.actionName === 'skip' && skip()}
          >
            <DeckCard
              card={current}
              active={focused && !filtersOpen && !savedOpen && !interestOpen && !profileCard}
              muted={muted}
              position={position}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenFull={openFull}
              onOpenProfile={openProfile}
              onStreamFail={refreshStreams}
              stamps={
                <>
                  <Animated.View style={[styles.layer, { opacity: shortOpacity }]} pointerEvents="none">
                    <FeedStamp kind="like" label="SHORTLIST" />
                  </Animated.View>
                  <Animated.View style={[styles.layer, { opacity: passOpacity }]} pointerEvents="none">
                    <FeedStamp kind="pass" label={passDays ? `PASS · ${passDays}D` : 'PASS'} />
                  </Animated.View>
                  <Animated.View style={[styles.layer, { opacity: skipOpacity }]} pointerEvents="none">
                    <FeedStamp kind="skip" label="SKIP" />
                  </Animated.View>
                </>
              }
            />
          </Animated.View>
        </PanGestureHandler>
        <FeedActions
          canUndo={!!last}
          disabled={busy}
          passLabel="Pass"
          likeLabel="Shortlist"
          planeLabel={current.interest === 'SENT' ? 'Interest sent' : 'Send an Interest'}
          planeDisabled={current.interest === 'SENT'}
          onUndo={() => { undo() }}
          onPass={() => fling('LEFT')}
          onLike={() => fling('RIGHT')}
          onPlane={() => setInterestOpen(true)}
        />
      </>
    )
  } else if (caughtUp) {
    stage = (
      <CaughtUp
        narrowest={matches?.narrowest ?? null}
        hasFilters={filterCount(filters) > 0}
        onWiden={() => setFiltersOpen(true)}
        onClearNarrowest={(key) => { applyFilters(withoutRow(filters, key)) }}
        onSaved={() => {
          setSaveDraft(null)
          setSavedOpen(true)
        }}
      />
    )
  } else {
    stage = <FeedSkeleton label="Loading candidates" />
  }

  return (
    <EmployerShell bar={false} scroll={false} dark={dark}>
      <FeedTop
        filterCount={filterCount(filters)}
        locked={pending}
        dark={dark}
        onSaved={() => {
          setSaveDraft(null)
          setSavedOpen(true)
        }}
        onFilters={() => setFiltersOpen(true)}
      />
      <FeedChips
        matches={pending || !filtersReady ? null : matches?.matches ?? null}
        chips={chips}
        locked={pending || !filtersReady}
        dark={dark}
        onRemove={(key) => { applyFilters(withoutChip(filters, key)) }}
        onClear={() => { applyFilters({}) }}
      />

      <View style={styles.stack}>
        {stage}
        {!!toast && (
          <FeedToast
            message={toast.message}
            action={toast.kind === 'skip' ? 'Back' : last ? 'Undo' : undefined}
            disabled={busy}
            onAction={() => {
              if (toast.kind === 'skip') back(toast.card)
              else undo()
            }}
          />
        )}
      </View>

      {pending && (
        <View style={styles.how}>
          {FEED_HOW.map((h) => (
            <View key={h.text} style={styles.howRow}>
              <Icon name={h.icon} size={space.lg - 1} tint={color.accent} weight={2} />
              <Text style={[text.uiSm, styles.secondary]}>{h.text}</Text>
            </View>
          ))}
        </View>
      )}

      {current && (
        <SendInterestSheet
          open={interestOpen}
          candidate={{
            id: current.id, name: current.name, photoUrl: current.photoUrl, tier: current.tier,
            qualification: current.qualification, city: current.city, verified: current.verifiedInterview?.verified,
          }}
          onClose={() => setInterestOpen(false)}
          onSent={() => patchCards((c) => (c.id === current.id ? { ...c, interest: 'SENT' } : c))}
        />
      )}

      {profileCard && (
        <CandidateProfileSheet
          open={!!profileCard}
          card={profileCard}
          passDays={passDays}
          onClose={() => setProfileCard(null)}
          onPass={() => {
            const c = profileCard
            setProfileCard(null)
            if (c) fling('LEFT')
          }}
          onShortlist={() => {
            const c = profileCard
            setProfileCard(null)
            if (c) fling('RIGHT')
          }}
          onOpenFull={openFull}
          onInterestSent={(candidateId) => patchCards((c) => (c.id === candidateId ? { ...c, interest: 'SENT' } : c))}
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

/** F5 · the day's cards are spent: today's copy, the time to reset, and two places to go meanwhile. */
function LimitState({ limit, videos, reset }: { limit?: number; videos?: number; reset: string | null }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [now] = useState(() => Date.now())
  const interests = useQuery({ queryKey: ['employer', 'interests', 'sent'], queryFn: () => fetchEmployerInterests({ outcome: 'SENT', perPage: 50 }) })
  const shortlist = useQuery({ queryKey: ['employer', 'shortlist', 'recent'], queryFn: () => fetchShortlist({ perPage: 50, sort: 'ADDED' }) })
  const live = interests.data ? interests.data.rows.filter((r) => liveInterestOutcome(r) === 'SENT') : []
  const awaiting = interests.data ? (interests.data.total > interests.data.rows.length ? interests.data.total : live.length) : null
  const expiring = live.filter((r) => {
    const left = new Date(r.expiresAt).getTime() - now
    return left > 0 && left <= SOON_MS
  }).length
  const shortTotal = shortlist.data ? shortlist.data.totalAll ?? shortlist.data.total : null
  const rows = [
    awaiting !== null && awaiting > 0 && {
      icon: 'heart' as const, title: `${awaiting} ${awaiting === 1 ? 'Interest' : 'Interests'} awaiting reply`,
      sub: expiring > 0 ? `${expiring} expire within 48 h` : null, to: 'EmployerInterests' as const,
    },
    shortTotal !== null && shortTotal > 0 && { icon: 'bookmark' as const, title: `${shortTotal} in your shortlist`, sub: null, to: 'EmployerShortlist' as const },
  ].filter(Boolean) as { icon: 'heart' | 'bookmark'; title: string; sub: string | null; to: 'EmployerInterests' | 'EmployerShortlist' }[]

  return (
    <View style={styles.limit}>
      <StudioState
        icon="clock"
        title={limit ? `That’s ${limit} today.` : 'That’s today’s cards.'}
        body={`To protect candidates, each account sees ${limit ? `${limit} cards` : 'a set number of cards'}${videos ? ` and ${videos} full videos` : ''} a day. Resets at midnight IST.`}
      >
        {!!reset && (
          <View style={styles.resetPill}>
            <Icon name="clock" size={space.md} tint={color.textSecondary} weight={2.2} />
            <Text style={[text.metaSm, styles.secondary]}>{`Resets in ${reset}`}</Text>
          </View>
        )}
        <Button variant="secondary" size="pair" label="Open shortlist" onPress={() => navigation.navigate('EmployerShortlist')} />
      </StudioState>
      {rows.length > 0 && (
        <StudioCard style={styles.waitCard}>
          <StudioLabel style={styles.waitHead}>While you wait</StudioLabel>
          {rows.map((r) => (
            <Pressable key={r.to} accessibilityRole="button" onPress={() => navigation.navigate(r.to)} style={({ pressed }) => [styles.waitRow, pressed && styles.pressed]}>
              <View style={styles.waitMark}><Icon name={r.icon} size={space.lg + 1} tint={color.accentText} /></View>
              <View style={styles.grow}>
                <Text style={text.uiMdSemi}>{r.title}</Text>
                {!!r.sub && <Text style={[text.uiXs, styles.muted]}>{r.sub}</Text>}
              </View>
              <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
            </Pressable>
          ))}
        </StudioCard>
      )}
    </View>
  )
}

/** F6 · no one is left for these filters. */
function CaughtUp({
  narrowest, hasFilters, onWiden, onClearNarrowest, onSaved,
}: {
  narrowest: CandidateMatchCount['narrowest']
  hasFilters: boolean
  onWiden: () => void
  onClearNarrowest: (key: NonNullable<CandidateMatchCount['narrowest']>['key']) => void
  onSaved: () => void
}) {
  const saved = useQuery({ queryKey: ['employer', 'saved-searches'], queryFn: listSavedSearches })
  const count = saved.data?.length ?? 0
  return (
    <View style={styles.limit}>
      <StudioState icon="check" tone="success" title="You’re caught up." body="Every candidate matching these filters is done. New interviews publish daily.">
        <Button variant="secondary" size="pair" icon="sliders" label="Widen filters" onPress={onWiden} />
        {hasFilters && !!narrowest && narrowest.matchesWithout > 0 && (
          <Button
            variant="text"
            size="sm"
            label={`Clear ${rowLabel(narrowest.key).toLowerCase()} to see ${narrowest.matchesWithout}`}
            onPress={() => onClearNarrowest(narrowest.key)}
          />
        )}
      </StudioState>
      {count > 0 && (
        <Pressable accessibilityRole="button" onPress={onSaved} style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}>
          <Icon name="bookmark" size={space.lg + 2} tint={color.accentText} />
          <Text style={[text.uiMd, styles.grow]}>Try a saved search</Text>
          <Text style={[text.metaSm, styles.muted]}>{`${count} saved`}</Text>
          <Icon name="chevR" size={space.lg} tint={color.accentText} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  /** The card runs from under the chips straight into the tab bar; its foot fades into the same black. */
  stack: { flex: 1, marginHorizontal: spaceHalf['2.5'] },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  skeleton: { flex: 1, borderRadius: radius.deck, backgroundColor: color.surfaceSunken },
  center: { flex: 1, justifyContent: 'center' },
  how: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: spaceHalf['2.5'], gap: spaceHalf['1.5'] },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  limit: { flex: 1, justifyContent: 'center', gap: space['2xl'] },
  resetPill: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], height: space.xl + spaceHalf['1.5'], paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.surfaceMuted },
  waitCard: { paddingVertical: spaceHalf['1.5'], paddingHorizontal: 0, gap: 0 },
  waitHead: { paddingHorizontal: spaceHalf['3.5'], paddingTop: spaceHalf['2.5'], paddingBottom: spaceHalf['1.5'] },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: spaceHalf['2.5'] + 1, paddingHorizontal: spaceHalf['3.5'], borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  waitMark: { width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.md + 1, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: spaceHalf['3.5'] - 1, paddingHorizontal: spaceHalf['3.5'],
    borderRadius: radius.lg, backgroundColor: color.accentWash, borderWidth: borderWidth.thin, borderColor: color.accentEdge,
  },
})
