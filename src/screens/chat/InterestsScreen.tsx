import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '../../lib/api'
import { getInterests, respondToInterest, type InterestRow } from '../../lib/api/chat'
import { fmtDayMon, fmtDayMonthLong, interestClock } from '../../lib/chat/format'
import { employmentLabel } from '../../lib/jobs/format'
import type { EmploymentType } from '../../lib/api/jobs'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow, Meta, StatusPill } from '../../components/ui'
import type { Tone } from '../../components/ui/status'
import { CompanyMark, InterestClock } from './parts'

/**
 * ST-41 — Interests received. The pending list is sorted by expiresAt ASCENDING
 * (this screen exists to stop an Interest lapsing), and NOTHING is ever removed:
 * accepted, declined and lapsed rows stay below. Accept is the one crimson button
 * (one per pending card); Decline is the outline variant. There is no message
 * affordance on a pending, declined or expired Interest.
 */
export function InterestsScreen({ onBack, onConnections, onVideoResume }: {
  onBack: () => void; onConnections: () => void; onVideoResume: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [now] = useState(() => Date.now())
  const q = useQuery({ queryKey: ['interests'], queryFn: () => getInterests() })
  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'ACCEPT' | 'DECLINE' }) => respondToInterest(id, response),
    // NOT IDEMPOTENT — a 404 after a timeout means it probably landed. Refetch either way.
    onSettled: () => qc.invalidateQueries({ queryKey: ['interests'] }),
    onError: (e) => { if (e instanceof ApiClientError && e.status === 404) qc.invalidateQueries({ queryKey: ['interests'] }) },
  })

  const bar = (
    <AppBar title="Home" onBack={onBack}
      action={<Pressable onPress={onConnections} hitSlop={8}><Body size="sm" weight="medium" style={{ color: color.text }}>Connections</Body></Pressable>} />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your Interests.</Body></View>)

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
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>{`${pending.length} awaiting your answer · ${closed.length} closed`}</Eyebrow>
          <Display level="lg">Interests</Display>
        </View>

        {pending.length > 0 ? (
          pending.map((r) => (
            <PendingCard key={r.id} row={r} now={now} busy={busyId === r.id}
              onAccept={() => respond.mutate({ id: r.id, response: 'ACCEPT' })}
              onDecline={() => respond.mutate({ id: r.id, response: 'DECLINE' })} />
          ))
        ) : (
          <View style={{ gap: space.lg }}>
            <ExpiredEmpty onVideoResume={onVideoResume} />
            {topLapsed && <LapsedCard row={topLapsed} />}
            <Meta style={{ color: color.textSubtle }}>An interest lapses 14 days after it is sent · nothing is ever removed from this list</Meta>
          </View>
        )}

        {closedRest.length > 0 && (
          <View style={styles.closedGroup}>
            <Eyebrow>{`${topLapsed ? 'The rest of the closed list' : 'Further down the list · closed'} · ${closedRest.length}`}</Eyebrow>
            <View>{closedRest.map((r, i) => <ClosedRow key={r.id} row={r} first={i === 0} />)}</View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function PendingCard({ row, now, busy, onAccept, onDecline }: {
  row: InterestRow; now: number; busy: boolean; onAccept: () => void; onDecline: () => void
}) {
  const c = row.company
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <CompanyMark name={c?.name} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Display level="sm">{c?.name ?? 'A company'}</Display>
          {!!c && <Meta style={{ color: color.textSubtle }}>{[c.industry, c.size, c.officeLocation].filter(Boolean).join(' · ')}</Meta>}
        </View>
      </View>

      {!!row.message && <Body size="sm" tone="muted">{`“${row.message}”`}</Body>}

      {!!row.role?.title && (
        <View style={styles.roleWell}>
          <Eyebrow>For this role</Eyebrow>
          <Body size="md" weight="medium" numberOfLines={1}>{row.role.title}</Body>
          {(row.role.location || row.role.employmentType) && (
            <Body size="xs" tone="muted">{[row.role.location, row.role.employmentType ? employmentLabel(row.role.employmentType as EmploymentType) : null].filter(Boolean).join(' · ')}</Body>
          )}
        </View>
      )}

      <InterestClock sentAt={row.sentAt} expiresAt={row.expiresAt} now={now} />

      <View style={styles.cardActions}>
        <Button variant="primary" size="md" full busy={busy} label="Accept" onPress={onAccept} />
        <Button variant="outline" size="md" full disabled={busy} label="Decline" onPress={onDecline} />
      </View>
    </View>
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
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
        <View style={styles.rowTop}>
          <Display level="xs" style={{ flex: 1 }} numberOfLines={1}>{c?.name ?? 'A company'}</Display>
          <StatusPill tone={pill.tone} label={pill.label} />
        </View>
        <Meta style={{ color: color.textSubtle }}>{line}</Meta>
        <Body size="xs" tone="muted">{note}</Body>
      </View>
    </View>
  )
}

const COOLDOWN_DAYS = 30 // employer.interestCooldownDays — for the 'may not write until' line

function ExpiredEmpty({ onVideoResume }: { onVideoResume: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <Display level="xs">Employers write after they watch you.</Display>
      <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>Your video resume is in the feed. Keeping it there, and adding another film, is what you can do from here — nobody can be nudged into sending an Interest.</Body>
      <View style={{ marginTop: space.md }}><Button variant="primary" size="block" full label="Check my video resume" onPress={onVideoResume} /></View>
    </View>
  )
}

/** The most-recently-lapsed Interest, INTACT but drained — buttons gone, clock replaced by an expired mark, cooldown stated. */
function LapsedCard({ row }: { row: InterestRow }) {
  const c = row.company
  const cooldown = new Date(+new Date(row.sentAt) + COOLDOWN_DAYS * 86_400_000).toISOString()
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <CompanyMark name={c?.name} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Display level="sm" style={{ color: color.textMuted }}>{c?.name ?? 'A company'}</Display>
          {!!c && <Meta style={{ color: color.textSubtle }}>{[c.industry, c.size, c.officeLocation].filter(Boolean).join(' · ')}</Meta>}
        </View>
      </View>
      {!!row.message && <Body size="sm" style={{ color: color.textSubtle }}>{`“${row.message}”`}</Body>}
      {!!row.role?.title && (
        <View style={[styles.roleWell, { backgroundColor: color.surfaceSunken }]}>
          <Eyebrow>For this role</Eyebrow>
          <Body size="md" weight="medium" style={{ color: color.textMuted }} numberOfLines={1}>{row.role.title}</Body>
          {(row.role.location || row.role.employmentType) && (
            <Body size="xs" style={{ color: color.textSubtle }}>{[row.role.location, row.role.employmentType ? employmentLabel(row.role.employmentType as EmploymentType) : null].filter(Boolean).join(' · ')}</Body>
          )}
        </View>
      )}
      <View style={styles.rowTop}>
        <StatusPill tone="neutral" label={`Expired ${fmtDayMon(row.respondedAt ?? row.expiresAt)}`} />
        <Meta style={{ color: color.textSubtle }}>{`sent ${fmtDayMon(row.sentAt)}`}</Meta>
      </View>
      <Body size="xs" tone="muted">{`${c?.name ?? 'They'} was not told. Their list shows only that it was not accepted — a lapse and a decline are the same thing from their side — and they may not write to you again until ${fmtDayMonthLong(cooldown)}.`}</Body>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.lg, paddingBottom: space['4xl'] },
  card: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  roleWell: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, paddingHorizontal: space.md, paddingVertical: 10, gap: 2 },
  cardActions: { flexDirection: 'row', gap: space.sm },
  closedGroup: { gap: space.lg, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.lg },
  closedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  closedRowBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  emptyCard: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.xl },
})
