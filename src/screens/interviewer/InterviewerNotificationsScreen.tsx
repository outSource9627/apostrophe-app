import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { EM_TONE, EmEmpty, EmError, EmPills, type EmTone } from '../../components/employer/em'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../../lib/api/account'
import { fmtRowStamp } from '../../lib/chat/format'
import { INTERVIEWER_KEY } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | 'unread'

function markOf(n: NotificationRow): { icon: IconName; tone: EmTone } {
  const k = n.kind.toLowerCase()
  if (/(suspend|withheld|reject|fail|cancel|no_show|overdue)/.test(k)) return { icon: 'alert', tone: 'red' }
  if (/(paid|credited|approved|submitted)/.test(k)) return { icon: 'check', tone: 'green' }
  switch (n.category) {
    case 'INTERVIEW': return { icon: 'cal', tone: 'violet' }
    case 'MESSAGE': return { icon: 'chat', tone: 'violet' }
    case 'PAYMENT': return { icon: 'building', tone: 'gray' }
    case 'ACCOUNT': return { icon: 'shield', tone: 'gray' }
    default: return { icon: 'bell', tone: 'gray' }
  }
}

/**
 * Notifications (no artboard — the drawn screens' language). GET/PATCH
 * /me/notifications: All and Unread (the server's count), the server's own
 * title and line per row, a mark by category, and a tap that marks it read and
 * opens the interview, scorecard or chat it names.
 */
export function InterviewerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const qc = useQueryClient()
  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await getNotifications({ perPage: 100 })
      setRows(r.rows)
      setUnread(r.unread)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your notifications.')
    }
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  const refreshBell = () => qc.invalidateQueries({ queryKey: [...INTERVIEWER_KEY, 'unread'] })

  function open(n: NotificationRow) {
    if (!n.read) {
      setRows((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      markNotificationsRead([n.id]).then(refreshBell).catch(() => {})
    }
    const meta = n.meta ?? {}
    const id = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
    if (id('threadId')) navigation.navigate('InterviewerThread', { id: id('threadId')! })
    else if (id('interviewId') && /scorecard/.test(n.kind)) navigation.navigate('ScorecardDraft', { id: id('interviewId')! })
    else if (id('interviewId')) navigation.navigate('InterviewerDetail', { id: id('interviewId')! })
    else if (n.category === 'PAYMENT') navigation.navigate('InterviewerWallet')
  }

  const shown = tab === 'unread' ? (rows ?? []).filter((n) => !n.read) : rows ?? []

  return (
    <InterviewerShell back={() => navigation.goBack()} title="Notifications" scroll={false}>
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !rows ? (
        <View style={styles.pad}><EmError title="Couldn’t load your notifications." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /></View>
      ) : (rows ?? []).length === 0 ? (
        <View style={[styles.pad, styles.center]}><EmEmpty icon="bell" title="Nothing new." body="Bookings, reminders, scorecard deadlines and payouts appear here." /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headRow}>
              <EmPills<Tab> items={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: unread }]} value={tab} onChange={setTab} />
              {unread > 0 && (
                <Button
                  variant="text"
                  size="sm"
                  label="Mark all read"
                  onPress={() => {
                    setRows((prev) => (prev ?? []).map((x) => ({ ...x, read: true })))
                    setUnread(0)
                    markNotificationsRead().then(refreshBell).catch(() => { load() })
                  }}
                />
              )}
            </View>
          }
          ListHeaderComponentStyle={styles.pillsWrap}
          ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>You’ve read everything.</Text>}
          renderItem={({ item }) => {
            const mk = markOf(item)
            const t = EM_TONE[mk.tone]
            return (
              <Pressable accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.pressed]}>
                <View style={[styles.tile, { backgroundColor: t.bg }]}><Icon name={mk.icon} size={space.lg} tint={t.fg} weight={2} /></View>
                <View style={styles.grow}>
                  <Text style={item.read ? text.uiMdMedium : text.uiMdSemi}>{item.title}</Text>
                  {!!item.body && <Text style={[text.uiXs, styles.muted]}>{item.body}</Text>}
                </View>
                <Text style={[text.metaSm, styles.subtle, styles.mono]}>{fmtRowStamp(item.createdAt, now).toUpperCase()}</Text>
              </Pressable>
            )
          }}
        />
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  mono: { letterSpacing: trackingNative.eyebrow },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  pillsWrap: { marginHorizontal: -space.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingRight: space.md },
  list: { paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.panel },
  rowUnread: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  tile: { width: height.chip + 4, height: height.chip + 4, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
