import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native'
import Video from 'react-native-video'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmError, EmIconButton } from '../../components/employer/em'
import { Face, FilmStill, GlassPill, StudioState, StudioToast } from '../../components/employer/studio'
import {
  ClipPlayer, ProfileFactTiles, ProfileResume, ProfileVideoRow, availabilityOf, expectedSalaryOf, experienceShort, personLine,
} from '../../components/employer/profile'
import { ApiClientError } from '../../lib/api'
import {
  fetchCandidateDetail, fetchCandidateDocument, playSelfVideo, postSwipe, type CandidateDetail,
} from '../../lib/api/employerFeed'
import {
  fetchAllEmployerInterests, interestNextEligibleAt, liveInterestOutcome, type EmployerInterestRow,
} from '../../lib/api/employerInterests'
import { fetchAllShortlist, type ShortlistRow } from '../../lib/api/employerShortlist'
import { clipLength, interviewDate, shortlistedLine } from '../../lib/employer/candidateFormat'
import { dropCard, patchCards, useFeedDeck, refreshDeckMedia } from '../../lib/employer/feedDeck'
import { formatIstShort } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { linkableJobs, useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { SendInterestSheet } from './SendInterestModal'
import { ShortlistEntrySheet } from './ShortlistEntryModal'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateProfile'>

/** The film: 358 × 292 on the 390 phone (P1). */
const FILM_H = height['job-video'] + height.avatar
/** The head's photo: 54 (P1). */
const PHOTO = height['control-lg'] + space['2xs']
const DAY_MS = 86_400_000
/** How long a failed action's line stays over the foot. */
const NOTICE_MS = 4000

/** What the Interest button says, from the Interest this employer sent (if any). */
type Slot =
  | { kind: 'send' }
  | { kind: 'chat'; threadId: string | null }
  | { kind: 'sent'; left: string | null }
  | { kind: 'wait'; until: string }

function interestSlot(c: CandidateDetail, row: EmployerInterestRow | null, cooldownDays: number | undefined, now: Date): Slot {
  if (c.connection?.active || c.connection?.threadId || row?.connected) {
    return { kind: 'chat', threadId: c.connection?.threadId ?? row?.threadId ?? null }
  }
  const outcome = row ? liveInterestOutcome(row, now) : c.interest
  if (outcome === 'ACCEPTED') return { kind: 'chat', threadId: row?.threadId ?? null }
  if (outcome === 'SENT') {
    const ms = row ? new Date(row.expiresAt).getTime() - now.getTime() : Number.NaN
    const n = Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / DAY_MS) : null
    return { kind: 'sent', left: n ? `${n} ${n === 1 ? 'day' : 'days'} left` : null }
  }
  if (outcome === 'NOT_ACCEPTED' && row) {
    const next = interestNextEligibleAt(row, cooldownDays)
    if (next && next.getTime() > now.getTime()) return { kind: 'wait', until: formatIstShort(next).split(' · ')[0] }
  }
  return { kind: 'send' }
}

/**
 * EM-09 · the candidate profile — Studio frames P1–P3
 * (docs/employer-app-studio.html · 03). One scrolling page: the film (muted on
 * open; a tap turns the sound on; "Full" plays the whole interview and spends
 * one of the day's plays), the person, the three facts, every video, then the
 * résumé — experience, education, skills, what they are looking for,
 * documents and links. Once the head scrolls away a compact bar keeps the name
 * in view. The three decisions stay pinned at the foot: Pass (the left swipe),
 * Shortlist (the right swipe; once shortlisted it opens notes, tags and job)
 * and Send Interest (the P3 sheet).
 *
 * When the person is one of the feed's loaded cards, the bar counts them
 * ("13 of 40", from the day's card quota) and the chevron opens the next card;
 * a pass or a shortlist takes the card out of the deck and goes back to the
 * feed, on the next one.
 */
export function CandidateProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const focused = useIsFocused()
  const { id } = route.params
  const deck = useFeedDeck()
  const config = useEmployerConfig()
  const { state: employer } = useEmployer()

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const [compact, setCompact] = useState(false)
  const [muted, setMuted] = useState(true)
  const [passing, setPassing] = useState(false)
  const [shortlisting, setShortlisting] = useState(false)
  const [interestOpen, setInterestOpen] = useState(false)
  const [interest, setInterest] = useState<EmployerInterestRow | null>(null)
  const [entry, setEntry] = useState<{ row: ShortlistRow; tags: string[] } | null>(null)
  const [entryLoading, setEntryLoading] = useState(false)
  const [clip, setClip] = useState<{ url: string; title?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)
  /** Where the head (photo and name) ends in the page; past it the compact bar shows. */
  const headEnd = useRef(Number.POSITIVE_INFINITY)
  const jobRefs = useEmployerJobRefs(!!entry)

  const load = useCallback(() => {
    setError(null)
    setGone(false)
    fetchCandidateDetail(id)
      .then(setCandidate)
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 404) setGone(true)
        else setError(e instanceof Error ? e.message : 'Could not load the profile.')
      })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // The Interest's own dates (days left, when another may go, its chat) are on the Interests list, not the profile.
  const candidateId = candidate?.id
  const interestState = candidate?.interest ?? null
  useEffect(() => {
    if (!candidateId || !interestState) {
      setInterest(null)
      return
    }
    let alive = true
    fetchAllEmployerInterests()
      .then((rows) => alive && setInterest(rows.find((r) => r.candidateId === candidateId) ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [candidateId, interestState])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(t)
  }, [notice])

  const back = () => navigation.goBack()

  if (gone) {
    return (
      <EmployerShell back={back}>
        <View style={styles.gone}>
          <StudioState icon="user" title="This profile is no longer available" />
        </View>
      </EmployerShell>
    )
  }

  if (!candidate) {
    return (
      <EmployerShell back={back}>
        {error ? (
          <EmError title="Couldn’t load this profile." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={load} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </EmployerShell>
    )
  }

  const c = candidate

  // The feed's deck: this person's card (the film, headline and facts the detail does not carry), the count, the next card.
  const at = deck.items.findIndex((x) => x.id === c.id)
  const card = at >= 0 ? deck.items[at] : null
  const next = at >= 0 ? deck.items[at + 1] ?? null : null
  const quota = deck.quota
  const position = card && quota ? Math.min(quota.limit, Math.max(1, quota.used - (deck.items.length - (at + 1)))) : null
  const counter = position !== null && quota ? `${position} of ${quota.limit}` : null

  const date = c.verifiedInterview?.verified ? interviewDate(c.verifiedInterview.at) : null
  const shortDate = date ? date.split(' ').slice(0, 2).join(' ') : null
  const poster = c.posterUrl ?? card?.posterUrl ?? c.photoUrl
  const stream = c.streamUrl ?? card?.streamUrl ?? null
  const headline = c.headline ?? card?.headline ?? null
  const hasInterview = c.hasVideo ?? card?.hasVideo ?? !!c.verifiedInterview?.verified
  const plays = employer?.limits?.videoPlays ?? null
  const playsOut = !!plays && plays.remaining <= 0
  const interviewSec = (c.videos ?? []).find((v) => v.kind === 'INTERVIEW')?.durationSec ?? null
  const interviewLen = clipLength(interviewSec)
  const fullLabel = playsOut ? 'Full · resets at midnight' : interviewLen ? `Full · ${interviewLen}` : 'Full'
  const clips = (c.videos ?? []).filter((v) => v.kind !== 'INTERVIEW')
  const shortlistedBy = shortlistedLine(c.shortlistCount)
  const passDays = config.passHideDays
  const slot = interestSlot(c, interest, config.interestCooldownDays ?? config.interest?.cooldownDays, new Date())

  const openFull = () => {
    if (playsOut) return
    navigation.navigate('CandidateVideo', { id: c.id, name: c.name, photoUrl: c.photoUrl, interviewAt: c.verifiedInterview?.at })
  }
  const goNext = () => {
    if (next) navigation.replace('CandidateProfile', { id: next.id })
  }
  const toggleSound = () => setMuted((m) => !m)

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setCompact(e.nativeEvent.contentOffset.y > headEnd.current)
  }
  function onHeadLayout(e: LayoutChangeEvent) {
    const { y, height: h } = e.nativeEvent.layout
    headEnd.current = y + h
  }

  /** After a decision: back to where the profile was opened from, or the feed when there is nothing behind it. */
  function leave() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('EmployerFeed')
  }

  async function pass() {
    if (passing || shortlisting) return
    setPassing(true)
    setNotice(null)
    try {
      await postSwipe(c.id, 'LEFT')
      dropCard(c.id)
      leave()
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not passed. Try again.')
    } finally {
      setPassing(false)
    }
  }

  async function shortlist() {
    if (passing || shortlisting) return
    setShortlisting(true)
    setNotice(null)
    try {
      await postSwipe(c.id, 'RIGHT')
      dropCard(c.id)
      // Back to wherever the profile was opened from — the feed, Interests, a chat — as Pass does.
      leave()
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not shortlisted. Try again.')
    } finally {
      setShortlisting(false)
    }
  }

  /** Shortlisted ✓ opens the entry's notes, tags and job (EM-15) — read from the shortlist, which carries them. */
  async function openEntry() {
    setEntryLoading(true)
    setNotice(null)
    try {
      const rows = await fetchAllShortlist()
      const row = rows.find((r) => r.candidateId === c.id)
      if (row) setEntry({ row, tags: [...new Set(rows.flatMap((r) => r.tags))] })
      else setCandidate((prev) => (prev ? { ...prev, shortlisted: false } : prev))
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Your notes did not load. Try again.')
    } finally {
      setEntryLoading(false)
    }
  }

  async function playClip(videoId: string) {
    setNotice(null)
    try {
      const r = await playSelfVideo(c.id, videoId)
      setClip({ url: r.url, title: c.videos.find((v) => v.id === videoId)?.title ?? undefined })
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The clip did not load. Try again.')
    }
  }

  async function openDocument(docId: string) {
    setNotice(null)
    setOpeningDoc(docId)
    try {
      const r = await fetchCandidateDocument(c.id, docId)
      await Linking.openURL(r.url)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The document did not open. Try again.')
    } finally {
      setOpeningDoc(null)
    }
  }

  async function openLink(url: string) {
    setNotice(null)
    try {
      await Linking.openURL(url)
    } catch {
      setNotice('The link did not open. Try again.')
    }
  }

  const sendLabel = slot.kind === 'sent'
    ? slot.left ? `Interest sent · ${slot.left}` : 'Interest sent'
    : slot.kind === 'wait' ? `Send again after ${slot.until}` : null

  const footer = (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={passDays ? `Pass, hidden for ${passDays} days` : 'Pass'}
        accessibilityState={{ busy: passing }}
        onPress={() => { pass() }}
        style={({ pressed }) => [styles.pass, pressed && styles.pressed]}
      >
        {passing ? <ActivityIndicator color={color.danger} /> : <Icon name="x" size={space.lg + space['2xs']} tint={color.danger} />}
      </Pressable>

      {c.shortlisted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shortlisted. Open notes, tags and job"
          accessibilityState={{ busy: entryLoading || (!!entry && jobRefs === null) }}
          disabled={entryLoading || !!entry}
          onPress={() => { openEntry() }}
          style={({ pressed }) => [styles.shortlisted, pressed && styles.pressed]}
        >
          {entryLoading || (!!entry && jobRefs === null)
            ? <ActivityIndicator color={color.success} />
            : <Icon name="check" size={space.lg + space['2xs']} tint={color.success} weight={2.4} />}
          <Text style={[text.uiMdSemi, styles.successText]}>Shortlisted</Text>
        </Pressable>
      ) : (
        <Button variant="outline" size="md" icon="bookmark" label="Shortlist" busy={shortlisting} style={styles.shortlist} onPress={() => { shortlist() }} />
      )}

      {slot.kind === 'send' && (
        <Button variant="primary" size="md" icon="heart" label="Send Interest" style={[styles.grow, styles.lift]} onPress={() => setInterestOpen(true)} />
      )}
      {slot.kind === 'chat' && (
        <Button
          variant="primary"
          size="md"
          icon="chat"
          label="Open chat"
          style={[styles.grow, styles.lift]}
          onPress={() => (slot.threadId ? navigation.navigate('EmployerThread', { id: slot.threadId }) : navigation.navigate('EmployerChats'))}
        />
      )}
      {!!sendLabel && (
        <View style={styles.quiet} accessible accessibilityRole="text" accessibilityLabel={sendLabel}>
          <Text style={[text.uiMdSemi, styles.muted]} numberOfLines={1} adjustsFontSizeToFit>{sendLabel}</Text>
        </View>
      )}
    </View>
  )

  return (
    <EmployerShell back={back} bar={false} scroll={false} footer={footer}>
      <View style={[styles.bar, compact && styles.barCompact]}>
        <EmIconButton name="arrowL" label="Back" size={height['control-xs']} iconSize={height.glyph - space['2xs']} tint={color.textSecondary} onPress={back} />
        {compact ? (
          <>
            <Face name={c.name} photo={c.photoUrl} size={height.avatar} />
            <View style={styles.barText}>
              <Text style={text.uiBaseSemi} numberOfLines={1}>{c.name}</Text>
              <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{personLine(c, experienceShort(c.experienceYears))}</Text>
            </View>
          </>
        ) : (
          <View style={styles.grow} />
        )}
        {!compact && !!counter && <Text style={[text.uiSm, styles.muted, styles.counter]}>{counter}</Text>}
        {!!next && (
          <EmIconButton
            name="chevR"
            label={`Next candidate, ${next.name}`}
            size={height['control-banner']}
            iconSize={space.lg}
            tint={color.textSecondary}
            bordered="soft"
            onPress={goNext}
          />
        )}
      </View>

      <View style={styles.grow}>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.filmWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={stream ? (muted ? 'Turn the sound on' : 'Mute') : `Watch ${c.name}’s full interview`}
              disabled={!stream && (!hasInterview || playsOut)}
              onPress={stream ? toggleSound : openFull}
            >
              <FilmStill name={c.name} poster={poster} height={FILM_H} corner={radius['card-lg']} play={!stream && hasInterview ? 'lg' : undefined}>
                {!!stream && (
                  <Video
                    source={{ uri: stream }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    muted={muted}
                    repeat
                    paused={!focused || compact || interestOpen || !!clip || !!entry}
                    // A lapsed link: re-sign this card free through the shared deck; the new address replays it.
                    onError={() => { refreshDeckMedia([c.id]) }}
                  />
                )}
                <View style={styles.filmTop} pointerEvents="box-none">
                  {shortDate ? <GlassPill icon="check" label={`Verified interview · ${shortDate}`} /> : <View />}
                  {!!stream && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'}
                      onPress={toggleSound}
                      hitSlop={spaceHalf['1.5']}
                      style={({ pressed }) => [styles.mute, pressed && styles.pressed]}
                    >
                      <Icon name={muted ? 'mute' : 'sound'} size={spaceHalf['3.5'] + borderWidth.thin} tint={color.textOnInk} />
                    </Pressable>
                  )}
                </View>
                <View style={styles.filmFoot} pointerEvents="box-none">
                  {stream && muted ? <Text style={[text.metaMd, styles.filmHint]}>Film · tap for sound</Text> : <View />}
                  {hasInterview && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={playsOut ? 'Full interview: no plays left today, resets at midnight' : `Play ${c.name}’s full interview`}
                      accessibilityState={{ disabled: playsOut }}
                      disabled={playsOut}
                      onPress={openFull}
                      hitSlop={{ top: spaceHalf['2.5'], bottom: spaceHalf['2.5'], left: space.xs, right: space.xs }}
                      style={({ pressed }) => [pressed && styles.pressed, playsOut && styles.off]}
                    >
                      <GlassPill icon="max" label={fullLabel} />
                    </Pressable>
                  )}
                </View>
              </FilmStill>
            </Pressable>
          </View>

          <View style={styles.who} onLayout={onHeadLayout}>
            <Face name={c.name} photo={c.photoUrl} size={PHOTO} />
            <View style={styles.whoText}>
              <Text style={text.displaySm} numberOfLines={2}>{c.name}</Text>
              {!!personLine(c, c.city) && <Text style={[text.uiSm, styles.muted]}>{personLine(c, c.city)}</Text>}
            </View>
          </View>
          {!!headline && <Text style={[text.uiMd, styles.secondary, styles.headline]}>{headline}</Text>}
          {shortlistedBy ? (
            <View style={styles.signal}>
              <Icon name="users" size={space.md + space['2xs']} tint={color.textMuted} />
              <Text style={[text.uiSm, styles.muted]}>{shortlistedBy}</Text>
            </View>
          ) : (
            <View style={styles.signalGap} />
          )}

          <ProfileFactTiles salary={expectedSalaryOf(c, card)} availability={availabilityOf(c, card)} experienceYears={c.experienceYears} />

          <ProfileVideoRow
            name={c.name}
            poster={poster}
            interview={hasInterview ? { onPress: openFull, disabled: playsOut, durationSec: interviewSec } : null}
            videos={clips}
            onPlayClip={playClip}
          />

          <ProfileResume candidate={c} onOpenDocument={openDocument} openingDoc={openingDoc} onOpenLink={openLink} />
        </ScrollView>

        {!!notice && <StudioToast icon="alert" message={notice} style={styles.toast} />}
      </View>

      <SendInterestSheet
        open={interestOpen}
        candidate={{ id: c.id, name: c.name, photoUrl: c.photoUrl, tier: c.tier, qualification: c.qualification, city: c.city, verified: c.verifiedInterview?.verified }}
        onClose={() => setInterestOpen(false)}
        onSent={(r) => {
          setCandidate((prev) => (prev ? { ...prev, interest: 'SENT' } : prev))
          patchCards((x) => (x.id === c.id ? { ...x, interest: 'SENT' } : x))
          setInterest({
            id: r.id, candidateId: c.id, name: c.name, outcome: 'SENT', message: null, jobId: null,
            sentAt: r.sentAt, expiresAt: r.expiresAt, closedAt: null, connected: false, nextEligibleAt: r.nextEligibleAt ?? null, threadId: null,
          })
        }}
      />
      <ShortlistEntrySheet
        open={!!entry && jobRefs !== null}
        row={entry?.row ?? null}
        knownTags={entry?.tags ?? []}
        jobs={linkableJobs(jobRefs ?? [])}
        onClose={() => setEntry(null)}
        onSaved={() => {}}
      />
      <ClipPlayer url={clip?.url ?? null} title={clip?.title} onClose={() => setClip(null)} />
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  successText: { color: color.success },
  loading: { paddingVertical: space['3xl'] },
  gone: { flex: 1, justifyContent: 'center', paddingBottom: space['4xl'] },

  // The bar: back, the feed count and Next (P1); scrolled, the compact head on white (P2).
  bar: { height: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: spaceHalf['2.5'], paddingRight: space.md },
  barCompact: {
    height: height['control-hero'],
    gap: space.sm,
    paddingLeft: spaceHalf['1.5'],
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  barText: { flex: 1, minWidth: 0 },
  counter: { marginRight: spaceHalf['1.5'] },

  page: { paddingBottom: space.lg },

  // The film (P1).
  filmWrap: { paddingHorizontal: space.lg },
  filmTop: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  mute: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkGlass, alignItems: 'center', justifyContent: 'center' },
  filmFoot: { position: 'absolute', left: spaceHalf['3.5'], right: spaceHalf['3.5'], bottom: spaceHalf['3.5'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  filmHint: { color: color.textOnInkMuted },

  // The person (P1).
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingHorizontal: space.xl, paddingBottom: space.xs },
  whoText: { flex: 1, minWidth: 0, gap: space['2xs'] },
  headline: { paddingTop: spaceHalf['1.5'], paddingHorizontal: space.xl, paddingBottom: space.xs },
  signal: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingTop: space.xs, paddingHorizontal: space.xl, paddingBottom: space.md },
  signalGap: { height: space.md },

  // The pinned decisions.
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pass: {
    width: height['deck-action-sm'],
    height: height['control-sm'],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.dangerBorder,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortlist: { paddingHorizontal: spaceHalf['4.5'] },
  shortlisted: {
    height: height['control-sm'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spaceHalf['1.5'],
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.successEdge,
    backgroundColor: color.successSoft,
  },
  lift: { boxShadow: shadow.accent },
  quiet: {
    flex: 1,
    minWidth: 0,
    height: height['control-sm'],
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },

  toast: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
})
