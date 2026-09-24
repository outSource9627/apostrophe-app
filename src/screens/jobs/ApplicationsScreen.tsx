import React from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { getApplications, type ApplicationRow } from '../../lib/api/jobs'
import { applicationMark, dateLine, employmentLabel, locationLine } from '../../lib/jobs/format'
import { color, space, spaceHalf, radius } from '../../theme'
import { Body, Button, Card, EmptyState, ErrorState, Eyebrow, JobsHeader, PipelineDots, Skeleton, StatusPill, text } from '../../components/ui'

/**
 * ST-40 — the employer-driven pipeline. It scans in a glance and shows NO
 * control implying the student can move a stage — they only read it. Rejection
 * is muted grey with the verbatim reason; a CONNECTED row opens the chat.
 */
export function ApplicationsScreen({ onFeed, onChat, onSaved }: {
  onBack?: () => void; onFeed: () => void; onChat: (connectionId: string) => void; onSaved?: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['applications'], queryFn: () => getApplications() })

  const frame = (c: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <JobsHeader active="Applied" onFeed={onFeed} onSaved={onSaved} />
      {c}
    </View>
  )
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your applications." body="Nothing was changed. Pull down to try again." /></View>)

  const rows = q.data!.rows
  if (rows.length === 0) return frame(
    <View style={styles.centre}>
      <EmptyState
        title="No applications yet."
        body="Applications you send land here, and you will see every move an employer makes."
        action={<Button variant="primary" size="md" label="Find a job" onPress={onFeed} />}
      />
    </View>,
  )

  const renderRow = ({ item: r }: { item: ApplicationRow }) => {
    const mark = applicationMark(r.status)
    const reached = r.status === 'REJECTED' ? 0 : PIPELINE.indexOf(r.status) + 1
    return (
      <Card key={r.id} style={styles.cardInner}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitle}>
            <Text style={text.uiLgSemi}>{r.title}</Text>
            <Text style={[text.uiSm, styles.muted]}>{r.company.name}</Text>
          </View>
          <StatusPill tone={mark.tone} label={mark.label} />
        </View>
        {r.status !== 'REJECTED' && <PipelineDots steps={PIPELINE.length} reached={reached} />}
        <Text style={[text.uiXs, styles.muted]}>
          {`${locationLine(r.location, r.remote)} · ${employmentLabel(r.employmentType)} · Applied ${dateLine(r.appliedAt)}`}
        </Text>
        {r.status === 'REJECTED' && r.rejectionReason ? (
          <View style={styles.note}><Eyebrow>Their note</Eyebrow><Body size="sm" style={styles.noteBody}>{r.rejectionReason}</Body></View>
        ) : null}
        {r.status === 'CONNECTED' && r.connectionId ? (
          // Ink, not accent: every CONNECTED row can show this button at once, and the accent is the one action on a screen.
          <View style={styles.connFoot}><Button variant="secondary" size="sm" label="Open chat" onPress={() => onChat(r.connectionId!)} /></View>
        ) : null}
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

/** The employer-driven ladder a live application climbs; a rejection is an ending, not a rung. */
const PIPELINE: ApplicationRow['status'][] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'CONNECTED']

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  gap: { height: spaceHalf['2.5'] },
  cardInner: { paddingHorizontal: space.lg, paddingVertical: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spaceHalf['2.5'] },
  cardTitle: { flex: 1, gap: space['2xs'] + 1 },
  muted: { color: color.textMuted },
  note: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, padding: space.md },
  noteBody: { marginTop: space.xs },
  connFoot: { flexDirection: 'row', justifyContent: 'flex-end' },
})
