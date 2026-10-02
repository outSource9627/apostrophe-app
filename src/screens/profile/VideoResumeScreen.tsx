import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Video, { type VideoRef } from 'react-native-video'
import { borderWidth, color, fontFamilyNative as FF, radius } from '../../theme'
import { FilmThumb, StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, DetailHeader, Skel, StateBlock } from '../../components/tab/kit'
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
 * card on Home go, as the refined mockup draws it
 * (docs/saved-applications-video-final.html). Mirrors the web `/profile/video-resume` page.
 *
 * It plays in a 9:16 frame — the film employers watch first — with the
 * verified seal on it, and a strip for its duration and dates. The header pill
 * says what employers can see right now. When there is no film to play the
 * screen says why in the film's own state (still being made, failed, taken
 * down, never made) and offers the one next step the app really has, instead of
 * a player with nothing in it.
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
      <DetailHeader title="Video resume" onBack={onBack} />
      {child}
    </View>
  )

  if (q.isPending || paywalled) {
    return frame(
      <View style={styles.loading}>
        <Skel w={226} h={402} />
        <Skel w="100%" h={64} />
      </View>,
    )
  }
  if (q.isError || !q.data) {
    return frame(
      <StateBlock
        icon="alert"
        title="Could not load your video resume"
        body={q.error instanceof Error ? q.error.message : undefined}
        action="Try again"
        onAction={() => { void q.refetch() }}
      />,
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
      <DetailHeader title="Video resume" onBack={onBack} right={pillFor(film, previewing)} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 130 }]} showsVerticalScrollIndicator={false}>
        {!!notice && (
          <View style={[styles.notice, notice.warn ? styles.noticeWarn : styles.noticePlain]} accessibilityLiveRegion="polite">
            <Text style={[styles.noticeText, notice.warn && styles.noticeWarnText]}>{notice.body}</Text>
          </View>
        )}

        {watching !== null && other.isPending ? (
          <View style={styles.loading}><Skel w={226} h={402} /></View>
        ) : watching !== null && (other.isError || !film) ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateBody}>{other.error instanceof Error ? other.error.message : 'That video could not be loaded.'}</Text>
            <Btn variant="outline" label="Try again" onPress={() => { void other.refetch() }} />
            <Btn variant="quiet" label="Back to my primary video" onPress={showPrimary} />
          </View>
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

/** The header pill: what employers can see right now. */
function pillFor(film: VideoResume | undefined, previewing: boolean): React.ReactNode {
  if (!film) return null
  if (film.status === 'PUBLISHED') {
    if (previewing) return <StatusPill tone="neutral" label="Preview" />
    if (film.held) return <StatusPill tone="warning" label="Not live yet" />
    return film.live ? <StatusPill tone="success" label="Live" /> : <StatusPill tone="neutral" label="Published" />
  }
  const m = FILM_PILL[film.status]
  return <StatusPill tone={m.tone} label={m.label} />
}
const FILM_PILL: Record<Exclude<VideoResume['status'], 'PUBLISHED'>, { tone: Tone; label: string }> = {
  PROCESSING: { tone: 'warning', label: 'Processing' },
  FAILED: { tone: 'danger', label: 'Could not be made' },
  UNPUBLISHED: { tone: 'danger', label: 'Taken down' },
  NONE: { tone: 'neutral', label: 'No film yet' },
}

const HELD_NOTICE = {
  warn: true,
  body: 'Your video resume is not live yet. A top-up on your interview is outstanding — employers cannot see it until it is settled.',
}
const PREVIEW_NOTICE = {
  warn: false,
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
        <View style={styles.seal} pointerEvents="none">
          <Icon name="check" size={12} tint={color.success} weight={3} />
          <Text style={styles.sealText}>{at ? `VERIFIED · ${fmtDayMonthYear(at).toUpperCase()}` : 'VERIFIED'}</Text>
        </View>
      </View>

      <View style={styles.strip}>
        <Fact label="Duration" value={duration ?? undefined} />
        <Fact label="Published" value={film.publishedAt ? fmtDayMonthYear(film.publishedAt) : undefined} />
        <Fact label="Interviewed" value={film.interviewedAt ? fmtDayMonthYear(film.interviewedAt) : undefined} last />
      </View>
    </View>
  )
}

function Fact({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.fact, !last && styles.factRule]}>
      <Text style={styles.factLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.factValue, !value && styles.factNone]} numberOfLines={2}>{value ?? '—'}</Text>
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
          <Text style={styles.noteText}>{note}</Text>
          <Btn variant="outline" label="Try again" onPress={() => { void renew(true) }} style={styles.noteBtn} />
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
  const pinned = outcome ? outcome.pinned : !!data?.pinned
  return (
    <View style={styles.videos}>
      <Text style={styles.sectionTitle}>Interview videos</Text>
      {failed && !data ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateBody}>Your interview videos could not be loaded.</Text>
          <Btn variant="outline" label="Try again" onPress={onRetry} />
        </View>
      ) : (
        <>
          <Text style={styles.fine}>Employers see the Primary one.</Text>
          {pinned && <Text style={styles.fine}>A newer interview will not replace this one until you choose it.</Text>}
          {!!error && <View style={[styles.notice, styles.noticeDanger]}><Text style={styles.noticeDangerText}>{error}</Text></View>}
          {!!outcome && (
            <View style={[styles.notice, styles.noticeOk]} accessibilityLiveRegion="polite">
              <Text style={styles.noticeOkText}>This is now your primary video.</Text>
              {outcome.held && <Text style={styles.noticeOkText}>Your profile stays off the feed until your top-up is settled.</Text>}
            </View>
          )}
          <View>
            {(data?.videos ?? []).map((row, i) => (
              <InterviewVideoRowView
                key={row.interviewId}
                row={row}
                first={i === 0}
                shown={watching !== null ? row.interviewId === watching : row.primary}
                making={makingId === row.interviewId}
                disabled={makingId !== null}
                onWatch={() => onWatch(row)}
                onMakePrimary={() => onMakePrimary(row)}
              />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function InterviewVideoRowView({
  row, first, shown, making, disabled, onWatch, onMakePrimary,
}: { row: InterviewVideoRow; first: boolean; shown: boolean; making: boolean; disabled: boolean; onWatch: () => void; onMakePrimary: () => void }) {
  const date = fmtDayMonthYear(row.interviewedAt)
  const length = clock(row.durationSec)
  const mark = STATUS_PILL[row.status]
  const ready = row.status === 'READY'
  return (
    <View style={[styles.vrow, !first && styles.vrowRule]}>
      <View style={[styles.thumb, !ready && styles.thumbOff]}>
        <Icon name="play" size={14} tint={ready ? color.textInverse : color.textSubtle} fill={ready ? color.textInverse : color.textSubtle} />
      </View>
      <View style={styles.grow}>
        <View style={styles.vhead}>
          <Text style={styles.vdate}>{date}</Text>
          {!!length && <Text style={styles.vlen}>{length}</Text>}
        </View>
        <View style={styles.pills}>
          {row.primary && <StatusPill tone="accent" label="Primary" />}
          {(!row.primary || !ready) && <StatusPill tone={mark.tone} label={mark.label} />}
        </View>
        {!row.primary && !row.selectable && !!row.reason && <Text style={styles.vreason}>{row.reason}</Text>}
      </View>
      <View style={styles.vactions}>
        {ready && (
          <Btn
            variant="outline"
            label={shown ? 'Watching' : 'Watch'}
            accessibilityLabel={`Watch the interview of ${date}`}
            disabled={shown}
            onPress={onWatch}
            style={styles.small}
          />
        )}
        {row.selectable && (
          <Btn variant="ink" label="Make primary" accessibilityLabel={`Make the interview of ${date} your primary video`} busy={making} disabled={disabled && !making} onPress={onMakePrimary} style={styles.small} />
        )}
      </View>
    </View>
  )
}

/* ─────────────────────────── everything else ─────────────────────────── */

/** One card for the four states with no film to play. Each says what is true and stops there. */
function NotPlayable({ film, onCheck, onBook }: { film: VideoResume; onCheck: () => void; onBook: () => void }) {
  const s = describe(film, { onCheck, onBook })
  return (
    <View style={styles.stateCard}>
      <FilmThumb status={film.status === 'PUBLISHED' ? 'PROCESSING' : film.status} width={92} />
      <View style={styles.stateText}>
        <Text style={styles.stateTitle}>{s.title}</Text>
        <Text style={styles.stateBody}>{s.body}</Text>
      </View>
      {film.status === 'UNPUBLISHED' && !!film.reason && (
        <View style={styles.reason}>
          <Text style={styles.reasonLabel}>REASON GIVEN</Text>
          <Text style={styles.reasonText}>{film.reason}</Text>
        </View>
      )}
      {s.action}
    </View>
  )
}

function describe(film: VideoResume, on: { onCheck: () => void; onBook: () => void }) {
  switch (film.status) {
    case 'FAILED':
      return {
        title: 'Your film could not be made',
        body: 'Something went wrong while making the film from your interview. Talk to support and we will look into it.',
        action: <Btn variant="ink" label="Talk to support" onPress={() => { void openSupport('My video resume') }} />,
      }
    case 'UNPUBLISHED':
      return {
        title: 'Your film has been taken down',
        body: 'Employers cannot see it while it is down. If you think this is a mistake, talk to support.',
        action: <Btn variant="ink" label="Talk to support" onPress={() => { void openSupport('My video resume') }} />,
      }
    case 'NONE':
      return {
        title: 'You do not have a video resume yet',
        body: 'The interview you book becomes your video resume — the one thing employers watch before they read a word.',
        action: <Btn label="Book an interview" onPress={on.onBook} />,
      }
    default:
      // PROCESSING, and a PUBLISHED film with nothing to play.
      return {
        title: film.pipelinePending ? 'Your film is not ready yet' : 'Your film is being prepared',
        body: film.pipelinePending
          ? 'Your interview is done, but we cannot say when the film will be ready. It will appear here once it is.'
          : 'Your interview is done and your film is being made. It will appear here when it is ready.',
        action: <Btn variant="outline" label="Check again" onPress={on.onCheck} />,
      }
  }
}

const PLAYER_W = 226

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  loading: { padding: 20, gap: 14, alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  grow: { flex: 1, minWidth: 0 },

  notice: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  noticeText: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textSecondary },
  noticePlain: { backgroundColor: color.surfaceMuted },
  noticeWarn: { backgroundColor: color.warningSoft },
  noticeWarnText: { color: color.warning },
  noticeOk: { backgroundColor: color.successSoft },
  noticeOkText: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.success },
  noticeDanger: { backgroundColor: color.dangerSoft },
  noticeDangerText: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.danger },

  published: { alignItems: 'center', gap: 16 },
  // The one video an employer sees, in the 9:16 it is recorded in.
  player: { width: PLAYER_W, aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', backgroundColor: color.inkDeep },
  seal: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: color.onInkDisc, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10,
  },
  sealText: { fontFamily: FF.monoMedium, fontSize: 10, letterSpacing: 0.6, color: color.success },
  note: {
    position: 'absolute', left: 12, right: 12, bottom: 56, gap: 8, padding: 12, borderRadius: 14, backgroundColor: color.scrimStrong,
  },
  noteText: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textInverse },
  noteBtn: { height: 40 },

  strip: {
    alignSelf: 'stretch', flexDirection: 'row', borderRadius: 20, backgroundColor: color.surface,
    borderWidth: borderWidth.thin, borderColor: color.border,
  },
  fact: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  factRule: { borderRightWidth: borderWidth.thin, borderRightColor: color.border },
  factLabel: { fontFamily: FF.monoMedium, fontSize: 10, letterSpacing: 1, color: color.textMuted },
  factValue: { fontFamily: FF.bodySemiBold, fontSize: 15.5, letterSpacing: -0.15, color: color.text, marginTop: 4 },
  factNone: { color: color.textSubtle },

  videos: { gap: 8, paddingTop: 4 },
  sectionTitle: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.34, color: color.text },
  fine: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  vrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  vrowRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  thumb: { width: 40, aspectRatio: 9 / 16, borderRadius: 8, backgroundColor: color.accentDeep, alignItems: 'center', justifyContent: 'center' },
  thumbOff: { backgroundColor: color.surfaceMuted },
  vdate: { fontFamily: FF.bodySemiBold, fontSize: 15.5, color: color.text },
  vhead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  vlen: { fontFamily: FF.body, color: color.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  vreason: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 6 },
  vactions: { gap: 6 },
  small: { height: 40, borderRadius: 12, paddingHorizontal: 14 },

  stateCard: {
    alignItems: 'center', gap: 10, paddingVertical: 26, paddingHorizontal: 20, borderRadius: 28,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  stateText: { alignItems: 'center', gap: 6 },
  stateTitle: { fontFamily: FF.bodyBold, fontSize: 21, lineHeight: 24, letterSpacing: -0.63, color: color.text, textAlign: 'center' },
  stateBody: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.textMuted, textAlign: 'center' },
  reason: { alignSelf: 'stretch', borderRadius: 14, backgroundColor: color.surfaceMuted, padding: 12, gap: 3 },
  reasonLabel: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, color: color.textMuted },
  reasonText: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
})
