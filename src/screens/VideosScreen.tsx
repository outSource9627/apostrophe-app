import React, { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getVideoResume } from '../lib/api/student'
import { megabytes, pickVideo, uploadErrorText, uploadMedia, UPLOAD_CANCELLED, type PickedMedia } from '../lib/api/uploads'
import { color, space, spaceHalf, height, trackingNative } from '../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Chip,
  ErrorState,
  FilmThumb,
  ProgressBar,
  ScreenHeader,
  Skeleton,
  StatusPill,
  Toggle,
  VerifiedSeal,
  VideoThumb,
  text,
} from '../components/ui'
import type { Tone } from '../components/ui'

interface SelfVideo {
  id: string
  slot: number
  kind: string
  title: string | null
  durationSec: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}
interface Profile { hiddenFromFeed: boolean }
interface Config {
  limits: { selfVideoMaxCount: number; selfVideoMaxSeconds: number }
  uploads?: Record<string, { contentTypes: string[]; maxBytes: number; label: string }>
}

const STATUS: Record<SelfVideo['status'], { label: string; tone: Tone }> = {
  APPROVED: { label: 'Live on your profile', tone: 'success' },
  PENDING: { label: 'Waiting for review', tone: 'warning' },
  REJECTED: { label: 'Not published', tone: 'danger' },
}

/**
 * SP-03/SP-04 — the student's own short videos, and SP-12/SP-13 feed visibility.
 *
 * A list rather than a grid: on a phone each clip gets a full row and a real tap
 * target. The verified interview is set apart at the top because SP-05 means it
 * always leads — these sit behind it, marked as self-recorded.
 */
const KINDS = [
  { value: 'INTRO', label: 'Introduction' },
  { value: 'PROJECT', label: 'A project' },
  { value: 'SKILL', label: 'A skill' },
] as const
type Kind = (typeof KINDS)[number]['value']

export function VideosScreen({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind>('INTRO')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const videos = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.get<{ videos: SelfVideo[] }>('/students/me/videos'),
  })
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
    mutationFn: (id: string) => api.del(`/students/me/videos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  })

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
  const published = film.data?.status === 'PUBLISHED'
  const uploading = progress !== null

  async function addFromGallery() {
    setError(null)
    let picked: PickedMedia | null
    try { picked = await pickVideo() } catch (e) { setError(uploadErrorText(e)); return }
    if (!picked) return
    if (rule && !rule.contentTypes.includes(picked.type)) { setError(`Choose ${rule.label}.`); return }
    if (rule && picked.size > rule.maxBytes) {
      setError(`That video is ${megabytes(picked.size)}. The limit is ${megabytes(rule.maxBytes)}.`)
      return
    }
    if (picked.durationSec > seconds) {
      setError(`That video is ${Math.round(picked.durationSec)} seconds. Keep it under ${seconds}.`)
      return
    }
    const ctl = new AbortController()
    abort.current = ctl
    try {
      setProgress(0)
      const key = await uploadMedia('SELF_VIDEO', picked, { onProgress: setProgress, signal: ctl.signal })
      await api.post('/students/me/videos', { kind, key, durationSec: Math.round(picked.durationSec) || 1, sizeBytes: picked.size })
      await qc.invalidateQueries({ queryKey: ['videos'] })
    } catch (e) {
      if (!(e instanceof Error && e.message === UPLOAD_CANCELLED)) setError(uploadErrorText(e))
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  return frame(
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={[text.metaMd, styles.eyebrow]}>YOUR OWN RECORDINGS · {list.length} OF {max}</Text>
        <Text style={text.displayMd}>Say a bit more.</Text>
        <Text style={[text.uiMd, styles.muted]}>
          Up to {seconds} seconds each. Marked as self-recorded — your verified interview still leads.
        </Text>
      </View>

      <Card style={styles.row}>
        <FilmThumb />
        <View style={styles.rowText}>
          <Text style={text.uiBaseSemi}>Your interview</Text>
          <Text style={[text.uiXs, styles.muted]}>{published ? 'Leads your card' : 'Filmed at your interview'}</Text>
        </View>
        {published ? <VerifiedSeal label="Verified" /> : <StatusPill tone="neutral" label="Not yet" />}
      </Card>

      {list.map((v) => {
        const mark = STATUS[v.status]
        return (
          <Card key={v.id} style={styles.videoCard}>
            <View style={styles.rowInner}>
              <VideoThumb verified={false} />
              <View style={styles.rowText}>
                <Text style={text.uiBaseSemi}>{v.title ?? KINDS.find((k) => k.value === v.kind)?.label ?? v.kind}</Text>
                {!!v.durationSec && <Text style={[text.uiXs, styles.muted]}>{v.durationSec}s · self-recorded</Text>}
                <StatusPill tone={mark.tone} label={mark.label} />
              </View>
            </View>
            {v.status === 'REJECTED' && !!v.rejectionReason && <Body size="xs" tone="danger">{v.rejectionReason}</Body>}
            <Pressable accessibilityRole="button" onPress={() => remove.mutate(v.id)} style={styles.delete}>
              <Text style={[text.uiSmSemi, styles.deleteText]}>Delete</Text>
            </Pressable>
          </Card>
        )
      })}

      {list.length < max && (
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
          {!!rule && <Text style={[text.uiXs, styles.subtle]}>{`${rule.label} · up to ${megabytes(rule.maxBytes)} · ${seconds} seconds`}</Text>}
          {!!error && <Banner tone="danger">{error}</Banner>}
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
    </ScrollView>,
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'], paddingHorizontal: space.lg, paddingVertical: space.md },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  rowText: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  videoCard: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  delete: { alignSelf: 'flex-end', height: height.tap, justifyContent: 'center', paddingHorizontal: space.sm },
  deleteText: { color: color.danger },
  addCard: { padding: space.lg, gap: space.md, borderStyle: 'dashed', borderColor: color.borderStrong },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  progress: { gap: space.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  pct: { color: color.text },
})
