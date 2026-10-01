import React, { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
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
import { color, fontFamilyNative as FF, height, opacity, radius, space, spaceHalf } from '../theme'
import { Btn, DetailHeader, GroupLabel, Panel, Skel, StateBlock } from '../components/tab/kit'
import {
  Banner,
  Body,
  Button,
  Chip,
  Field,
  FilmThumb,
  Input,
  ProgressBar,
  Sheet,
  StatusPill,
  Toggle,
  UnverifiedMark,
  VerifiedSeal,
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

const noop = () => {}

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
  const [adding, setAdding] = useState(false)
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
      <DetailHeader title="Your videos" onBack={onBack ?? noop} />
      {child}
    </View>
  )

  if (videos.isPending || profile.isPending || config.isPending) {
    return frame(
      <View style={styles.loading}>
        <Skel w="100%" h={70} />
        <Skel w="100%" h={150} />
        <Skel w="100%" h={150} />
        <Skel w="100%" h={90} />
      </View>,
    )
  }

  if (videos.isError || profile.isError || config.isError) {
    return frame(
      <StateBlock
        icon="alert"
        title="Could not load your videos."
        body="Check your connection and try again."
        action="Try again"
        onAction={() => {
          videos.refetch()
          profile.refetch()
          config.refetch()
        }}
      />,
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
  const left = max - list.length
  const slotsText = left === 1 ? 'One slot left' : `${left} slots left`
  const intro = `Up to ${seconds} seconds each. Marked as not verified. Your interview film is watched first.`

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
      setAdding(false)
    } catch (e) {
      if (!(e instanceof Error && e.message === UPLOAD_CANCELLED)) setError(uploadErrorText(e))
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  const openAdd = () => { setError(null); setAdding(true) }
  const closeAdd = () => { if (!uploading) { setAdding(false); setError(null) } }

  const filmCard = (
    <Panel style={styles.row}>
      <FilmThumb status={filmStatus ?? 'NONE'} width={40} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Your interview</Text>
        <Text style={styles.xs}>
          {live
            ? 'Leads your profile'
            : published
              ? film.data?.held ? 'Held back until your top-up is settled' : 'Not live on your profile yet'
              : 'Filmed at your interview'}
        </Text>
      </View>
      {published ? <VerifiedSeal label="Verified" /> : <StatusPill tone="neutral" label="Not yet" />}
    </Panel>
  )

  const visibility = (
    <Panel style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Appear in employer searches</Text>
        <Text style={styles.xs}>Nothing is deleted when this is off.</Text>
      </View>
      <Toggle on={visible} tone="success" onChange={(next) => setVisibility.mutate(!next)} label="Appear in employer searches" />
    </Panel>
  )

  const noticeBanner = !!notice && (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Banner tone="info">{notice}</Banner>
    </View>
  )

  const tiles: React.ReactNode[] = list.map((v, i) => (
    <SelfVideoTile
      key={v.id}
      video={v}
      index={i}
      onPlay={() => { setNotice(null); setPlayingId(v.id) }}
      onEdit={() => { setNotice(null); edit.reset(); setEditing(v) }}
      onRemove={() => { setNotice(null); remove.reset(); setRemoving(v) }}
    />
  ))
  if (left > 0) {
    tiles.push(
      <Pressable
        key="add"
        accessibilityRole="button"
        accessibilityLabel="Add a video"
        onPress={openAdd}
        style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
      >
        {uploading ? (
          <>
            <Text style={styles.addPct}>{Math.round((progress ?? 0) * 100)}%</Text>
            <Text style={styles.xs}>Uploading…</Text>
            <View style={styles.addBar}><ProgressBar pct={(progress ?? 0) * 100} tone="accent" thin /></View>
          </>
        ) : (
          <>
            <View style={styles.addDisc}><Icon name="plus" size={22} tint={color.accent} weight={1.9} /></View>
            <Text style={styles.addTitle}>{slotsText}</Text>
            <Text style={styles.xs}>Choose a video from your gallery</Text>
          </>
        )}
      </Pressable>,
    )
  }
  const pairs: React.ReactNode[][] = []
  for (let i = 0; i < tiles.length; i += 2) pairs.push(tiles.slice(i, i + 2))

  return frame(
    <>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {list.length === 0 ? (
          <>
            {noticeBanner}
            <StateBlock icon="video" title="No videos yet." body={intro} />
            {left > 0 && (
              <View style={styles.emptyAction}>
                <Btn label="Choose a video from your gallery" accessibilityLabel="Add a video" onPress={openAdd} />
              </View>
            )}
            <View style={styles.pad}>
              <View style={styles.afterEmpty}>{filmCard}</View>
              <View style={styles.visGap}>{visibility}</View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.head}>
              <Text style={styles.eyebrow}>YOUR OWN RECORDINGS · {list.length} OF {max}</Text>
              <Text style={styles.h1}>Say a bit more.</Text>
              <Text style={styles.sub}>{intro}</Text>
            </View>
            {noticeBanner}
            <View style={styles.pad}>
              <View style={styles.filmGap}>{filmCard}</View>
              <GroupLabel style={styles.group}>Your own recordings</GroupLabel>
              <View style={styles.grid}>
                {pairs.map((pair, i) => (
                  <View key={i} style={styles.gridRow}>
                    {pair}
                    {pair.length === 1 && <View style={styles.cell} />}
                  </View>
                ))}
              </View>
              {left <= 0 && (
                <Panel tone="muted" style={styles.cap}>
                  <Text style={styles.sub}>{`That is all ${max}. Delete one to add another.`}</Text>
                </Panel>
              )}
              <View style={styles.visGap}>{visibility}</View>
            </View>
          </>
        )}
      </ScrollView>

      <Sheet open={adding && left > 0} onClose={closeAdd}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Add a video</Text>
          {!uploading && (
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeAdd} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <Icon name="x" size={19} tint={color.textMuted} weight={1.9} />
            </Pressable>
          )}
        </View>
        <View>
          <Text style={styles.rowTitle}>{slotsText}</Text>
          <Text style={[styles.xs, styles.gap3]}>What is this one about?</Text>
        </View>
        <View style={styles.kinds}>
          {KINDS.map((k) => (
            <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => !uploading && setKind(k.value)} />
          ))}
        </View>
        {uploading ? (
          <View style={styles.progress}>
            <View style={styles.progressHead}>
              <Text style={styles.sub}>Uploading…</Text>
              <Text style={styles.pct}>{Math.round((progress ?? 0) * 100)}%</Text>
            </View>
            <ProgressBar pct={(progress ?? 0) * 100} tone="accent" thin />
            <Btn label="Cancel" variant="outline" style={styles.cancel} onPress={() => abort.current?.abort()} />
          </View>
        ) : (
          <Btn variant="outline" label="Choose a video from your gallery" style={styles.pick} onPress={addFromGallery} />
        )}
        {rule ? (
          <Text style={styles.rule}>{`${rule.label} · up to ${megabytes(rule.maxBytes)} · ${seconds} seconds`}</Text>
        ) : (
          <Text style={styles.rule}>{`Up to ${seconds} seconds. The file type and size are checked when you upload.`}</Text>
        )}
        {!!error && <Banner tone="danger">{error}</Banner>}
      </Sheet>

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
          <Btn
            variant="destructive"
            busy={remove.isPending}
            label="Remove"
            accessibilityLabel={removing ? `Remove ${nameOf(removing)}` : 'Remove'}
            onPress={() => removing && remove.mutate(removing.id)}
          />
          <Btn variant="quiet" label="Keep it" onPress={() => setRemoving(null)} />
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

// The poster's ground: three slate gradients, so neighbouring tiles read as different clips.
const POSTERS: readonly [string, string][] = [
  [color.textMuted, color.inkHover],
  [color.textSubtle, color.textSecondary],
  [color.inkHover, color.inkRaised],
]

function SelfVideoTile({
  video: v, index, onPlay, onEdit, onRemove,
}: { video: SelfVideo; index: number; onPlay: () => void; onEdit: () => void; onRemove: () => void }) {
  const mark = STATUS[v.status]
  const name = nameOf(v)
  const length = clock(v.durationSec)
  const [from, to] = POSTERS[index % POSTERS.length]
  const poster = (
    <View style={styles.poster}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`poster${index % POSTERS.length}`} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#poster${index % POSTERS.length})`} />
      </Svg>
      <View style={styles.posterMark}><UnverifiedMark /></View>
      {!!v.url && (
        <View pointerEvents="none" style={styles.playDisc}>
          <Icon name="tri" size={16} tint={color.ink} fill={color.ink} weight={1.5} />
        </View>
      )}
      {!!length && <View style={styles.len}><Text style={styles.lenText}>{length}</Text></View>}
    </View>
  )
  return (
    <View style={styles.cell}>
      {v.url ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${name}`}
          onPress={onPlay}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {poster}
        </Pressable>
      ) : poster}
      <View style={styles.tileText}>
        <Text style={styles.tileName}>{name}</Text>
        {!!v.title && <Text style={styles.xs}>{kindLabel(v.kind)}</Text>}
        <StatusPill tone={mark.tone} label={mark.label} />
        {v.status === 'PENDING' && !!v.editedAt && <Text style={styles.xs}>Edited · back in review</Text>}
        {v.status === 'PENDING' && <Text style={styles.xs}>We will tell you when it has been reviewed.</Text>}
        {v.status === 'APPROVED' && <Text style={styles.xs}>Shown on your full profile to employers, marked not verified.</Text>}
        {v.status === 'REJECTED' && !!v.rejectionReason && <Text style={styles.reason}>{v.rejectionReason}</Text>}
      </View>
      <View style={styles.tileActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}, ${kindLabel(v.kind)}`}
          onPress={onEdit}
          style={({ pressed }) => [styles.tileBtn, styles.tileBtnOut, pressed && styles.pressed]}
        >
          <Icon name="edit" size={17} tint={color.text} weight={1.9} />
          <Text style={styles.tileBtnText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${name}, ${kindLabel(v.kind)}`}
          onPress={onRemove}
          style={({ pressed }) => [styles.tileBtn, pressed && styles.pressed]}
        >
          <Icon name="trash" size={17} tint={color.danger} weight={1.9} />
          <Text style={[styles.tileBtnText, styles.tileBtnDanger]}>Delete</Text>
        </Pressable>
      </View>
    </View>
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
        <Btn
          variant="primary"
          busy={busy}
          label={status === 'REJECTED' ? 'Edit and resubmit' : 'Save'}
          onPress={() => onSave(trimmed === '' ? null : trimmed, kind)}
        />
        <Btn variant="quiet" label="Cancel" onPress={onClose} />
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
  pressed: { opacity: opacity.pressed },
  loading: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  scroll: { paddingTop: 0 },
  pad: { paddingHorizontal: 20 },
  head: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14, gap: 6 },
  eyebrow: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, textTransform: 'uppercase', color: color.textMuted },
  h1: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  xs: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.textMuted },
  reason: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.danger },
  gap3: { marginTop: 3 },
  notice: { paddingHorizontal: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 3, alignItems: 'flex-start' },
  rowTitle: { fontFamily: FF.bodyBold, fontSize: 16, color: color.text },
  filmGap: { marginBottom: 18 },
  afterEmpty: { marginTop: 28 },
  visGap: { marginTop: 18 },
  emptyAction: { alignItems: 'center', paddingTop: 20 },
  group: { paddingHorizontal: 4, paddingBottom: 8 },
  grid: { gap: 14 },
  gridRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cell: { flex: 1, gap: 8 },
  cap: { marginTop: 14 },
  // The 9:16 poster of a self-recorded clip: a dashed frame, never the solid one the verified film has.
  poster: {
    width: '100%', aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.borderStrong,
  },
  posterMark: { position: 'absolute', left: 6, top: 6 },
  playDisc: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center', paddingLeft: 2,
  },
  len: { position: 'absolute', right: 6, bottom: 6, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(11,15,26,0.7)' },
  lenText: { fontFamily: FF.monoMedium, fontSize: 10, color: color.textInverse },
  tileText: { gap: 5, alignItems: 'flex-start' },
  tileName: { fontFamily: FF.bodyBold, fontSize: 15.5, lineHeight: 19, letterSpacing: -0.155, color: color.text },
  tileActions: { flexDirection: 'row', gap: 6 },
  tileBtn: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tileBtnOut: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.borderStrong },
  tileBtnText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.text },
  tileBtnDanger: { color: color.danger },
  addTile: {
    aspectRatio: 9 / 16, flex: 1, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.borderStrong,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
  },
  addDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontFamily: FF.bodyBold, fontSize: 15, lineHeight: 19, color: color.text, textAlign: 'center' },
  addPct: { fontFamily: FF.monoMedium, fontSize: 20, color: color.text },
  addBar: { width: '80%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { flex: 1, fontFamily: FF.bodyBold, fontSize: 21, letterSpacing: -0.63, color: color.text },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progress: { gap: 10 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pct: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, color: color.text },
  cancel: { alignSelf: 'flex-start', height: 40, borderRadius: 12, paddingHorizontal: 14 },
  pick: { height: 52 },
  rule: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.textSubtle },
  sheetButtons: { marginTop: space.sm, gap: 8 },
  centered: { textAlign: 'center' },

  stage: { flex: 1, backgroundColor: color.inkDeep, paddingHorizontal: space.md, gap: space.md },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stageTitle: { flex: 1, minWidth: 0, gap: space['2xs'] },
  stageVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageNote: { padding: space.md, gap: space.sm, alignItems: 'flex-start', borderRadius: radius.md, backgroundColor: color.onInkGlass },
  close: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkHairline, alignItems: 'center', justifyContent: 'center' },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
})
