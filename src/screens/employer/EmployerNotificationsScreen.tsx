import React, { useState, useEffect, useCallback } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  Skeleton,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  getNotifications,
  markNotificationsRead,
  type NotificationRow,
} from '../../lib/api/account'
import type { RootStackParamList } from '../../../App'

function formatTime(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

interface NotificationGroup {
  key: string
  label: string
  items: NotificationRow[]
}

function groupByDay(rows: NotificationRow[]): NotificationGroup[] {
  const groups: Map<string, NotificationGroup> = new Map()
  const now = new Date()

  for (const n of rows) {
    const d = new Date(n.createdAt)
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()

    let key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    let label = formatDate(n.createdAt)
    if (isToday) {
      label = `Today · ${label}`
      key = 'today'
    } else if (isYesterday) {
      label = `Yesterday · ${label}`
      key = 'yesterday'
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [] })
    }
    groups.get(key)!.items.push(n)
  }

  return Array.from(groups.values())
}

export function EmployerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getNotifications({ perPage: 100 })
      setRows(res.rows)
    } catch (err) {
      console.error('Failed to load notifications', err)
      setError(err instanceof Error ? err : new Error('We could not load your notifications.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleMarkAllRead = async () => {
    try {
      setRows((prev) => prev.map((n) => ({ ...n, read: true })))
      await markNotificationsRead()
    } catch (err) {
      console.error('Failed to mark all notifications read', err)
      load()
    }
  }

  const handleOpenItem = (n: NotificationRow) => {
    if (!n.read) {
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      void markNotificationsRead([n.id]).catch(() => {})
    }

    if (n.category === 'MESSAGE' || n.kind.includes('message')) {
      if (n.meta?.threadId) {
        navigation.navigate('EmployerThread', { id: String(n.meta.threadId) })
      } else {
        navigation.navigate('EmployerChats')
      }
    } else if (n.category === 'CONNECTION' || n.kind.includes('interest')) {
      navigation.navigate('EmployerConnections')
    } else if (n.category === 'APPLICATION' || n.kind.includes('application')) {
      if (n.meta?.jobId) {
        navigation.navigate('JobApplications', { id: String(n.meta.jobId) })
      } else {
        navigation.navigate('EmployerJobs')
      }
    } else if (n.category === 'JOB' || n.kind.includes('job')) {
      if (n.meta?.jobId) {
        navigation.navigate('EmployerJobDetail', { id: String(n.meta.jobId) })
      } else {
        navigation.navigate('EmployerJobs')
      }
    } else {
      navigation.navigate('EmployerAccount')
    }
  }

  const unreadCount = rows.filter((n) => !n.read).length
  const groups = groupByDay(rows)

  return (
    <EmployerShell back={{ label: 'ACCOUNT', onPress: () => navigation.goBack() }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Eyebrow>{`${unreadCount} unread · the last 90 days`}</Eyebrow>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" label="Mark all read" onPress={handleMarkAllRead} />
          )}
        </View>
        <Display level="lg">Notifications</Display>
      </View>

      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load your notifications."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing in the last 90 days."
          body="Accepted Interests, new applications, messages and verification decisions land here."
        />
      ) : (
        <View style={styles.listContainer}>
          {groups.map((group) => (
            <View key={group.key} style={styles.groupSection}>
              <Eyebrow>{group.label}</Eyebrow>
              <View style={styles.groupCard}>
                {group.items.map((n, i) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    last={i === group.items.length - 1}
                    onPress={() => handleOpenItem(n)}
                  />
                ))}
              </View>
            </View>
          ))}

          <Meta style={styles.footnote}>
            Kept for 90 days · notifications auto-expire after 90 days
          </Meta>
        </View>
      )}
    </EmployerShell>
  )
}

function NotificationItem({
  notification, last = false, onPress,
}: { notification: NotificationRow; last?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.itemRow, last && styles.itemRowLast]}
    >
      <View style={styles.unreadCol}>{!notification.read && <View style={styles.unreadDot} />}</View>

      <View style={styles.itemContent}>
        <View style={styles.itemTop}>
          <Body
            size="sm"
            weight={notification.read ? 'regular' : 'semibold'}
            tone={notification.read ? 'muted' : 'default'}
            numberOfLines={1}
            style={styles.grow}
          >
            {notification.title}
          </Body>
          <Meta>{formatTime(notification.createdAt)}</Meta>
        </View>

        {!!notification.body && (
          <Body size="xs" tone="muted" numberOfLines={2}>
            {notification.body}
          </Body>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  header: {
    gap: space.xs,
    paddingBottom: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  listContainer: {
    gap: space.lg,
  },
  groupSection: {
    gap: space.xs,
  },
  groupCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
    gap: space.sm,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  unreadCol: {
    width: space.lg,
    paddingTop: space.xs,
    alignItems: 'center',
  },
  unreadDot: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
  },
  itemContent: {
    flex: 1,
    gap: space['2xs'],
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  footnote: {
    textAlign: 'center',
    marginTop: space.sm,
  },
})
