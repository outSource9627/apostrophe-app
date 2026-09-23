import React from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { color, space, height, borderWidth } from '../theme'
import {
  Body,
  Button,
  Card,
  Display,
  ErrorState,
  Eyebrow,
  FileField,
  ObjectRow,
  StatusPill,
  Toggle,
  VerifiedSeal,
  VideoThumb,
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
interface Config { limits: { selfVideoMaxCount: number; selfVideoMaxSeconds: number } }

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
export function VideosScreen({ onRecord }: { onRecord: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const videos = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.get<{ videos: SelfVideo[] }>('/students/me/videos'),
  })
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/students/me/profile'),
  })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  const setVisibility = useMutation({
    mutationFn: (hiddenFromFeed: boolean) =>
      api.patch('/students/me/profile', { hiddenFromFeed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/students/me/videos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  })

  if (videos.isPending || profile.isPending || config.isPending) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.textSubtle} />
      </View>
    )
  }

  if (videos.isError || profile.isError || config.isError) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
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
      </View>
    )
  }

  const list = videos.data?.videos ?? []
  const max = config.data?.limits.selfVideoMaxCount ?? 3
  const seconds = config.data?.limits.selfVideoMaxSeconds ?? 90
  const visible = !profile.data?.hiddenFromFeed

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>YOUR OWN RECORDINGS · {list.length} OF {max}</Eyebrow>
        <Display style={styles.headline}>Say a bit more.</Display>
        <Body size="sm" tone="muted" style={styles.lede}>
          {seconds} seconds each. Marked as self-recorded — your verified interview still leads.
        </Body>

        <View style={styles.list}>
          <Card>
            <ObjectRow
              last
              thumb={<VideoThumb verified />}
              title="Your interview"
              meta="Leads your card"
              status={<VerifiedSeal label="Verified interview" />}
            />
          </Card>

          {list.map((v) => {
            const mark = STATUS[v.status]
            return (
              <Card key={v.id}>
                <ObjectRow
                  last
                  thumb={<VideoThumb verified={false} />}
                  title={v.title ?? v.kind}
                  meta={v.durationSec ? `${v.durationSec}s` : undefined}
                  status={<StatusPill tone={mark.tone} label={mark.label} />}
                />
                <View style={styles.cardFoot}>
                  {v.status === 'REJECTED' && !!v.rejectionReason && (
                    <Body size="xs" tone="danger">{v.rejectionReason}</Body>
                  )}
                  <View style={styles.deleteRow}>
                    <Button variant="destructive" size="sm" label="Delete" onPress={() => remove.mutate(v.id)} />
                  </View>
                </View>
              </Card>
            )
          })}

          {list.length < max && (
            <FileField
              filename={max - list.length === 1 ? 'One slot left' : `${max - list.length} slots left`}
              detail="Record now, or pick a file"
              onPress={onRecord}
            />
          )}
        </View>

        {/* SP-12 / SP-13 */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Body size="md" weight="medium">Appear in employer searches</Body>
            <Body size="xs" tone="muted" style={styles.toggleBody}>Nothing is deleted when this is off.</Body>
          </View>
          <Toggle on={visible} onChange={(next) => setVisibility.mutate(!next)} label="Appear in employer searches" />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.sm },
  headline: { marginTop: space.md },
  lede: { marginTop: space.sm },
  list: { marginTop: space.xl, gap: space.md },
  cardFoot: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
  deleteRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg,
    marginTop: space.xl, paddingTop: space.lg, borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },
  toggleText: { flex: 1 },
  toggleBody: { marginTop: space.xs },
})
