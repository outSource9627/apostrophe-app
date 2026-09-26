import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EM_TONE, EmEmpty, EmError, EmIconButton, EmPills, type EmTone } from '../../components/employer/em'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../../lib/api/account'
import { fmtRowStamp } from '../../lib/chat/format'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | 'unread'

/** The tile's mark and tone, read from the event's category and name (the web's rule). */
function markOf(n: NotificationRow): { icon: IconName; tone: EmTone } {
  const k = n.kind.toLowerCase()
  if (/(reject|suspend|not_approved|declin|fail)/.test(k)) return { icon: 'alert', tone: 'red' }
  if (/(approved|accepted|verified|live)/.test(k)) return { icon: n.category === 'CONNECTION' ? 'heart' : 'check', tone: 'green' }
  switch (n.category) {
    case 'CONNECTION': return { icon: 'heart', tone: 'violet' }
    case 'MESSAGE': return { icon: 'chat', tone: 'violet' }
    case 'APPLICATION': return { icon: 'users', tone: 'violet' }
    case 'JOB': return { icon: 'brief', tone: 'gray' }
    case 'ACCOUNT': return { icon: 'shield', tone: 'gray' }
    default: return { icon: 'bell', tone: 'gray' }
  }
}

/**
 * EM-28 · Notifications (Employer Android): All and Unread (the server's
 * count), a row per event — the mark by category, the server's own title and
 * line, the time — heavier and on a card while unread. A tap marks it read and
 * opens what it is about; "Mark all read" appears while anything is unread;
 * the sliders open the settings. EM-28b is the empty list. Kept for the
 * server's retention window (`notificationRetentionDays`).
 */
export function EmployerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { notificationRetentionDays } = useEmployerConfig()
  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await getNotifications({ perPage: 100 })
      setRows(res.rows)
      setUnread(res.unread)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your notifications.')
    }
  }, [])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  function open(n: NotificationRow) {
    if (!n.read) {
      setRows((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      markNotificationsRead([n.id]).catch(() => {})
    }
    const meta = n.meta ?? {}
    const id = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
    if (n.category === 'MESSAGE' || n.kind.includes('message')) {
      if (id('threadId')) navigation.navigate('EmployerThread', { id: id('threadId')! })
      else navigation.navigate('EmployerChats')
    } else if (n.category === 'CONNECTION' || n.kind.includes('interest')) {
      if (id('threadId')) navigation.navigate('EmployerThread', { id: id('threadId')! })
      else navigation.navigate('EmployerInterests')
    } else if (n.category === 'APPLICATION' || n.kind.includes('application')) {
      if (id('applicationId')) navigation.navigate('ApplicantDetail', { id: id('applicationId')! })
      else if (id('jobId')) navigation.navigate('JobApplications', { id: id('jobId')! })
      else navigation.navigate('EmployerJobs')
    } else if (n.category === 'JOB' || n.kind.includes('job')) {
      if (id('jobId')) navigation.navigate('EmployerJobDetail', { id: id('jobId')! })
      else navigation.navigate('EmployerJobs')
    } else if (n.kind.includes('verif')) {
      navigation.navigate('EmployerStatus')
    }
  }

  async function markAll() {
    setRows((prev) => (prev ?? []).map((x) => ({ ...x, read: true })))
    setUnread(0)
    markNotificationsRead().catch(() => { load() })
  }

  const shown = tab === 'unread' ? (rows ?? []).filter((n) => !n.read) : rows ?? []

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your notifications." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if ((rows?.length ?? 0) === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty icon="bell" title="Nothing new." body="Interest replies, applicants, post reviews and messages appear here." />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={styles.headRow}>
            <EmPills<Tab> items={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: unread }]} value={tab} onChange={setTab} />
            {unread > 0 && <Button variant="text" size="sm" label="Mark all read" onPress={() => { markAll() }} />}
          </View>
        }
        ListHeaderComponentStyle={styles.pillsWrap}
        ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>You’ve read everything.</Text>}
        ListFooterComponent={
          notificationRetentionDays ? <Text style={[text.uiXs, styles.subtle, styles.none]}>{`Kept for ${notificationRetentionDays} days.`}</Text> : undefined
        }
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
          const mk = markOf(item)
          const t = EM_TONE[mk.tone]
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`} onPress={() => open(item)} style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.pressed]}>
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
    )
  }

  return (
    <EmployerShell
      back={() => navigation.goBack()}
      title="Notifications"
      scroll={false}
      right={<EmIconButton name="sliders" label="Notification settings" onPress={() => navigation.navigate('EmployerNotificationSettings')} />}
    >
      {body}
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

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
  list: { paddingHorizontal: space.md, paddingBottom: space.lg },
  gap: { height: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.panel },
  rowUnread: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  tile: { width: height.chip + 4, height: height.chip + 4, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
