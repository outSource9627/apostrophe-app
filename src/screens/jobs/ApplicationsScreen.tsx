import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { getApplications, type ApplicationRow } from '../../lib/api/jobs'
import { applicationMark, dateLine, employmentLabel, locationLine } from '../../lib/jobs/format'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Button, Card, Display, Eyebrow, Meta, StatusPill } from '../../components/ui'

/**
 * ST-40 — the employer-driven pipeline. It scans in a glance and shows NO
 * control implying the student can move a stage — they only read it. Rejection
 * is muted grey with the verbatim reason; a CONNECTED row opens the chat.
 */
export function ApplicationsScreen({ onBack, onFeed, onChat }: {
  onBack: () => void; onFeed: () => void; onChat: (connectionId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['applications'], queryFn: () => getApplications() })

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Home" onBack={onBack} />{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your applications.</Body></View>)

  const rows = q.data!.rows
  if (rows.length === 0) return frame(
    <View style={styles.empty}>
      <Display level="sm">No applications yet.</Display>
      <Body size="sm" tone="muted" style={{ marginTop: space.sm, textAlign: 'center' }}>Applications you send land here, and you will see every move an employer makes.</Body>
      <View style={{ marginTop: space.lg }}><Button variant="primary" size="md" label="Find a job" onPress={onFeed} /></View>
    </View>,
  )

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Home" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">My applications</Display>
        {rows.map((r: ApplicationRow) => {
          const mark = applicationMark(r.status)
          return (
            <Card key={r.id} style={styles.cardInner}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md }}>
                <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                  <Display level="sm">{r.title}</Display>
                  <Body size="sm" tone="muted">{r.company.name}</Body>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space['2xs'] }}>
                    <Meta style={{ color: color.textMuted }}>{locationLine(r.location, r.remote).toUpperCase()}</Meta>
                    <Meta style={{ color: color.textMuted }}>{employmentLabel(r.employmentType).toUpperCase()}</Meta>
                    <Meta style={{ color: color.textSubtle }}>APPLIED {dateLine(r.appliedAt).toUpperCase()}</Meta>
                  </View>
                </View>
                <StatusPill tone={mark.tone} label={mark.label} />
              </View>
              {r.status === 'REJECTED' && r.rejectionReason ? (
                <View style={styles.note}><Eyebrow>Their note</Eyebrow><Body size="sm" style={{ marginTop: space.xs }}>{r.rejectionReason}</Body></View>
              ) : null}
              {r.status === 'CONNECTED' && r.connectionId ? (
                // `secondary` (ink), not `primary` (accent) — every CONNECTED row in this
                // list can show this button at once, and crimson is capped at one button
                // per screen. `primary` here would routinely put several red buttons on
                // screen together, which is exactly the violation the token forbids.
                <View style={styles.connFoot}><Button variant="secondary" size="md" label="Open chat" onPress={() => onChat(r.connectionId!)} /></View>
              ) : null}
            </Card>
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
  cardInner: { padding: space.lg, gap: space.md },
  note: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.md },
  connFoot: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.md },
})
