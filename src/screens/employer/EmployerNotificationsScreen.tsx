import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
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

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getNotifications({ perPage: 100 })
      setRows(res.rows)
    } catch (err) {
      console.error('Failed to load notifications', err)
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
    <EmployerShell
      back={{ label: 'ACCOUNT', onPress: () => navigation.goBack() }}
      scroll={false}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>{`${unreadCount} unread · the last 90 days`}</Text>
              <Text style={styles.title}>Notifications</Text>
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleMarkAllRead}
                style={styles.markReadBtn}
              >
                <Text style={styles.markReadText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={color.ink} />
            <Text style={styles.loadingText}>Loading notifications…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing in the last 90 days.</Text>
            <Text style={styles.emptySubtitle}>
              Accepted Interests, new applications, messages and verification decisions land here.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {groups.map((group) => (
              <View key={group.key} style={styles.groupSection}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupCard}>
                  {group.items.map((n) => (
                    <TouchableOpacity
                      key={n.id}
                      activeOpacity={0.7}
                      onPress={() => handleOpenItem(n)}
                      style={styles.itemRow}
                    >
                      <View style={styles.unreadCol}>
                        {!n.read && <View style={styles.unreadDot} />}
                      </View>

                      <View style={styles.itemContent}>
                        <View style={styles.itemTop}>
                          <Text
                            style={[styles.itemTitle, !n.read && styles.unreadTitle]}
                            numberOfLines={1}
                          >
                            {n.title}
                          </Text>
                          <Text style={styles.itemTime}>{formatTime(n.createdAt)}</Text>
                        </View>

                        {n.body && (
                          <Text style={styles.itemBody} numberOfLines={2}>
                            {n.body}
                          </Text>
                        )}

                        <Text style={styles.itemMeta}>{formatTime(n.createdAt)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <Text style={styles.footnote}>
              Kept for 90 days · notifications auto-expire after 90 days
            </Text>
          </View>
        )}
      </ScrollView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space['2xl'] * 2,
  },
  header: {
    marginBottom: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  markReadBtn: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
  },
  markReadText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  eyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textSubtle,
    marginBottom: space.xs,
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 26,
    fontWeight: 'bold',
    color: color.text,
  },
  centerBox: {
    paddingVertical: space['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: space.sm,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  emptyCard: {
    padding: space.xl,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    marginVertical: space.xl,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    fontWeight: 'bold',
    color: color.text,
    marginBottom: space.sm,
  },
  emptySubtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    textAlign: 'center',
  },
  listContainer: {
    gap: space.lg,
  },
  groupSection: {
    gap: space.xs,
  },
  groupLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    color: color.textSubtle,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    gap: space.xs,
  },
  unreadCol: {
    width: 14,
    paddingTop: 6,
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.ink,
  },
  itemContent: {
    flex: 1,
    gap: 3,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  itemTitle: {
    flex: 1,
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    marginRight: space.xs,
  },
  unreadTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 15,
    fontWeight: 'bold',
    color: color.text,
  },
  itemTime: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  itemBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    lineHeight: 18,
    color: color.textMuted,
  },
  itemMeta: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
    marginTop: 2,
  },
  footnote: {
    textAlign: 'center',
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: space.sm,
  },
})
