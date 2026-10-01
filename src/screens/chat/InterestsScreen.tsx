import React, { useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { getInterests, respondToInterest, type InterestRow } from '../../lib/api/chat'
import { fmtDayMon, fmtDayMonthLong, interestClock } from '../../lib/chat/format'
import { employmentLabel } from '../../lib/jobs/format'
import type { EmploymentType } from '../../lib/api/jobs'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { StatusPill } from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { Btn, CompactBar, GroupLabel, LargeTitle, Panel, Skel, StateBlock, TextLink, useCollapsingTitle } from '../../components/tab/kit'
import { CompanyMark, InterestClock } from './parts'

/**
 * ST-41 — Interests received, restyled to the tab screens' system (large title, bordered panels, mono labels). The pending list is sorted by expiresAt ASCENDING
 * (this screen exists to stop an Interest lapsing), and NOTHING is ever removed:
 * accepted, declined and lapsed rows stay below. Accept is solid ink
 * rather than the violet primary — the pending list can hold more than
 * one card at once, and crimson is capped at one button per SCREEN, not one per
 * card; Decline is the outline variant. There is no message affordance on a
 * pending, declined or expired Interest.
 */
export function InterestsScreen({ onConnections, onVideoResume }: {
  onBack?: () => void; onConnections: () => void; onVideoResume: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [now] = useState(() => Date.now())
  const q = useQuery({ queryKey: ['interests'], queryFn: () => getInterests() })
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<{ employer?: { interest?: { cooldownDays?: number; expiryDays?: number } } }>('/config') })
  // Admin settings; 0 or absent means "not stated", so the sentence that would quote it drops the number.
  const cooldownDays = cfg.data?.employer?.interest?.cooldownDays || undefined
  const expiryDays = cfg.data?.employer?.interest?.expiryDays || undefined
  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'ACCEPT' | 'DECLINE' }) => respondToInterest(id, response),
    // NOT IDEMPOTENT — a 404 after a timeout means it probably landed. Refetch either way.
    onSettled: () => qc.invalidateQueries({ queryKey: ['interests'] }),
    onError: (e) => { if (e instanceof ApiClientError && e.status === 404) qc.invalidateQueries({ queryKey: ['interests'] }) },
  })

  const title = useCollapsingTitle()
  const header = <LargeTitle title="Interests" right={<TextLink label="Connections" onPress={onConnections} />} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{header}{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.body}>
        {[0, 1].map((i) => (
          <Panel key={i}>
            <View style={styles.cardHead}><Skel w={44} h={44} /><View style={styles.skelText}><Skel w="55%" h={16} /><Skel w="75%" h={11} /></View></View>
            <Skel w="100%" h={56} />
            <Skel w="100%" h={46} />
          </Panel>
        ))}
      </View>,
    )
  }
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your Interests." body="Nothing has changed. Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)

  const rows = q.data!
  const isLive = (r: InterestRow) => r.status === 'SENT' && interestClock(r.sentAt, r.expiresAt, now).reading !== 'spent'
  const pending = rows.filter(isLive).sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt))
  const closed = rows.filter((r) => !isLive(r))
  const lapsed = closed
    .filter((r) => r.status === 'EXPIRED' || r.status === 'SENT')
    .sort((a, b) => +new Date(b.respondedAt ?? b.expiresAt) - +new Date(a.respondedAt ?? a.expiresAt))
  const topLapsed = pending.length === 0 ? lapsed[0] ?? null : null
  const closedRest = topLapsed ? closed.filter((r) => r.id !== topLapsed.id) : closed
  const busyId = respond.isPending ? respond.variables?.id : undefined

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <CompactBar title="Interests" opacity={title.barOpacity} />
      <Animated.ScrollView onScroll={title.onScroll} scrollEventThrottle={16} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {header}
        <View style={styles.body}>
          <GroupLabel>{`${pending.length} awaiting your answer · ${closed.length} closed`}</GroupLabel>

          {pending.length > 0 ? (
            pending.map((r) => (
              <PendingCard key={r.id} row={r} now={now} busy={busyId === r.id}
                onAccept={() => respond.mutate({ id: r.id, response: 'ACCEPT' })}
                onDecline={() => respond.mutate({ id: r.id, response: 'DECLINE' })} />
            ))
          ) : (
            <View style={styles.stack}>
              <ExpiredEmpty onVideoResume={onVideoResume} />
              {topLapsed && <LapsedCard row={topLapsed} cooldownDays={cooldownDays} />}
              <Text style={styles.fine}>{`${expiryDays ? `An interest lapses ${expiryDays} days after it is sent · ` : ''}nothing is ever removed from this list`}</Text>
            </View>
          )}

          {closedRest.length > 0 && (
            <View style={styles.closedGroup}>
              <GroupLabel>{`${topLapsed ? 'The rest of the closed list' : 'Further down the list · closed'} · ${closedRest.length}`}</GroupLabel>
              <View style={styles.closedCard}>{closedRest.map((r, i) => <ClosedRow key={r.id} row={r} first={i === 0} />)}</View>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  )
}

function CompanyHead({ row, muted }: { row: InterestRow; muted?: boolean }) {
  const c = row.company
  return (
    <View style={styles.cardHead}>
      <CompanyMark name={c?.name} size={44} />
      <View style={styles.grow}>
        <Text style={[styles.company, muted && styles.mutedText]} numberOfLines={1}>{c?.name ?? 'A company'}</Text>
        {!!c && <Text style={styles.mono}>{[c.industry, c.size, c.officeLocation].filter(Boolean).join(' · ').toUpperCase()}</Text>}
      </View>
    </View>
  )
}

function RoleWell({ row, muted }: { row: InterestRow; muted?: boolean }) {
  if (!row.role?.title) return null
  const meta = [row.role.location, row.role.employmentType ? employmentLabel(row.role.employmentType as EmploymentType) : null].filter(Boolean).join(' · ')
  return (
    <View style={[styles.roleWell, muted && styles.roleWellMuted]}>
      <Text style={styles.monoLabel}>FOR THIS ROLE</Text>
      <Text style={[styles.roleTitle, muted && styles.mutedText]} numberOfLines={1}>{row.role.title}</Text>
      {!!meta && <Text style={styles.roleMeta}>{meta}</Text>}
    </View>
  )
}

function PendingCard({ row, now, busy, onAccept, onDecline }: {
  row: InterestRow; now: number; busy: boolean; onAccept: () => void; onDecline: () => void
}) {
  return (
    <Panel style={styles.card}>
      <CompanyHead row={row} />
      {!!row.message && <Text style={styles.quote}>{`“${row.message}”`}</Text>}
      <RoleWell row={row} />
      <InterestClock sentAt={row.sentAt} expiresAt={row.expiresAt} now={now} />
      <View style={styles.actions}>
        {/* Ink, not violet: several cards can show Accept at once. */}
        <Btn variant="ink" busy={busy} label="Accept" onPress={onAccept} style={styles.flex} />
        <Btn variant="outline" disabled={busy} label="Decline" onPress={onDecline} style={styles.flex} />
      </View>
    </Panel>
  )
}

const CLOSED: Record<InterestRow['status'], { tone: Tone; label: string }> = {
  ACCEPTED: { tone: 'success', label: 'Accepted' },
  DECLINED: { tone: 'neutral', label: 'Declined' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
  SENT: { tone: 'neutral', label: 'Expired' },
}

function ClosedRow({ row, first }: { row: InterestRow; first: boolean }) {
  const c = row.company
  const pill = CLOSED[row.status]
  const line =
    row.status === 'ACCEPTED' ? `Accepted ${fmtDayMon(row.respondedAt ?? row.sentAt)} · now a connection`
    : row.status === 'DECLINED' ? `Declined ${fmtDayMon(row.respondedAt ?? row.sentAt)}`
    : `Lapsed ${fmtDayMon(row.respondedAt ?? row.expiresAt)} · sent ${fmtDayMon(row.sentAt)}`
  const note =
    row.status === 'ACCEPTED' ? 'Chat opened the moment you accepted. Accepting is the only way an employer chat starts.'
    : row.status === 'DECLINED' ? `${c?.name ?? 'They'} was not told. Their list shows only that it was not accepted, never whether you declined or let it lapse.`
    : `Nothing is ever removed from this list. ${c?.name ?? 'They'} may write again once the cooldown passes.`
  return (
    <View style={[styles.closedRow, first ? null : styles.closedRowBorder]}>
      <CompanyMark name={c?.name} size={36} />
      <View style={styles.grow}>
        <View style={styles.rowTop}>
          <Text style={[styles.company, styles.grow]} numberOfLines={1}>{c?.name ?? 'A company'}</Text>
          <StatusPill tone={pill.tone} label={pill.label} />
        </View>
        <Text style={styles.mono}>{line.toUpperCase()}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </View>
  )
}

function ExpiredEmpty({ onVideoResume }: { onVideoResume: () => void }) {
  return (
    <Panel style={styles.card}>
      <Text style={styles.emptyTitle}>Employers write after they watch you.</Text>
      <Text style={styles.note}>Your video resume is in the feed. Keeping it there, and adding another film, is what you can do from here — nobody can be nudged into sending an Interest.</Text>
      <Btn label="Check my video resume" onPress={onVideoResume} />
    </Panel>
  )
}

/** The most-recently-lapsed Interest, INTACT but drained — buttons gone, clock replaced by an expired mark, cooldown stated. */
function LapsedCard({ row, cooldownDays }: { row: InterestRow; cooldownDays?: number }) {
  const c = row.company
  const cooldown = cooldownDays ? new Date(+new Date(row.sentAt) + cooldownDays * 86_400_000).toISOString() : null
  return (
    <Panel style={styles.card}>
      <CompanyHead row={row} muted />
      {!!row.message && <Text style={[styles.quote, styles.subtleText]}>{`“${row.message}”`}</Text>}
      <RoleWell row={row} muted />
      <View style={styles.rowTop}>
        <StatusPill tone="neutral" label={`Expired ${fmtDayMon(row.respondedAt ?? row.expiresAt)}`} />
        <Text style={styles.mono}>{`SENT ${fmtDayMon(row.sentAt).toUpperCase()}`}</Text>
      </View>
      <Text style={styles.note}>{`${c?.name ?? 'They'} was not told. Their list shows only that it was not accepted — a lapse and a decline are the same thing from their side — ${cooldown ? ` and they may not write to you again until ${fmtDayMonthLong(cooldown)}` : ''}.`}</Text>
    </Panel>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  content: { paddingBottom: 130 },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  stack: { gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  flex: { flex: 1 },
  card: { gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skelText: { flex: 1, gap: 9 },
  company: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  mutedText: { color: color.textMuted },
  subtleText: { color: color.textSubtle },
  mono: { fontFamily: FF.monoMedium, fontSize: 10.5, lineHeight: 15, letterSpacing: 0.63, color: color.textSubtle, marginTop: 2 },
  monoLabel: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, color: color.textMuted },
  quote: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.textMuted },
  roleWell: { borderRadius: 14, backgroundColor: color.surfaceMuted, paddingHorizontal: 14, paddingVertical: 11, gap: 3 },
  roleWellMuted: { backgroundColor: color.surfaceSunken },
  roleTitle: { fontFamily: FF.bodySemiBold, fontSize: 15.5, color: color.text },
  roleMeta: { fontFamily: FF.body, fontSize: 13, color: color.textMuted },
  actions: { flexDirection: 'row', gap: 8 },
  note: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  fine: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase', color: color.textSubtle },
  emptyTitle: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text },
  closedGroup: { gap: 8, paddingTop: 12 },
  closedCard: { backgroundColor: color.surface, borderRadius: 18, borderWidth: borderWidth.thin, borderColor: color.border, paddingHorizontal: 14 },
  closedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  closedRowBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
})
