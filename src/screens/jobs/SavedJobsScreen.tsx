import React from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSaved, removeSaved, type SavedRow } from '../../lib/api/jobs'
import { deadlineLine, employmentLabel, locationLine, salaryRange } from '../../lib/jobs/format'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Card, EmptyState, ErrorState, JobsHeader, Skeleton, StatusPill, text } from '../../components/ui'

/**
 * ST-38 — everything swiped right; where applying usually begins. Deadline on
 * every row, Apply (while open) and Remove; a closed saved post keeps its row
 * and Remove, only Apply goes.
 */
export function SavedJobsScreen({ onOpen, onApply, onFeed, onApplied }: {
  onBack?: () => void; onOpen: (jobId: string) => void; onApply: (jobId: string) => void; onFeed: () => void; onApplied?: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['saved'], queryFn: () => getSaved() })
  const remove = useMutation({ mutationFn: (rowId: string) => removeSaved(rowId), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) })

  const frame = (c: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <JobsHeader active="Saved" onFeed={onFeed} onApplied={onApplied} />
      {c}
    </View>
  )
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your saved jobs." body="Nothing was changed. Pull down to try again." /></View>)

  const rows = q.data!.rows
  if (rows.length === 0) return frame(
    <View style={styles.centre}>
      <EmptyState
        title="Nothing saved yet."
        body="Swipe right on the feed to keep a job here. Applying starts from this list."
        action={<Button variant="primary" size="md" label="Open the feed" onPress={onFeed} />}
      />
    </View>,
  )

  const renderRow = ({ item: r }: { item: SavedRow }) => {
    const salary = salaryRange(r.salary)
    const deadline = deadlineLine(r.applicationDeadline)
    const applied = r.applicationStatus != null
    const meta = [locationLine(r.location, r.remote), employmentLabel(r.employmentType), salary, deadline].filter(Boolean).join('  ·  ').toUpperCase()
    return (
      <Card key={r.id} style={[styles.cardInner, !r.open && !applied && styles.closed]}>
        <Pressable onPress={() => onOpen(r.jobId)} style={styles.cardTop}>
          <View style={styles.cardTitle}>
            <Text style={text.uiLgSemi}>{r.title}</Text>
            <Text style={[text.uiSm, styles.muted]}>{r.company.name}</Text>
          </View>
          {applied ? <StatusPill tone="neutral" label="Applied" /> : !r.open ? <StatusPill tone="neutral" label="Closed" /> : null}
        </Pressable>
        <Text style={[text.metaMd, styles.meta]}>{meta}</Text>
        <View style={styles.rowFoot}>
          <Pressable accessibilityRole="button" onPress={() => remove.mutate(r.id)} style={styles.remove}>
            <Text style={[text.uiSmSemi, styles.muted]}>Remove</Text>
          </Pressable>
          {applied ? null : (
            <View style={styles.grow}>
              {/* Ink, not accent: every open row can show Apply at once, and the accent is the one action on a screen. */}
              <Button
                variant="secondary"
                size="sm"
                full
                label="Apply"
                disabled={!r.open}
                reason={r.open ? undefined : 'Applications for this job have closed.'}
                onPress={() => onApply(r.jobId)}
              />
            </View>
          )}
        </View>
      </Card>
    )
  }

  return frame(
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      renderItem={renderRow}
      contentContainerStyle={styles.body}
      ItemSeparatorComponent={Gap}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
    />,
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  gap: { height: spaceHalf['2.5'] },
  cardInner: { paddingHorizontal: space.lg, paddingVertical: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  closed: { opacity: opacity.disabled },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spaceHalf['2.5'] },
  cardTitle: { flex: 1, gap: space['2xs'] + 1 },
  muted: { color: color.textMuted },
  meta: { color: color.textSubtle, letterSpacing: trackingNative.meta },
  grow: { flex: 1 },
  rowFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  remove: { height: height['control-xs'], paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
})
