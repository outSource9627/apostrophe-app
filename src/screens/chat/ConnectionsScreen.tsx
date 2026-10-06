import React, { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actOnConnection, getConnections, threadIdForConnection,
  type ConnectionRow,
} from '../../lib/api/chat'
import { fmtDayMon, fmtDayMonthLong, originLabel } from '../../lib/chat/format'
import { borderWidth, color, fontFamilyNative as FF, fontSize } from '../../theme'
import { PopoverMenu, StatusPill, measureAnchor, type MenuAnchor } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import type { Tone } from '../../components/ui/status'
import { Btn, ConfirmSheet, DetailHeader, GroupLabel, Panel, Skel, StateBlock, TextLink } from '../../components/tab/kit'
import { BlockSheet } from './parts'
import { LogoTile } from './LogoTile'

/**
 * ST-42 — Connections. Each row states its origin in a grey label (Interest | application
 * — the only two doors). There is no server state machine: a blocked row offers
 * nothing, a withdrawn row offers only Read the chat and Block (never Withdraw).
 * A live row keeps Withdraw and Block behind its ⋯, in a small popup; neither is
 * ever one tap — Withdraw asks first, Block raises the consequences sheet. Open
 * chat is solid ink — several cards can show it at once.
 */
export function ConnectionsScreen({ onBack, onChats, onOpenThread, onBrowseJobs, onInterests }: {
  onBack: () => void; onChats: () => void; onOpenThread: (threadId: string) => void
  onBrowseJobs: () => void; onInterests: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <DetailHeader title="Connections" onBack={onBack} right={<TextLink label="Chats" onPress={onChats} />} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ConnectionsBody onChats={onChats} onOpenThread={onOpenThread} onBrowseJobs={onBrowseJobs} onInterests={onInterests} />
      </ScrollView>
    </View>
  )
}

/** Every connection (active, withdrawn, blocked); the tab shares this query for its segment count. */
export function useConnectionRows() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const [a, c, b] = await Promise.all([getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED')])
      return [...a.rows, ...c.rows, ...b.rows]
    },
  })
}

/** The Connections content (cards, archived list, block sheet) with no frame, so it renders inside the Interests tab's second segment or the pushed screen. */
export function ConnectionsBody({ onChats, onOpenThread, onBrowseJobs, onInterests }: {
  onChats: () => void; onOpenThread: (threadId: string) => void
  onBrowseJobs: () => void; onInterests: () => void
}) {
  const qc = useQueryClient()
  const [blocking, setBlocking] = useState<ConnectionRow | null>(null)
  const [withdrawing, setWithdrawing] = useState<ConnectionRow | null>(null)
  const [menu, setMenu] = useState<{ row: ConnectionRow; anchor: MenuAnchor } | null>(null)

  const q = useConnectionRows()
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'WITHDRAW' | 'BLOCK' }) => actOnConnection(id, action),
    // Block closes either way, as before (the refetch shows the truth); Withdraw stays open on a failure to say so.
    onSuccess: () => setWithdrawing(null),
    onSettled: () => { setBlocking(null); qc.invalidateQueries({ queryKey: ['connections'] }) },
  })

  async function openChat(connectionId: string) {
    const threadId = await threadIdForConnection(connectionId)
    if (threadId) onOpenThread(threadId)
    else onChats()
  }

  if (q.isPending) {
    return (
      <View style={styles.stack}>
        {[0, 1].map((i) => (
          <Panel key={i} style={styles.strong}>
            <View style={styles.head}><Skel w={44} h={44} /><View style={styles.skelText}><Skel w="55%" h={16} /><Skel w="70%" h={11} /></View></View>
            <Skel w="100%" h={46} />
          </Panel>
        ))}
      </View>
    )
  }
  if (q.isError) return <StateBlock icon="alert" title="Could not load your connections." body="Nothing has changed. Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />

  const rows = q.data!
  const active = rows.filter((r) => r.status === 'ACTIVE')
  const archived = rows.filter((r) => r.status !== 'ACTIVE')
  const busy = act.isPending

  return (
    <View style={styles.stack}>
      {rows.length === 0 ? (
        <EmptyConnections onInterests={onInterests} onBrowseJobs={onBrowseJobs} />
      ) : (
        <>
          {active.map((r) => (
            <ActiveCard key={r.id} row={r} busy={busy}
              onOpen={() => openChat(r.id)} onMore={(anchor) => setMenu({ row: r, anchor })} />
          ))}
          {archived.length > 0 && (
            <GroupLabel style={styles.archHead}>{`Archived · ${archived.length}`}</GroupLabel>
          )}
          {archived.map((r) => (
            <ArchivedCard key={r.id} row={r} busy={busy} onRead={() => openChat(r.id)} onBlock={() => setBlocking(r)} />
          ))}
        </>
      )}
      <PopoverMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        items={menu ? [
          { key: 'withdraw', label: 'Withdraw', icon: 'out', onPress: () => { act.reset(); setWithdrawing(menu.row) } },
          { key: 'block', label: 'Block', icon: 'ban', danger: true, onPress: () => { act.reset(); setBlocking(menu.row) } },
        ] : []}
      />
      <ConfirmSheet
        open={!!withdrawing}
        title={`Withdraw from ${withdrawing?.counterparty.name ?? 'this company'}?`}
        body={`The chat becomes read-only for both of you — neither side can write in it again. Everything already sent stays, and the connection stays on this list to read. ${withdrawing?.counterparty.name ?? 'The company'} sees it as withdrawn.`}
        confirmLabel="Withdraw"
        cancelLabel="Keep the connection"
        destructive
        busy={busy && !!withdrawing}
        error={act.isError && withdrawing ? 'Nothing was withdrawn. Try again.' : null}
        onConfirm={() => withdrawing && act.mutate({ id: withdrawing.id, action: 'WITHDRAW' })}
        onClose={() => setWithdrawing(null)}
      />
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

function Head({ row, muted, right }: { row: ConnectionRow; muted?: boolean; right?: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <LogoTile name={row.counterparty?.name} size={44} />
      <View style={styles.headText}>
        <Text style={[styles.name, muted && styles.mutedText]} numberOfLines={1}>{row.counterparty.name ?? 'A company'}</Text>
        <View style={styles.pillRow}>
          <StatusPill tone={PILL[row.status].tone} label={PILL[row.status].label} />
          <Text style={styles.mono}>{originDate(row)}</Text>
        </View>
      </View>
      {right}
    </View>
  )
}

function ActiveCard({ row, busy, onOpen, onMore }: {
  row: ConnectionRow; busy: boolean; onOpen: () => void; onMore: (anchor: MenuAnchor) => void
}) {
  const more = useRef<React.ComponentRef<typeof View>>(null)
  const name = row.counterparty.name ?? 'this company'
  return (
    <Panel style={styles.card}>
      <Head row={row} right={
        <Pressable ref={more} accessibilityRole="button" accessibilityLabel={`More for ${name}: withdraw or block`} disabled={busy} hitSlop={6}
          onPress={() => { measureAnchor(more.current).then((a) => a && onMore(a)) }}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}>
          <Icon name="more" size={20} tint={color.textMuted} weight={2.2} />
        </Pressable>
      } />
      {/* Ink, not violet: several cards can show Open chat at once. */}
      <Btn variant="ink" disabled={busy} label="Open chat" onPress={onOpen} />
    </Panel>
  )
}

function ArchivedCard({ row, busy, onRead, onBlock }: { row: ConnectionRow; busy: boolean; onRead: () => void; onBlock: () => void }) {
  const blocked = row.status === 'BLOCKED'
  const name = row.counterparty.name ?? 'This company'
  return (
    <Panel tone="muted" style={styles.card}>
      <Head row={row} muted />
      {blocked ? (
        <View style={styles.dangerWell}>
          <Text style={styles.wellText}>{`Blocked on ${fmtDayMonthLong(row.closedAt ?? row.openedAt)}. ${name} will not see your profile in the feed again and cannot reach you. This cannot be undone from here.`}</Text>
        </View>
      ) : (
        <>
          <View style={styles.well}>
            <Text style={styles.wellMuted}>{`Withdrawn on ${fmtDayMonthLong(row.closedAt ?? row.openedAt)}. Neither side can write again; the conversation stays here to read, and the row stays on this list.`}</Text>
          </View>
          <View style={styles.actions}>
            <Btn variant="outline" disabled={busy} label="Read the chat" onPress={onRead} style={styles.flex} />
            <Btn variant="destructive" disabled={busy} label="Block" onPress={onBlock} />
          </View>
        </>
      )}
    </Panel>
  )
}

function EmptyConnections({ onInterests, onBrowseJobs }: { onInterests: () => void; onBrowseJobs: () => void }) {
  return (
    <Panel style={styles.card}>
      <Text style={styles.emptyTitle}>No connections yet.</Text>
      <Text style={styles.wellMuted}>One opens when you accept an Interest, or when you apply to an employer who had already shortlisted you. There is no third way in, and no way to follow anyone.</Text>
      <View style={styles.actions}>
        <Btn variant="ink" label="See your Interests" onPress={onInterests} style={styles.flex} />
        <Btn variant="outline" label="Browse jobs" onPress={onBrowseJobs} style={styles.flex} />
      </View>
    </Panel>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 10, paddingBottom: 130 },
  card: { gap: 12, borderColor: color.borderStrong },
  strong: { borderColor: color.borderStrong },
  stack: { gap: 12 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0, gap: 6 },
  skelText: { flex: 1, gap: 9 },
  name: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  mono: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textSubtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archHead: { paddingTop: 14, paddingHorizontal: 4 },
  mutedText: { color: color.textMuted },
  more: { width: 40, height: 40, marginTop: -6, marginRight: -8, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  morePressed: { backgroundColor: color.surfaceMuted },
  well: { borderRadius: 14, backgroundColor: color.surfaceSunken, padding: 12 },
  wellText: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.text },
  wellMuted: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  dangerWell: { borderRadius: 14, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, backgroundColor: color.dangerSoft, padding: 12 },
  emptyTitle: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text },
})
