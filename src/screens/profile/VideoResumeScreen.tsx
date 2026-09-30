import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Video, { type VideoRef } from 'react-native-video'
import { aspect, borderWidth, color, container, radius, space, spaceHalf, trackingNative } from '../../theme'
import {
  Banner, Body, Button, Card, Display, ErrorState, FilmThumb, Meta, ScreenHeader, Skeleton, StatusPill, VerifiedSeal, text,
} from '../../components/ui'
import { ApiClientError } from '../../lib/api'
import {
  getInterviewVideos, getVideoResume, setPrimaryInterview,
  type InterviewVideoRow, type InterviewVideoStatus, type InterviewVideos, type PrimaryInterviewResult, type VideoResume,
} from '../../lib/api/student'
import { fmtDayMonthYear } from '../../lib/chat/format'
import { clock } from '../../lib/employer/candidateFormat'
import { openSupport } from '../../lib/support'
import type { Tone } from '../../components/ui'

/** An error this soon after a swap means the fresh address is bad too; asking again would only loop. */
const COOLDOWN_MS = 8_000

/**
 * SP-07 — the student's own video resume, where "Watch my film" and the film
 * card on Home go. Mirrors the web `/profile/video-resume` page.
 *
 * It plays in a 9:16 frame — the film employers watch first — and says when it
 * was made and how long it runs. When there is no film to play the screen says
 * why in the film's own state (still being made, failed, taken down, never
 * made) and offers the one next step the app really has, instead of a player
 * with nothing in it.
 *
 * Everything on the screen is read from `GET /students/me/video-resume`. The
 * signed address in it lasts about fifteen minutes, so it is held only in this
 * query (never stored, and dropped the moment the screen closes) and the player
 * asks for a new one when it runs out — a lapsed link resumes where it stopped.
 *
 * A published film is not always LIVE: `live` says the profile is out with this
 * film leading, and `held` that an outstanding top-up keeps it off the feed. The
 * screen says so above the player rather than letting "published" stand for
 * "employers see it".
 *
 * With two or more interviews the student can watch each one (the same read, for
 * that interview) and choose which is primary. Watching never changes what
 * employers see; only Make primary does, and the API's refusal is shown as it is.
 *
 * Nothing here promises a time — `pipelinePending` is the API saying no render
 * pipeline is working on the film yet, so "soon" would be a promise nobody is
 * keeping — and nothing states who is at fault or what was or was not charged,
 * because the API does not say.
 */
export function VideoResumeScreen({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  // null = the primary film; an id = that interview's film, being watched.
  const [watching, setWatching] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<PrimaryInterviewResult | null>(null)

  // A signed address must not outlive the screen: no cache time, and always read again on open.
  const q = useQuery({
    queryKey: ['video-resume', 'screen'],
    queryFn: () => getVideoResume(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  })
  // The film of the interview being watched. Its key carries the id, so the player's renewal (`refetch`) asks for the SAME interview.
  const other = useQuery({
    queryKey: ['video-resume', 'screen', watching],
    queryFn: () => getVideoResume({ interviewId: watching ?? undefined }),
    enabled: watching !== null,
    staleTime: 0,
    gcTime: 0,
  })
  const interviews = useQuery({ queryKey: ['interview-videos'], queryFn: () => getInterviewVideos(), staleTime: 0, refetchOnMount: 'always' })

  const makePrimary = useMutation({
    mutationFn: (interviewId: string) => setPrimaryInterview(interviewId),
    onSuccess: async (r) => {
      setOutcome(r)
      setWatching(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['interview-videos'] }),
        qc.invalidateQueries({ queryKey: ['video-resume'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })

  // A paywall means the student has not paid: there is no film to show, so leave rather than draw an error.
  const paywalled = q.isError && q.error instanceof ApiClientError && q.error.isPaywall
  useEffect(() => {
    if (paywalled) onBack()
  }, [paywalled, onBack])

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader onBack={onBack} />
      {child}
    </View>
  )

  if (q.isPending || paywalled) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError || !q.data) {
    return frame(
      <View style={styles.centre}>
        <ErrorState
          title="Could not load your video resume"
          body={q.error instanceof Error ? q.error.message : undefined}
          action={<Button variant="outline" size="md" label="Try again" onPress={() => { void q.refetch() }} />}
        />
      </View>,
    )
  }

  const rows = interviews.data?.videos ?? []
  const view = watching !== null ? other : q
  const film = view.data
  // PUBLISHED always carries an address; if one ever did not, there is nothing to play and the screen says the film is not ready.
  const url = film && film.status === 'PUBLISHED' ? film.url : null
  const previewing = watching !== null && rows.find((r) => r.interviewId === watching)?.primary === false
  const notice = film && film.status === 'PUBLISHED' && !film.live
    ? film.held ? HELD_NOTICE : previewing ? PREVIEW_NOTICE : null
    : null

  const showPrimary = () => {
    setWatching(null)
    void q.refetch()
  }
  const watch = (row: InterviewVideoRow) => {
    // What the last Make primary said is about that moment, not about the film now on screen.
    setOutcome(null)
    makePrimary.reset()
    if (row.primary) { showPrimary() } else { setWatching(row.interviewId) }
    scroll.current?.scrollTo({ y: 0, animated: true })
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader onBack={onBack} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={[text.metaMd, styles.eyebrow]}>YOUR PROFILE</Text>
          <Text style={text.displayMd}>Your video resume</Text>
          {!!url && (
            <Body size="sm" tone="muted">
              The film from your interview. Employers watch this first; any videos you add yourself appear below it, marked as not verified.
            </Body>
          )}
        </View>

        {!!notice && (
          <Card style={styles.notice} accessibilityLiveRegion="polite">
            <StatusPill tone={notice.tone} label={notice.pill} />
            <Body size="sm">{notice.body}</Body>
          </Card>
        )}

        {watching !== null && other.isPending ? (
          <View style={styles.loading}><Skeleton lines={3} /></View>
        ) : watching !== null && (other.isError || !film) ? (
          <Card style={styles.state}>
            <Body size="base" tone="muted" style={styles.centered}>
              {other.error instanceof Error ? other.error.message : 'That video could not be loaded.'}
            </Body>
            <Button variant="outline" size="md" label="Try again" onPress={() => { void other.refetch() }} />
            <Button variant="quiet" size="md" label="Back to my primary video" onPress={showPrimary} />
          </Card>
        ) : film && url ? (
          <Published key={watching ?? 'primary'} film={film} url={url} refresh={async () => (await view.refetch()).data ?? null} />
        ) : film ? (
          <NotPlayable film={film} onCheck={() => { void view.refetch() }} onBook={onBook} />
        ) : null}

        {(rows.length >= 2 || interviews.isError) && (
          <InterviewVideosSection
            data={interviews.data}
            failed={interviews.isError}
            watching={watching}
            makingId={makePrimary.isPending ? makePrimary.variables ?? null : null}
            error={makePrimary.isError ? (makePrimary.error instanceof Error ? makePrimary.error.message : 'That video could not be made primary.') : null}
            outcome={outcome}
            onWatch={watch}
            onMakePrimary={(row) => { setOutcome(null); makePrimary.reset(); makePrimary.mutate(row.interviewId) }}
            onRetry={() => { void interviews.refetch() }}
          />
        )}
      </ScrollView>
    </View>
  )
}

const HELD_NOTICE = {
  tone: 'warning' as Tone,
  pill: 'Not live yet',
  body: 'Your video resume is not live yet. A top-up on your interview is outstanding — employers cannot see it until it is settled.',
}
const PREVIEW_NOTICE = {
  tone: 'neutral' as Tone,
  pill: 'Preview',
  body: 'You are previewing a video that is not your primary one.',
}

/* ─────────────────────────── published ─────────────────────────── */

function Published({
  film, url, refresh,
}: { film: VideoResume; url: string; refresh: () => Promise<VideoResume | null> }) {
  // The seal says when the interview happened, which is the date the design's mark carries.
  const at = film.interviewedAt ?? film.publishedAt
  const duration = clock(film.durationSec)
  return (
    <View style={styles.published}>
      <View style={styles.player}>
        <FilmPlayer url={url} posterUrl={film.posterUrl} refresh={refresh} />
        <VerifiedSeal style={styles.seal} date={at ? fmtDayMonthYear(at) : undefined} />
      </View>

      <Card style={styles.facts}>
        <Fact label="Duration" value={duration ?? undefined} />
        <Fact label="Published" value={film.publishedAt ? fmtDayMonthYear(film.publishedAt) : undefined} />
        <Fact label="Interviewed" value={film.interviewedAt ? fmtDayMonthYear(film.interviewedAt) : undefined} />
      </Card>
    </View>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.fact}>
      <Meta style={styles.factLabel}>{label.toUpperCase()}</Meta>
      <Body size="sm" tone={value ? 'default' : 'subtle'}>{value ?? 'Not available'}</Body>
    </View>
  )
}

/**
 * The player. The address lasts about fifteen minutes, so when it stops working (a
 * lapsed link, a broken segment) it asks the screen for a new one and carries on from
 * where it was. Asking again straight after a swap would only loop, so a second error
 * inside the cooldown says so instead.
 */
function FilmPlayer({
  url, posterUrl, refresh,
}: { url: string; posterUrl: string | null; refresh: () => Promise<VideoResume | null> }) {
  const player = useRef<VideoRef>(null)
  const at = useRef(0)
  const resumeAt = useRef(0)
  const swappedAt = useRef(0)
  const renewing = useRef(false)
  const [paused, setPaused] = useState(true)
  const [note, setNote] = useState<string | null>(null)

  const renew = useCallback(async (force: boolean) => {
    if (renewing.current) return
    if (!force && Date.now() - swappedAt.current < COOLDOWN_MS) {
      setNote('The film could not be played. Check your connection and try again.')
      return
    }
    renewing.current = true
    swappedAt.current = Date.now()
    resumeAt.current = at.current
    setNote(null)
    // Pressing play on a lapsed link is what got us here, so carry on playing once the new one loads.
    const next = await refresh()
    renewing.current = false
    if (!next || next.status !== 'PUBLISHED' || !next.url) {
      setNote('The film could not be played. Check your connection and try again.')
    }
  }, [refresh])

  return (
    <>
      <Video
        ref={player}
        source={{ uri: url }}
        poster={posterUrl ? { source: { uri: posterUrl }, resizeMode: 'cover' } : undefined}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        controls
        paused={paused}
        onPlaybackStateChanged={(s) => setPaused(!s.isPlaying)}
        progressUpdateInterval={500}
        onProgress={(p) => { at.current = p.currentTime }}
        onLoad={() => {
          if (resumeAt.current > 0) {
            player.current?.seek(resumeAt.current)
            resumeAt.current = 0
            setPaused(false)
          }
        }}
        onError={() => { void renew(false) }}
      />
      {!!note && (
        <View style={styles.note}>
          <Body size="sm" tone="inverse">{note}</Body>
          <Button variant="outline" size="sm" label="Try again" onPress={() => { void renew(true) }} />
        </View>
      )}
    </>
  )
}

/* ─────────────────────────── your interview videos ─────────────────────────── */

const STATUS_PILL: Record<InterviewVideoStatus, { label: string; tone: Tone }> = {
  READY: { label: 'Ready', tone: 'success' },
  PROCESSING: { label: 'Being made', tone: 'warning' },
  FAILED: { label: 'Could not be made', tone: 'danger' },
  UNPUBLISHED: { label: 'Taken down', tone: 'danger' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
}

/**
 * Every completed interview's video, so the student can watch each and choose which one leads. It is drawn only
 * from what the API returns: the state, the reason a video cannot be chosen, and whether it is primary.
 */
function InterviewVideosSection({
  data, failed, watching, makingId, error, outcome, onWatch, onMakePrimary, onRetry,
}: {
  data: InterviewVideos | undefined
  failed: boolean
  watching: string | null
  /** The interview whose Make primary is in flight. */
  makingId: string | null
  /** The API's own refusal, when Make primary was refused. */
  error: string | null
  outcome: PrimaryInterviewResult | null
  onWatch: (row: InterviewVideoRow) => void
  onMakePrimary: (row: InterviewVideoRow) => void
  onRetry: () => void
}) {
  // What Make primary just returned is fresher than the list it is about to refetch.
  const pinned = outcome ? outcome.pinned : !!data?.pinned
  return (
    <View style={styles.interviews}>
      <Display level="sm">Your interview videos</Display>
      {failed && !data ? (
        <Card style={styles.state}>
          <Body size="base" tone="muted" style={styles.centered}>Your interview videos could not be loaded.</Body>
          <Button variant="outline" size="md" label="Try again" onPress={onRetry} />
        </Card>
      ) : (
        <>
          <Body size="sm" tone="muted">
            Employers see the video marked Primary. Your most recent interview is primary until you choose another.
          </Body>
          {pinned && <Body size="sm" tone="muted">A newer interview will not replace this one until you choose it.</Body>}
          {!!error && <Banner tone="danger">{error}</Banner>}
          {!!outcome && (
            <Card style={styles.notice} accessibilityLiveRegion="polite">
              <Body size="sm">This is now your primary video.</Body>
              {outcome.held && <Body size="sm">Your profile stays off the feed until your top-up is settled.</Body>}
            </Card>
          )}
          {(data?.videos ?? []).map((row) => (
            <InterviewVideoCard
              key={row.interviewId}
              row={row}
              shown={watching !== null ? row.interviewId === watching : row.primary}
              making={makingId === row.interviewId}
              disabled={makingId !== null}
              onWatch={() => onWatch(row)}
              onMakePrimary={() => onMakePrimary(row)}
            />
          ))}
        </>
      )}
    </View>
  )
}

function InterviewVideoCard({
  row, shown, making, disabled, onWatch, onMakePrimary,
}: { row: InterviewVideoRow; shown: boolean; making: boolean; disabled: boolean; onWatch: () => void; onMakePrimary: () => void }) {
  const date = fmtDayMonthYear(row.interviewedAt)
  const length = clock(row.durationSec)
  const mark = STATUS_PILL[row.status]
  return (
    <Card style={styles.interviewCard}>
      <View style={styles.interviewHead}>
        <View style={styles.interviewText}>
          <Body size="base" weight="semibold">{date}</Body>
          {!!length && <Body size="sm" tone="muted">{length}</Body>}
        </View>
        <View style={styles.pills}>
          {row.primary && <StatusPill tone="accent" label="Primary" />}
          {(!row.primary || row.status !== 'READY') && <StatusPill tone={mark.tone} label={mark.label} />}
        </View>
      </View>
      {!row.primary && !row.selectable && !!row.reason && <Body size="xs" tone="muted">{row.reason}</Body>}
      {(row.status === 'READY' || row.selectable) && (
        <View style={styles.interviewActions}>
          {row.status === 'READY' && (
            <Button
              variant="outline"
              size="md"
              label={shown ? 'Watching' : 'Watch'}
              disabled={shown}
              accessibilityLabel={`Watch the interview of ${date}`}
              onPress={onWatch}
            />
          )}
          {row.selectable && (
            <Button
              variant="secondary"
              size="md"
              label="Make primary"
              busy={making}
              disabled={disabled && !making}
              accessibilityLabel={`Make the interview of ${date} your primary video`}
              onPress={onMakePrimary}
            />
          )}
        </View>
      )}
    </Card>
  )
}

/* ─────────────────────────── everything else ─────────────────────────── */

/** One card for the four states with no film to play. Each says what is true and stops there. */
function NotPlayable({ film, onCheck, onBook }: { film: VideoResume; onCheck: () => void; onBook: () => void }) {
  const s = describe(film, { onCheck, onBook })
  return (
    <Card style={styles.state}>
      <FilmThumb status={film.status === 'PUBLISHED' ? 'PROCESSING' : film.status} width={container['video-thumb-compact'] * 2} />
      {s.pill}
      <View style={styles.stateText}>
        <Display level="sm" style={styles.centered}>{s.title}</Display>
        <Body size="base" tone="muted" style={styles.centered}>{s.body}</Body>
      </View>
      {film.status === 'UNPUBLISHED' && !!film.reason && (
        <View style={styles.reason}>
          <Meta style={styles.factLabel}>REASON GIVEN</Meta>
          <Body size="base">{film.reason}</Body>
        </View>
      )}
      {s.action}
    </Card>
  )
}

function describe(film: VideoResume, on: { onCheck: () => void; onBook: () => void }) {
  switch (film.status) {
    case 'FAILED':
      return {
        pill: <StatusPill tone="danger" label="Could not be made" />,
        title: 'Your film could not be made',
        body: 'Something went wrong while making the film from your interview. Talk to support and we will look into it.',
        action: <Button variant="secondary" size="md" label="Talk to support" onPress={() => { void openSupport('My video resume') }} />,
      }
    case 'UNPUBLISHED':
      return {
        pill: <StatusPill tone="danger" label="Taken down" />,
        title: 'Your film has been taken down',
        body: 'Employers cannot see it while it is down. If you think this is a mistake, talk to support.',
        action: <Button variant="secondary" size="md" label="Talk to support" onPress={() => { void openSupport('My video resume') }} />,
      }
    case 'NONE':
      return {
        pill: null,
        title: 'You do not have a video resume yet',
        body: 'The interview you book becomes your video resume — the one thing employers watch before they read a word.',
        action: <Button variant="primary" size="md" label="Book an interview" onPress={on.onBook} />,
      }
    default:
      // PROCESSING, and a PUBLISHED film with nothing to play.
      return {
        pill: <StatusPill tone="warning" label="Processing" />,
        title: film.pipelinePending ? 'Your film is not ready yet' : 'Your film is being prepared',
        body: film.pipelinePending
          ? 'Your interview is done, but we cannot say when the film will be ready. It will appear here once it is.'
          : 'Your interview is done and your film is being made. It will appear here when it is ready.',
        action: <Button variant="outline" size="md" label="Check again" onPress={on.onCheck} />,
      }
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg },
  titleBlock: { gap: space.xs },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },

  published: { alignItems: 'center', gap: space.lg },
  // The one video an employer sees, in the 9:16 it is recorded in.
  player: {
    width: '100%',
    maxWidth: container['film-player'],
    aspectRatio: aspect.videoResume,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.inkDeep,
  },
  seal: { position: 'absolute', top: space.md, left: space.md },
  note: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: color.onInkGlass,
  },
  facts: { width: '100%', padding: space.lg, gap: space.md },
  notice: { padding: space.lg, gap: space.sm, alignItems: 'flex-start' },
  interviews: { gap: space.md },
  interviewCard: { padding: space.lg, gap: space.md },
  interviewHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  interviewText: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pills: { alignItems: 'flex-end', gap: space.xs },
  interviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { gap: space['2xs'] },
  factLabel: { color: color.textSubtle },

  state: { alignItems: 'center', gap: space.lg, padding: space.xl },
  stateText: { gap: spaceHalf['1.5'], alignItems: 'center' },
  centered: { textAlign: 'center' },
  reason: {
    alignSelf: 'stretch',
    gap: spaceHalf['1.5'],
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
})
