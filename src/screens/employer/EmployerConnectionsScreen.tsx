import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmChip, EmDialog, EmEmpty, EmError, EmIconButton, EmPerson, EmSheet, initialsOf } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import {
  actOnEmployerConnection, getEmployerConnections, reportEmployerThread, threadIdForEmployerConnection,
  type EmployerConnectionRow, type ReportReason,
} from '../../lib/api/employerChat'
import { fmtDayMon } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'OFF_PLATFORM_PAYMENT', label: 'Off-platform payment' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Something else' },
]

const first = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'They'

/** "Via your Interest · 22 Sep" / "Applied to your job · 23 Sep" / "Withdrawn by you · 15 Sep". */
function viaLine(c: EmployerConnectionRow): string {
  if (c.status === 'CLOSED') return `Withdrawn by ${c.closedByMe ? 'you' : first(c.counterparty.name)}${c.closedAt ? ` · ${fmtDayMon(c.closedAt)}` : ''}`
  if (c.status === 'BLOCKED') return `Blocked${c.closedAt ? ` · ${fmtDayMon(c.closedAt)}` : ''}`
  return `${c.origin === 'INTEREST' ? 'Via your Interest' : 'Applied to your job'} · ${fmtDayMon(c.openedAt)}`
}

/**
 * EM-24b · Block (and report). Blocking archives the chat and keeps them out of
 * the feed. "Also report" files a report first (the report API needs a reason,
 * so the reasons show while it is on); a repeat report is not an error.
 */
export function BlockDialog({
  open, connection, onClose, onDone,
}: { open: boolean; connection: EmployerConnectionRow; onClose: () => void; onDone: () => void }) {
  const [report, setReport] = useState(true)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = connection.counterparty.name || 'this candidate'

  useEffect(() => {
    if (open) {
      setReport(true)
      setReason(null)
      setError(null)
    }
  }, [open])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      if (report && reason) {
        const threadId = connection.threadId ?? (await threadIdForEmployerConnection(connection.id))
        if (threadId) {
          await reportEmployerThread(threadId, reason).catch((e) => {
            if (!(e instanceof ApiClientError && e.meta?.reason === 'ALREADY_REPORTED')) throw e
          })
        }
      }
      await actOnEmployerConnection(connection.id, 'BLOCK')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not blocked. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <EmDialog
      open={open}
      onClose={onClose}
      title={`Block ${name}?`}
      body={`The chat is archived and ${first(connection.counterparty.name)} won’t appear in your feed again.`}
      actions={
        <>
          <Button variant="ghost" size="md" label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="dangerFill" size="md" label={report ? 'Block and report' : 'Block'} busy={busy} disabled={busy || (report && !reason)} onPress={() => { confirm() }} />
        </>
      }
    >
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: report }} onPress={() => setReport((r) => !r)} style={styles.check}>
        <View style={[styles.box, report && styles.boxOn]}>{report && <Icon name="check" size={space.md + 1} tint={color.textInverse} weight={3} />}</View>
        <Text style={text.uiMdMedium}>Also report to Apostrophe</Text>
      </Pressable>
      {report && (
        <View style={styles.reasons}>
          {REPORT_REASONS.map((r) => <EmChip key={r.value} compact label={r.label} on={reason === r.value} onPress={() => setReason(r.value)} />)}
        </View>
      )}
      {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
    </EmDialog>
  )
}

/** Withdraw has no board of its own: the block dialog's frame, with its optional reason. */
function WithdrawDialog({
  open, connection, onClose, onDone,
}: { open: boolean; connection: EmployerConnectionRow | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])
  if (!connection) return null
  async function confirm() {
    if (!connection) return
    setBusy(true)
    setError(null)
    try {
      await actOnEmployerConnection(connection.id, 'WITHDRAW', reason.trim() || undefined)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not withdrawn. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <EmDialog
      open={open}
      onClose={onClose}
      title={`Withdraw from ${connection.counterparty.name || 'this connection'}?`}
      body="The chat becomes read-only for both of you. Nothing is deleted."
      actions={
        <>
          <Button variant="ghost" size="md" label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="secondary" size="md" label="Withdraw" busy={busy} disabled={busy} onPress={() => { confirm() }} />
        </>
      }
    >
      <Input value={reason} onChangeText={setReason} placeholder="Reason (optional)" />
      {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
    </EmDialog>
  )
}

/**
 * EM-24 · Connections (Employer Android). Everyone you are connected to: live
 * ones first, with their contact details (the server shares them once
 * connected) and Open chat; then the withdrawn and blocked ones, dimmed and
 * read-only. Each row's ⋯ holds View profile, Withdraw and Block and report.
 */
export function EmployerConnectionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const [rows, setRows] = useState<EmployerConnectionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [menuFor, setMenuFor] = useState<EmployerConnectionRow | null>(null)
  const [blocking, setBlocking] = useState<EmployerConnectionRow | null>(null)
  const [withdrawing, setWithdrawing] = useState<EmployerConnectionRow | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'], perPage: 100 })
      const order = { ACTIVE: 0, CLOSED: 1, BLOCKED: 2 } as const
      setRows([...res.rows].sort((a, b) => order[a.status] - order[b.status]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your connections.')
    }
  }, [])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  async function openChat(c: EmployerConnectionRow) {
    setOpening(c.id)
    try {
      const threadId = c.threadId ?? (await threadIdForEmployerConnection(c.id))
      if (threadId) navigation.navigate('EmployerThread', { id: threadId })
    } finally {
      setOpening(null)
    }
  }

  const active = rows?.filter((r) => r.status === 'ACTIVE').length ?? 0
  const archived = (rows?.length ?? 0) - active

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your connections." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if ((rows?.length ?? 0) === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty
          icon="users"
          title="No connections yet."
          body="A connection opens when a candidate accepts your Interest, or applies after you shortlisted them."
          action={<Button variant="primary" size="pair" label="Browse candidates" onPress={() => navigation.navigate('EmployerFeed')} />}
        />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.textSubtle}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
        renderItem={({ item }) => {
          const live = item.status === 'ACTIVE'
          const email = item.contact?.email
          const mobile = item.contact?.mobile
          return (
            <EmCard style={!live && styles.dim}>
              <View style={styles.head}>
                <EmPerson initials={initialsOf(item.counterparty.name)} size={height.tap} muted={!live} />
                <View style={styles.grow}>
                  <Text style={text.uiBaseSemi} numberOfLines={1}>{item.counterparty.name || 'Candidate'}</Text>
                  <Text style={[text.uiXs, styles.muted]} numberOfLines={2}>{viaLine(item)}</Text>
                </View>
                <EmIconButton name="more" label="More" size={height.chip + 4} onPress={() => setMenuFor(item)} />
              </View>
              {live ? (
                <>
                  {(!!email || !!mobile) && (
                    <View style={styles.contact}>
                      {!!email && (
                        <Text style={[text.uiSm, styles.secondary]} onPress={() => Linking.openURL(`mailto:${email}`).catch(() => {})}>{email}</Text>
                      )}
                      {!!mobile && (
                        <Text style={[text.uiSm, styles.secondary]} onPress={() => Linking.openURL(`tel:${mobile}`).catch(() => {})}>{mobile}</Text>
                      )}
                    </View>
                  )}
                  <Button variant="primary" size="md" icon="chat" label="Open chat" busy={opening === item.id} onPress={() => { openChat(item) }} />
                </>
              ) : (
                <EmBadge label={item.status === 'BLOCKED' ? 'Blocked · read-only' : 'Withdrawn · read-only'} tone="gray" small />
              )}
            </EmCard>
          )
        }}
      />
    )
  }

  const m = menuFor
  return (
    <EmployerShell back={() => navigation.goBack()} title="Connections" sub={rows ? `${active} ACTIVE · ${archived} ARCHIVED` : undefined} scroll={false}>
      {body}

      <EmSheet open={!!m} onClose={() => setMenuFor(null)} scroll={false}>
        {m && (
          <View style={styles.menu}>
            <MenuRow icon="eye" label="View profile" onPress={() => { setMenuFor(null); navigation.navigate('CandidateProfile', { id: m.counterparty.id }) }} />
            {m.status !== 'ACTIVE' && !!m.threadId && (
              <MenuRow icon="chat" label="Read the chat" onPress={() => { setMenuFor(null); navigation.navigate('EmployerThread', { id: m.threadId! }) }} />
            )}
            {m.status === 'ACTIVE' && <MenuRow icon="out" label="Withdraw" onPress={() => { setMenuFor(null); setWithdrawing(m) }} />}
            {m.status !== 'BLOCKED' && <MenuRow icon="ban" label="Block and report" danger onPress={() => { setMenuFor(null); setBlocking(m) }} />}
          </View>
        )}
      </EmSheet>

      {blocking && (
        <BlockDialog
          open
          connection={blocking}
          onClose={() => setBlocking(null)}
          onDone={() => {
            setBlocking(null)
            load()
          }}
        />
      )}
      <WithdrawDialog
        open={!!withdrawing}
        connection={withdrawing}
        onClose={() => setWithdrawing(null)}
        onDone={() => {
          setWithdrawing(null)
          load()
        }}
      />
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

function MenuRow({ icon, label, danger, onPress }: { icon: IconName; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <Icon name={icon} size={space.lg} tint={danger ? color.danger : color.text} />
      <Text style={[text.uiBaseMedium, danger && styles.danger]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  dim: { opacity: opacity.disabled + 0.2 },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  gap: { height: spaceHalf['2.5'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  contact: { gap: space.xs },
  menu: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'], paddingHorizontal: space.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], minHeight: height.tap },
  box: { width: space.xl, height: space.xl, borderRadius: radius.sm, borderWidth: borderWidth.medium, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.accent, borderColor: color.accent },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
})
