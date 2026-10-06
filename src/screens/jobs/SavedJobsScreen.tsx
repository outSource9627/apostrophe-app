import React, { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSaved, removeSaved, type SavedRow } from '../../lib/api/jobs'
import { deadlineLine, employmentLabel, locationLine, salaryRange } from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF, fontSize, opacity, radius } from '../../theme'
import { Icon } from '../../components/ui/Icon'
import { Btn, ConfirmSheet, JobsTabs, Skel, StateBlock } from '../../components/tab/kit'

/**
 * ST-38 — everything swiped right; where applying usually begins, as the
 * refined mockup draws it (docs/saved-applications-video-final.html): a logo
 * tile, one place line, pay in bold, a deadline chip, one big Apply and a small
 * remove. A closed saved post keeps its row (dimmed, its button says Closed);
 * an applied one says Applied. Apply is solid ink — every open row can show it.
 */
const PALETTE = [color.accent, color.successFill, '#E0366B', '#2F6BFF', '#C77D00', color.accentDeep]
const DAY = 86_400_000
// The API types the name as always present, but a row can arrive without one.
const initialsOf = (name?: string | null) => (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

export function SavedJobsScreen({ onOpen, onApply, onFeed, onApplied }: {
  onBack?: () => void; onOpen: (jobId: string) => void; onApply: (jobId: string) => void; onFeed: () => void; onApplied?: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['saved'], queryFn: () => getSaved() })
  // The ✕ asks first; the sheet's Remove does it.
  const [removing, setRemoving] = useState<SavedRow | null>(null)
  const remove = useMutation({
    mutationFn: (rowId: string) => removeSaved(rowId),
    onSuccess: () => { setRemoving(null); return qc.invalidateQueries({ queryKey: ['saved'] }) },
  })
  const now = Date.now()

  const tabs = (count?: number) => <JobsTabs active="Saved" counts={{ Saved: count }} onFeed={onFeed} onApplied={onApplied} />
  const frame = (c: React.ReactNode, count?: number) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {tabs(count)}
      {c}
    </View>
  )
  if (q.isPending) {
    return frame(
      <View style={styles.body}>
        {[0, 1, 2].map((i) => <Skel key={i} w="100%" h={150} />)}
      </View>,
    )
  }
  if (q.isError) {
    return frame(<StateBlock icon="alert" title="Could not load your saved jobs." body="Nothing was changed. Pull down to try again." action="Try again" onAction={() => { void q.refetch() }} />)
  }

  const rows = q.data!.rows
  if (rows.length === 0) {
    return frame(
      <StateBlock icon="heart" title="Nothing saved yet." body="Swipe right on the feed to keep a job here. Applying starts from this list." action="Open the feed" onAction={onFeed} />,
      0,
    )
  }

  const renderRow = ({ item: r, index }: { item: SavedRow; index: number }) => {
    const salary = salaryRange(r.salary)
    const deadline = deadlineLine(r.applicationDeadline)
    const applied = r.applicationStatus != null
    const closed = !r.open && !applied
    const closesAt = r.applicationDeadline ? new Date(r.applicationDeadline).getTime() : null
    const soon = !closed && closesAt != null && closesAt > now && closesAt - now <= 7 * DAY
    const where = [r.company?.name, locationLine(r.location, r.remote), employmentLabel(r.employmentType)].filter(Boolean).join(' · ')
    return (
      <View style={[styles.card, closed && styles.cardClosed]}>
        <Pressable accessibilityRole="button" onPress={() => onOpen(r.jobId)} style={styles.top}>
          <View style={[styles.logo, { backgroundColor: closed ? color.textSubtle : PALETTE[index % PALETTE.length] }]}>
            <Text style={styles.logoText}>{initialsOf(r.company?.name)}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={[styles.title, closed && styles.muted]}>{r.title}</Text>
            {r.hasVideo && <View style={styles.videoTag}><Icon name="play" size={11} tint={color.accent} fill={color.accent} /><Text style={styles.videoTagText}>Video</Text></View>}
            <Text style={styles.where} numberOfLines={2}>{where}</Text>
          </View>
        </Pressable>

        <View style={styles.payRow}>
          <Text style={[styles.pay, closed && styles.muted]}>{salary ?? ' '}</Text>
          {!!deadline && (
            <View style={[styles.chip, soon && styles.chipSoon]}>
              <Text style={[styles.chipText, soon && styles.chipTextSoon]}>{deadline}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove from saved"
            disabled={remove.isPending}
            onPress={() => { remove.reset(); setRemoving(r) }}
            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          >
            <Icon name="x" size={20} tint={color.textMuted} />
          </Pressable>
          {applied ? (
            <View style={styles.appliedPill}><Text style={styles.appliedText}>Applied</Text></View>
          ) : (
            <Btn variant="ink" disabled={!r.open} label={r.open ? 'Apply' : 'Closed'} onPress={() => onApply(r.jobId)} style={styles.grow} />
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={renderRow}
        ListHeaderComponent={tabs(rows.length)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      />
      <ConfirmSheet
        open={!!removing}
        title="Remove from saved?"
        body={removing ? `${removing.title}${removing.company?.name ? ` · ${removing.company.name}` : ''} comes off this list.` : undefined}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        busy={remove.isPending}
        error={remove.isError ? 'It was not removed. Try again.' : null}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onClose={() => setRemoving(null)}
      />
    </View>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  list: { paddingBottom: 130 },
  gap: { height: 10 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  card: {
    marginHorizontal: 20, padding: 16, gap: 14, borderRadius: 20,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  cardClosed: { backgroundColor: color.surfaceMuted, borderColor: 'transparent' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: FF.bodyBold, fontSize: 17, color: color.textInverse },
  title: { fontFamily: FF.bodyBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.45, color: color.text },
  muted: { color: color.textMuted },
  videoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: color.accentSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8,
  },
  videoTagText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.accent },
  where: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted, marginTop: 3 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pay: { flex: 1, fontFamily: FF.bodyBold, fontSize: 16, letterSpacing: -0.16, color: color.text },
  chip: { backgroundColor: color.surfaceMuted, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  chipSoon: { backgroundColor: color.warningSoft },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 13, color: color.textMuted },
  chipTextSoon: { color: color.warning },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  removeBtn: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.border,
  },
  appliedPill: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceMuted },
  appliedText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },
})
