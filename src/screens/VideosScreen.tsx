import React, { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Video, { type VideoRef } from 'react-native-video'
import { api } from '../lib/api'
import {
  addSelfVideo,
  deleteSelfVideo,
  editSelfVideo,
  getVideoResume,
  listSelfVideos,
  type SelfVideo,
  type SelfVideoEdit,
  type SelfVideoKind,
  type SelfVideoStatus,
} from '../lib/api/student'
import {
  megabytes, pickVideo, uploadErrorText, uploadMedia, UPLOAD_CANCELLED, type PickedMedia, type UploadRule,
} from '../lib/api/uploads'
import { ApiClientError } from '../lib/api/types'
import { clock } from '../lib/employer/candidateFormat'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  FilmThumb,
  Input,
  ProgressBar,
  ScreenHeader,
  Sheet,
  Skeleton,
  StatusPill,
  Toggle,
  UnverifiedMark,
  VerifiedSeal,
  VideoThumb,
  text,
} from '../components/ui'
import { Icon } from '../components/ui/Icon'
import type { Tone } from '../components/ui'

interface Profile { hiddenFromFeed: boolean }
interface Config {
  limits: { selfVideoMaxCount: number; selfVideoMaxSeconds: number }
  uploads?: Record<string, UploadRule>
}

const STATUS: Record<SelfVideoStatus, { label: string; tone: Tone }> = {
  APPROVED: { label: 'Approved', tone: 'success' },
  PENDING: { label: 'Waiting for review', tone: 'warning' },
  REJECTED: { label: 'Not published', tone: 'danger' },
}

/**
 * SP-03/SP-04 — the student's own short videos, and SP-12/SP-13 feed visibility.
 *
 * A list rather than a grid: on a phone each clip gets a full row and a real tap
 * target. The verified interview is set apart at the top because SP-05 means it
 * always leads — these sit behind it on a dashed frame with the Unverified mark.
 *
 * The student can play, edit and remove every clip. Title and kind are shown to
 * employers, so editing an approved clip sends it back to review (the server
 * decides, and says so in the reply, which is what the screen reports).
 */
const KINDS: readonly { value: SelfVideoKind; label: string }[] = [
  { value: 'INTRO', label: 'Introduction' },
  { value: 'PROJECT', label: 'A project' },
  { value: 'SKILL', label: 'A skill' },
]
const kindLabel = (kind: SelfVideoKind) => KINDS.find((k) => k.value === kind)?.label ?? kind
const nameOf = (v: SelfVideo) => v.title ?? kindLabel(v.kind)

/**
 * The longest title the server accepts (`PATCH /students/me/videos/:id` refuses more with a message). It is a
 * validation constant on the server, not an admin setting, and `/config` does not carry it; the server stays the
 * authority, so a change there is still caught and its sentence shown.
 */
const TITLE_MAX = 80

const COULD_NOT_PLAY = 'This video could not be played. Check your connection and try again.'

/** A duration the picker really measured. The Android picker reports 0 (or nothing) when it could not read one. */
const knownSeconds = (d: number | null | undefined): number | null =>
  typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null

/**
 * What to tell the student BEFORE anything is uploaded, or null to go ahead. Every number is the server's, read
 * from `/config`. When the file rules did not load nothing is guessed: the upload goes ahead and the server
 * refuses what it must. When the picker could not measure the length nothing is guessed either: no length is
 * sent, and the server reads the real one from the file.
 */
export function refusePicked(picked: PickedMedia, rule: UploadRule | undefined, maxSeconds: number): string | null {
  if (rule) {
    if (!rule.contentTypes.includes(picked.type)) return `Choose ${rule.label}.`
    if (picked.size > rule.maxBytes) {
      return `That video is ${megabytes(picked.size)}. The limit is ${megabytes(rule.maxBytes)}.`
    }
  }
  const seconds = knownSeconds(picked.durationSec)
  if (seconds !== null && seconds > maxSeconds) {
    return `That video is ${Math.round(seconds)} seconds. Keep it under ${maxSeconds}.`
  }
  return null
}

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiClientError || e instanceof Error ? e.message : fallback

/** One sentence for what an edit did, from the server's own reply. */
export function editOutcome(r: SelfVideoEdit): string {
  if (!r.changed) return 'Nothing changed.'
  if (r.resubmitted && r.status === 'PENDING') {
    return 'Saved. This video is back in review. Employers will not see it until it is approved again.'
  }
  return 'Saved.'
}

export function VideosScreen({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [kind, setKind] = useState<SelfVideoKind>('INTRO')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<SelfVideo | null>(null)
  const [removing, setRemoving] = useState<SelfVideo | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const videos = useQuery({ queryKey: ['videos'], queryFn: listSelfVideos })
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/students/me/profile'),
  })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })
  const film = useQuery({ queryKey: ['video-resume'], queryFn: () => getVideoResume().catch(() => null) })

  const setVisibility = useMutation({
    mutationFn: (hiddenFromFeed: boolean) =>
      api.patch('/students/me/profile', { hiddenFromFeed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteSelfVideo(id),
    onSuccess: async () => {
      setRemoving(null)
      setNotice('Video removed.')
      await qc.invalidateQueries({ queryKey: ['videos'] })
    },
  })
  const edit = useMutation({
    mutationFn: (v: { id: string; title: string | null; kind: SelfVideoKind }) =>
      editSelfVideo(v.id, { title: v.title, kind: v.kind }),
    onSuccess: async (r) => {
      setEditing(null)
      setNotice(editOutcome(r))
      await qc.invalidateQueries({ queryKey: ['videos'] })
    },
  })

  // A fresh signed address for the player: the list carries it, so the list is asked again.
  const renewLink = useCallback(async (id: string) => {
    const r = await videos.refetch()
    return r.data?.videos.find((v) => v.id === id)?.url ?? null
  }, [videos])

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title="Your videos" onBack={onBack} />
      {child}
    </View>
  )

  if (videos.isPending || profile.isPending || config.isPending) {
    return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  }

  if (videos.isError || profile.isError || config.isError) {
    return frame(
      <View style={styles.centre}>
        <ErrorState
          title="Could not load your videos."
          body="Check your connection and try again."
          action={
            <Button
              variant="outline"
              size="sm"
              label="Try again"
              // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
              hitSlop={(height.tap - height['control-xs']) / 2}
              onPress={() => {
                videos.refetch()
                profile.refetch()
                config.refetch()
              }}
            />
          }
        />
      </View>,
    )
  }

  const list = videos.data?.videos ?? []
  const max = config.data!.limits.selfVideoMaxCount
  const seconds = config.data!.limits.selfVideoMaxSeconds
  const rule = config.data!.uploads?.SELF_VIDEO
  const visible = !profile.data?.hiddenFromFeed
  const filmStatus = film.data?.status
  const published = filmStatus === 'PUBLISHED'
  const live = published && !!film.data?.live
  const uploading = progress !== null
  const playing = list.find((v) => v.id === playingId) ?? null

  async function addFromGallery() {
    setError(null)
    setNotice(null)
    let picked: PickedMedia | null
    try { picked = await pickVideo() } catch (e) { setError(uploadErrorText(e)); return }
    if (!picked) return
    const refusal = refusePicked(picked, rule, seconds)
    if (refusal) { setError(refusal); return }
    const length = knownSeconds(picked.durationSec)
    const ctl = new AbortController()
    abort.current = ctl
    try {
      setProgress(0)
      const key = await uploadMedia('SELF_VIDEO', picked, { onProgress: setProgress, signal: ctl.signal })
      // No length is sent when the picker could not measure one: the server reads it from the file.
      await addSelfVideo({
        kind,
        key,
        ...(length !== null ? { durationSec: length } : {}),
        ...(picked.size > 0 ? { sizeBytes: picked.size } : {}),
      })
      await qc.invalidateQueries({ queryKey: ['videos'] })
    } catch (e) {
      if (!(e instanceof Error && e.message === UPLOAD_CANCELLED)) setError(uploadErrorText(e))
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  return frame(
    <>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={[text.metaMd, styles.eyebrow]}>YOUR OWN RECORDINGS · {list.length} OF {max}</Text>
          <Text style={text.displayMd}>Say a bit more.</Text>
          <Text style={[text.uiMd, styles.muted]}>
            Up to {seconds} seconds each. Marked as not verified. Your interview film is watched first.
          </Text>
        </View>

        {!!notice && (
          <View accessibilityLiveRegion="polite">
            <Banner tone="info">{notice}</Banner>
          </View>
        )}

        <Card style={styles.row}>
          <FilmThumb status={filmStatus ?? 'NONE'} />
          <View style={styles.rowText}>
            <Text style={text.uiBaseSemi}>Your interview</Text>
            <Text style={[text.uiXs, styles.muted]}>
              {live
                ? 'Leads your profile'
                : published
                  ? film.data?.held ? 'Held back until your top-up is settled' : 'Not live on your profile yet'
                  : 'Filmed at your interview'}
            </Text>
          </View>
          {published ? <VerifiedSeal label="Verified" /> : <StatusPill tone="neutral" label="Not yet" />}
        </Card>

        {list.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={text.uiBaseSemi}>No videos yet.</Text>
          </Card>
        )}

        {list.map((v) => (
          <SelfVideoCard
            key={v.id}
            video={v}
            onPlay={() => { setNotice(null); setPlayingId(v.id) }}
            onEdit={() => { setNotice(null); edit.reset(); setEditing(v) }}
            onRemove={() => { setNotice(null); remove.reset(); setRemoving(v) }}
          />
        ))}

        {list.length < max ? (
          <Card style={styles.addCard}>
            <Text style={text.uiBaseSemi}>{max - list.length === 1 ? 'One slot left' : `${max - list.length} slots left`}</Text>
            <Text style={[text.uiXs, styles.muted]}>What is this one about?</Text>
            <View style={styles.kinds}>
              {KINDS.map((k) => (
                <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => !uploading && setKind(k.value)} />
              ))}
            </View>
            {uploading ? (
              <View style={styles.progress}>
                <View style={styles.progressHead}>
                  <Text style={[text.uiSm, styles.muted]}>Uploading…</Text>
                  <Text style={[text.metaMd, styles.pct]}>{Math.round((progress ?? 0) * 100)}%</Text>
                </View>
                <ProgressBar pct={(progress ?? 0) * 100} tone="accent" thin />
                <Button variant="outline" size="sm" label="Cancel" onPress={() => abort.current?.abort()} />
              </View>
            ) : (
              <Button variant="secondary" size="lg" full label="Choose a video from your gallery" onPress={addFromGallery} />
            )}
            {rule ? (
              <Text style={[text.uiXs, styles.subtle]}>{`${rule.label} · up to ${megabytes(rule.maxBytes)} · ${seconds} seconds`}</Text>
            ) : (
              <Text style={[text.uiXs, styles.subtle]}>{`Up to ${seconds} seconds. The file type and size are checked when you upload.`}</Text>
            )}
            {!!error && <Banner tone="danger">{error}</Banner>}
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={[text.uiMd, styles.muted]}>{`That is all ${max}. Delete one to add another.`}</Text>
          </Card>
        )}

        {/* SP-12 / SP-13 */}
        <Card style={styles.row}>
          <View style={styles.rowText}>
            <Text style={text.uiMdSemi}>Appear in employer searches</Text>
            <Text style={[text.uiXs, styles.muted]}>Nothing is deleted when this is off.</Text>
          </View>
          <Toggle on={visible} tone="success" onChange={(next) => setVisibility.mutate(!next)} label="Appear in employer searches" />
        </Card>
      </ScrollView>

      <EditSheet
        key={`edit-${editing?.id ?? 'none'}`}
        video={editing}
        busy={edit.isPending}
        error={edit.isError ? errorText(edit.error, 'The video could not be saved. Try again.') : null}
        onClose={() => setEditing(null)}
        onSave={(title, nextKind) => editing && edit.mutate({ id: editing.id, title, kind: nextKind })}
      />

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title="Remove this video?">
        <Body size="sm" tone="muted">This cannot be undone.</Body>
        {!!removing && <Body size="sm" weight="medium">{nameOf(removing)}</Body>}
        {remove.isError && <Banner tone="danger">{errorText(remove.error, 'The video could not be removed. Try again.')}</Banner>}
        <View style={styles.sheetButtons}>
          <Button
            variant="destructive"
            size="block"
            full
            busy={remove.isPending}
            label="Remove"
            accessibilityLabel={removing ? `Remove ${nameOf(removing)}` : 'Remove'}
            onPress={() => removing && remove.mutate(removing.id)}
          />
          <Button variant="quiet" size="block" full label="Keep it" onPress={() => setRemoving(null)} />
        </View>
      </Sheet>

      <SelfVideoPlayer
        key={`play-${playing?.id ?? 'none'}`}
        video={playing}
        onClose={() => setPlayingId(null)}
        onRenew={() => (playing ? renewLink(playing.id) : Promise.resolve(null))}
      />
    </>,
  )
}

/* ─────────────────────────── one clip ─────────────────────────── */

function SelfVideoCard({
  video: v, onPlay, onEdit, onRemove,
}: { video: SelfVideo; onPlay: () => void; onEdit: () => void; onRemove: () => void }) {
  const mark = STATUS[v.status]
  const name = nameOf(v)
  // A title stands for the clip; the kind then goes in the meta line so it is not lost.
  const meta = [v.title ? kindLabel(v.kind) : null, clock(v.durationSec)].filter(Boolean).join(' · ')
  const thumb = (
    <View>
      <VideoThumb verified={false} />
      {!!v.url && (
        <View pointerEvents="none" style={styles.playHole}>
          <View style={styles.playDisc}><Icon name="tri" size={space.md} tint={color.ink} fill={color.ink} weight={1.5} /></View>
        </View>
      )}
    </View>
  )
  return (
    <Card style={styles.videoCard}>
      <View style={styles.rowInner}>
        {v.url ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play ${name}`}
            onPress={onPlay}
            style={({ pressed }) => pressed && { opacity: opacity.pressed }}
          >
            {thumb}
          </Pressable>
        ) : thumb}
        <View style={styles.rowText}>
          <View style={styles.marks}>
            <UnverifiedMark />
            <StatusPill tone={mark.tone} label={mark.label} />
          </View>
          <Text style={text.uiBaseSemi}>{name}</Text>
          {!!meta && <Text style={[text.uiXs, styles.muted]}>{meta}</Text>}
          {v.status === 'PENDING' && !!v.editedAt && <Text style={[text.uiXs, styles.muted]}>Edited · back in review</Text>}
          {v.status === 'PENDING' && <Text style={[text.uiXs, styles.muted]}>We will tell you when it has been reviewed.</Text>}
          {v.status === 'APPROVED' && <Text style={[text.uiXs, styles.muted]}>Shown on your full profile to employers, marked not verified.</Text>}
          {v.status === 'REJECTED' && !!v.rejectionReason && <Body size="xs" tone="danger">{v.rejectionReason}</Body>}
        </View>
      </View>
      <View style={styles.actions}>
        <Button variant="outline" size="md" icon="edit" label="Edit" accessibilityLabel={`Edit ${name}, ${kindLabel(v.kind)}`} onPress={onEdit} />
        <Button variant="dangerText" size="md" icon="trash" label="Delete" accessibilityLabel={`Delete ${name}, ${kindLabel(v.kind)}`} onPress={onRemove} />
      </View>
    </Card>
  )
}

/* ─────────────────────────── edit ─────────────────────────── */

/**
 * Title (max `TITLE_MAX`) and kind. What saving costs depends on where the clip is: an approved one goes back to
 * review (said plainly, before), a rejected one is the way to fix and resubmit (its reason is shown), a pending
 * one is updated in place.
 */
function EditSheet({
  video, busy, error, onClose, onSave,
}: {
  video: SelfVideo | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (title: string | null, kind: SelfVideoKind) => void
}) {
  const [title, setTitle] = useState(video?.title ?? '')
  const [kind, setKind] = useState<SelfVideoKind>(video?.kind ?? 'INTRO')
  const status = video?.status
  const trimmed = title.trim()
  return (
    <Sheet open={!!video} onClose={onClose} title={status === 'REJECTED' ? 'Edit and resubmit' : 'Edit video'}>
      {status === 'APPROVED' && (
        <Banner tone="warning">Editing sends this video back for review. Employers will not see it until it is approved again.</Banner>
      )}
      {status === 'REJECTED' && (
        <Banner tone="danger" title="Not published">
          {video?.rejectionReason || 'This video was not approved.'}
        </Banner>
      )}
      <Field label="Title" helper={`Optional. Employers see the title. ${title.length} / ${TITLE_MAX}`}>
        <Input
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
          placeholder={video ? kindLabel(kind) : undefined}
          accessibilityLabel="Video title"
          editable={!busy}
        />
      </Field>
      <View style={styles.kinds}>
        {KINDS.map((k) => (
          <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => !busy && setKind(k.value)} />
        ))}
      </View>
      {!!error && <Banner tone="danger">{error}</Banner>}
      <View style={styles.sheetButtons}>
        <Button
          variant="primary"
          size="block"
          full
          busy={busy}
          label={status === 'REJECTED' ? 'Edit and resubmit' : 'Save'}
          onPress={() => onSave(trimmed === '' ? null : trimmed, kind)}
        />
        <Button variant="quiet" size="block" full label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  )
}

/* ─────────────────────────── play ─────────────────────────── */

/**
 * Plays one of the student's own clips over the screen, on the ink ground footage always gets. The address is
 * signed for about fifteen minutes, so when the player errors the list is asked again ONCE for a fresh one and
 * playback resumes where it stopped; a second error says so, with a Try again the student presses.
 */
function SelfVideoPlayer({
  video, onClose, onRenew,
}: { video: SelfVideo | null; onClose: () => void; onRenew: () => Promise<string | null> }) {
  const insets = useSafeAreaInsets()
  const player = useRef<VideoRef>(null)
  const at = useRef(0)
  const resumeAt = useRef(0)
  const renewed = useRef(false)
  const [note, setNote] = useState<string | null>(null)

  const renew = () => {
    resumeAt.current = at.current
    setNote(null)
    void onRenew().then((next) => { if (!next) setNote(COULD_NOT_PLAY) }, () => setNote(COULD_NOT_PLAY))
  }

  return (
    <Modal visible={!!video} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.stage, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.stageHead}>
          <View style={styles.stageTitle}>
            <Text style={[text.uiLeadSemi, styles.onInk]} numberOfLines={1}>{video ? nameOf(video) : ''}</Text>
            <Text style={[text.metaSm, styles.onInkMuted]}>SELF-RECORDED · NOT VERIFIED</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: opacity.pressed }]}>
            <Icon name="x" size={spaceHalf['4.5']} tint={color.textOnInk} weight={2} />
          </Pressable>
        </View>
        <View style={styles.stageVideo}>
          {video?.url ? (
            <Video
              ref={player}
              source={{ uri: video.url }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              controls
              progressUpdateInterval={500}
              onProgress={(p) => { at.current = p.currentTime }}
              onLoad={() => {
                // The address that just loaded works: a LATER lapse is its own lapse and gets its own renewal.
                renewed.current = false
                setNote(null)
                if (resumeAt.current > 0) {
                  player.current?.seek(resumeAt.current)
                  resumeAt.current = 0
                }
              }}
              onError={() => {
                if (renewed.current) { setNote(COULD_NOT_PLAY); return }
                renewed.current = true
                renew()
              }}
            />
          ) : (
            !!video && <Text style={[text.uiMd, styles.onInkMuted, styles.centered]}>This video cannot be played right now.</Text>
          )}
        </View>
        {!!note && (
          <View style={styles.stageNote}>
            <Body size="sm" tone="inverse">{note}</Body>
            <Button variant="outline" size="sm" label="Try again" onPress={renew} />
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: spaceHalf['2.5'] },
  head: { gap: space.xs, paddingHorizontal: space.xs, paddingBottom: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  centered: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'], paddingHorizontal: space.lg, paddingVertical: space.md },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  rowText: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  videoCard: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  emptyCard: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.xs },
  // A play mark on the thumb, so a clip that can be watched reads as one; a clip with no address gets none.
  playHole: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    width: height.avatar,
    height: height.avatar,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: space['2xs'],
  },
  addCard: { padding: space.lg, gap: space.md, borderStyle: 'dashed', borderColor: color.borderStrong },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  progress: { gap: space.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  pct: { color: color.text },
  sheetButtons: { marginTop: space.sm, gap: space.sm },

  stage: { flex: 1, backgroundColor: color.inkDeep, paddingHorizontal: space.md, gap: space.md },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stageTitle: { flex: 1, minWidth: 0, gap: space['2xs'] },
  stageVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageNote: { padding: space.md, gap: space.sm, alignItems: 'flex-start', borderRadius: radius.md, backgroundColor: color.onInkGlass },
  close: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkHairline, alignItems: 'center', justifyContent: 'center' },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
})
