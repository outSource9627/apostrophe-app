import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actOnConnection, getConnections, threadIdForConnection,
  type ConnectionRow,
} from '../../lib/api/chat'
import { fmtDayMon, fmtDayMonthLong, originLabel } from '../../lib/chat/format'
import { color, height, space, spaceHalf, radius, borderWidth, trackingNative } from '../../theme'
import { AppBar, Body, Button, Card, Meta, StatusPill, Skeleton, text } from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { BlockSheet, CompanyMark } from './parts'

/**
 * ST-42 — Connections. Each row states its origin in mono (INTEREST | APPLICATION
 * — the only two doors). There is no server state machine: a blocked row offers
 * nothing, a withdrawn row offers only Read the chat and Block (never Withdraw).
 * Block is never one tap — it raises the consequences sheet. Open chat is the one
 * crimson action.
 */
export function ConnectionsScreen({ onBack, onChats, onOpenThread, onBrowseJobs, onInterests }: {
  onBack: () => void; onChats: () => void; onOpenThread: (threadId: string) => void
  onBrowseJobs: () => void; onInterests: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [blocking, setBlocking] = useState<ConnectionRow | null>(null)

  const q = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const [a, c, b] = await Promise.all([getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED')])
      return [...a.rows, ...c.rows, ...b.rows]
    },
  })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'WITHDRAW' | 'BLOCK' }) => actOnConnection(id, action),
    onSettled: () => { setBlocking(null); qc.invalidateQueries({ queryKey: ['connections'] }) },
  })

  async function openChat(connectionId: string) {
    const threadId = await threadIdForConnection(connectionId)
    if (threadId) onOpenThread(threadId)
    else onChats()
  }

  const bar = (
    <AppBar title="Connections" onBack={onBack}
      action={<Body size="sm" weight="medium" style={{ color: color.text }} onPress={onChats}>Chats</Body>} />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your connections.</Body></View>)

  const rows = q.data!
  const active = rows.filter((r) => r.status === 'ACTIVE')
  const archived = rows.filter((r) => r.status !== 'ACTIVE')
  const busy = act.isPending

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <EmptyConnections onInterests={onInterests} onBrowseJobs={onBrowseJobs} />
        ) : (
          <>
            {active.map((r) => (
              <ActiveCard key={r.id} row={r} busy={busy}
                onOpen={() => openChat(r.id)} onWithdraw={() => act.mutate({ id: r.id, action: 'WITHDRAW' })} onBlock={() => setBlocking(r)} />
            ))}
            {archived.length > 0 && (
              <Text style={[text.metaMd, styles.archHead]}>{`ARCHIVED · ${archived.length}`}</Text>
            )}
            {archived.map((r) => (
              <ArchivedCard key={r.id} row={r} busy={busy} onRead={() => openChat(r.id)} onBlock={() => setBlocking(r)} />
            ))}
          </>
        )}
      </ScrollView>

      <BlockSheet open={!!blocking} name={blocking?.counterparty.name ?? 'this company'} busy={busy}
        onConfirm={() => blocking && act.mutate({ id: blocking.id, action: 'BLOCK' })} onClose={() => setBlocking(null)} />
    </View>
  )
}

const PILL: Record<ConnectionRow['status'], { tone: Tone; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Accepted' },
  CLOSED: { tone: 'neutral', label: 'Withdrawn' },
  BLOCKED: { tone: 'danger', label: 'Blocked' },
}
const originDate = (r: ConnectionRow) => `${originLabel(r.origin)} · ${r.origin === 'INTEREST' ? 'accepted' : 'connected'} ${fmtDayMon(r.openedAt)}`

function Head({ row, muted }: { row: ConnectionRow; muted?: boolean }) {
  return (
    <View style={styles.head}>
      <CompanyMark name={row.counterparty.name} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
        <Text style={[text.uiLgSemi, muted && styles.mutedText]} numberOfLines={1}>{row.counterparty.name ?? 'A company'}</Text>
        <View style={styles.pillRow}>
          <StatusPill tone={PILL[row.status].tone} label={PILL[row.status].label} />
          <Meta style={{ color: color.textSubtle }}>{originDate(row)}</Meta>
        </View>
      </View>
    </View>
  )
}

function ActiveCard({ row, busy, onOpen, onWithdraw, onBlock }: {
  row: ConnectionRow; busy: boolean; onOpen: () => void; onWithdraw: () => void; onBlock: () => void
}) {
  return (
    <Card style={styles.card}>
      <Head row={row} />
      {/* Ink, not accent: several cards can show Open chat at once. */}
      <Button variant="secondary" size="md" full disabled={busy} label="Open chat" onPress={onOpen} />
      <View style={styles.quiet}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onWithdraw} style={styles.quietBtn}>
          <Text style={[text.uiSmSemi, styles.mutedText]}>Withdraw</Text>
        </Pressable>
        <Text style={[text.uiSm, styles.subtle]}>·</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onBlock} style={styles.quietBtn}>
          <Text style={[text.uiSmSemi, styles.dangerText]}>Block</Text>
        </Pressable>
      </View>
    </Card>
  )
}

function ArchivedCard({ row, busy, onRead, onBlock }: { row: ConnectionRow; busy: boolean; onRead: () => void; onBlock: () => void }) {
  const blocked = row.status === 'BLOCKED'
  const name = row.counterparty.name ?? 'This company'
  return (
    <Card style={[styles.card, styles.cardMuted]}>
      <Head row={row} muted />
      {blocked ? (
        <View style={styles.dangerWell}>
          <Body size="xs" style={{ color: color.text }}>{`Blocked on ${fmtDayMonthLong(row.closedAt ?? row.openedAt)}. ${name} will not see your profile in the feed again and cannot reach you. This cannot be undone from here.`}</Body>
        </View>
      ) : (
        <>
          <View style={styles.well}>
            <Body size="xs" tone="muted">{`Withdrawn on ${fmtDayMonthLong(row.closedAt ?? row.openedAt)}. Neither side can write again; the conversation stays here to read, and the row stays on this list.`}</Body>
          </View>
          <View style={styles.actions}>
            <Button variant="outline" size="md" full disabled={busy} label="Read the chat" onPress={onRead} />
            <Button variant="destructive" size="md" disabled={busy} label="Block" onPress={onBlock} />
          </View>
        </>
      )}
    </Card>
  )
}

function EmptyConnections({ onInterests, onBrowseJobs }: { onInterests: () => void; onBrowseJobs: () => void }) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={text.displayXs}>No connections yet.</Text>
      <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>One opens when you accept an Interest, or when you apply to an employer who had already shortlisted you. There is no third way in, and no way to follow anyone.</Body>
      <View style={[styles.actions, { marginTop: space.md }]}>
        <Button variant="secondary" size="md" full label="See your Interests" onPress={onInterests} />
        <Button variant="outline" size="md" full label="Browse jobs" onPress={onBrowseJobs} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: spaceHalf['2.5'], paddingBottom: space.xl },
  card: { padding: space.lg, gap: space.md },
  cardMuted: { backgroundColor: color.surfaceMuted },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  archHead: { color: color.textMuted, letterSpacing: trackingNative.eyebrow, marginTop: space.md, paddingHorizontal: space.xs },
  mutedText: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  dangerText: { color: color.danger },
  quiet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  quietBtn: { minHeight: height.tap, justifyContent: 'center', paddingHorizontal: space.sm },
  well: { borderRadius: radius.tile, backgroundColor: color.surfaceSunken, padding: space.md },
  dangerWell: { borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, backgroundColor: color.dangerSoft, padding: space.md },
  emptyCard: { padding: space.lg },
})
