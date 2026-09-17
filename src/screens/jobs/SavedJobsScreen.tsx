import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSaved, removeSaved, type SavedRow } from '../../lib/api/jobs'
import { deadlineLine, employmentLabel, locationLine, salaryRange } from '../../lib/jobs/format'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Meta, StatusPill } from '../../components/ui'

/**
 * ST-38 — everything swiped right; where applying usually begins. Deadline on
 * every row, Apply (while open) and Remove; a closed saved post keeps its row
 * and Remove, only Apply goes.
 */
export function SavedJobsScreen({ onBack, onOpen, onApply, onFeed }: {
  onBack: () => void; onOpen: (jobId: string) => void; onApply: (jobId: string) => void; onFeed: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['saved'], queryFn: () => getSaved() })
  const remove = useMutation({ mutationFn: (rowId: string) => removeSaved(rowId), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) })

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Jobs" onBack={onBack} />{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your saved jobs.</Body></View>)

  const rows = q.data!.rows
  if (rows.length === 0) return frame(
    <View style={styles.empty}>
      <Display level="sm">Nothing saved yet.</Display>
      <Body size="sm" tone="muted" style={{ marginTop: space.sm, textAlign: 'center' }}>Swipe right on the feed to keep a job here. Applying starts from this list.</Body>
      <View style={{ marginTop: space.lg }}><Button variant="primary" size="md" label="Open the feed" onPress={onFeed} /></View>
    </View>,
  )

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Jobs" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Saved jobs</Display>
        {rows.map((r: SavedRow) => {
          const salary = salaryRange(r.salary)
          const deadline = deadlineLine(r.applicationDeadline)
          const applied = r.applicationStatus != null
          return (
            <View key={r.id} style={styles.card}>
              <Pressable onPress={() => onOpen(r.jobId)} style={{ gap: space.xs }}>
                <Display level="sm">{r.title}</Display>
                <Body size="sm" tone="muted">{r.company.name}</Body>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 2 }}>
                  <Meta style={{ color: color.textMuted }}>{locationLine(r.location, r.remote).toUpperCase()}</Meta>
                  <Meta style={{ color: color.textMuted }}>{employmentLabel(r.employmentType).toUpperCase()}</Meta>
                  {salary ? <Meta style={{ color: color.textMuted }}>{salary}</Meta> : null}
                  {deadline ? <Meta style={{ color: r.open ? color.textMuted : color.textSubtle }}>{deadline.toUpperCase()}</Meta> : null}
                </View>
              </Pressable>
              <View style={styles.rowFoot}>
                <Pressable onPress={() => remove.mutate(r.id)}><Body size="sm" tone="muted">Remove</Body></Pressable>
                {applied ? <StatusPill tone="neutral" label="Applied" />
                  : r.open ? <Button variant="primary" size="md" label="Apply" onPress={() => onApply(r.jobId)} />
                  : <Meta style={{ color: color.textSubtle }}>CLOSED</Meta>}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  body: { padding: space.xl, gap: space.md, paddingBottom: space['4xl'] },
  card: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg, gap: space.md },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.md },
})
