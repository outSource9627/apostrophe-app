import React, { useState, useEffect, useCallback } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, radius, space } from '../../theme'
import {
  Body,
  Button,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import {
  getEmployerThreads,
  type ThreadDto,
} from '../../lib/api/employerChat'
import type { RootStackParamList } from '../../../App'

function formatTimestamp(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) {
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${ampm}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'Yesterday'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export function EmployerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [live, setLive] = useState<ThreadDto[]>([])
  const [archived, setArchived] = useState<ThreadDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [liveRes, archivedRes] = await Promise.all([
        getEmployerThreads({ archived: false, perPage: 50 }),
        getEmployerThreads({ archived: true, perPage: 50 }),
      ])
      setLive(liveRes.rows)
      setArchived(archivedRes.rows)
    } catch (err) {
      console.error('Failed to load employer threads', err)
      setError(err instanceof Error ? err : new Error('We could not load your conversations.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') navigation.navigate('EmployerFeed')
    else if (key === 'shortlist') navigation.navigate('EmployerShortlist')
    else if (key === 'interests') navigation.navigate('EmployerInterests')
    else if (key === 'jobs') navigation.navigate('EmployerJobs')
    else if (key === 'chat') load()
  }

  const totalUnread = live.reduce((acc, t) => acc + (t.unread || 0), 0)
  const unreadThreads = live.filter((t) => (t.unread || 0) > 0)
  const earlierThreads = live.filter((t) => (t.unread || 0) === 0)
  const totalConversations = live.length + archived.length

  return (
    <EmployerShell nav={<EmployerNav current="chat" onSelect={handleNavSelect} />}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Eyebrow>
            {`${totalUnread} unread · ${totalConversations} conversations`}
          </Eyebrow>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('EmployerConnections')}
          >
            <Body size="sm" weight="medium">
              Connections →
            </Body>
          </Pressable>
        </View>
        <Display level="lg">Chats</Display>
      </View>

      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load your conversations."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
        />
      ) : totalConversations === 0 ? (
        <EmptyState
          title="No conversations yet."
          body="A chat opens when a candidate accepts your Interest, or applies to your job after you shortlisted them. There is no other way to start one."
          action={
            <Button
              variant="outline"
              size="sm"
              label="Browse candidates"
              onPress={() => navigation.navigate('EmployerFeed')}
            />
          }
        />
      ) : (
        <View style={styles.listContainer}>
          {/* Unread section */}
          {unreadThreads.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eyebrow>UNREAD</Eyebrow>
                <View style={styles.countBadge}>
                  <Meta style={styles.countBadgeText}>{unreadThreads.length}</Meta>
                </View>
              </View>
              {unreadThreads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  onPress={() => navigation.navigate('EmployerThread', { id: thread.id })}
                />
              ))}
            </View>
          )}

          {/* Earlier section */}
          {earlierThreads.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eyebrow>EARLIER</Eyebrow>
              </View>
              {earlierThreads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  onPress={() => navigation.navigate('EmployerThread', { id: thread.id })}
                />
              ))}
            </View>
          )}

          {/* Archived section */}
          {archived.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eyebrow>{`ARCHIVED · READ-ONLY (${archived.length})`}</Eyebrow>
              </View>
              {archived.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isArchived
                  onPress={() => navigation.navigate('EmployerThread', { id: thread.id })}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </EmployerShell>
  )
}

function ThreadRow({
  thread,
  isArchived = false,
  onPress,
}: {
  thread: ThreadDto
  isArchived?: boolean
  onPress: () => void
}) {
  const isSupport = thread.kind === 'USER_ADMIN'
  const name = isSupport ? 'Apostrophe Support' : thread.counterparty.name || 'Candidate'
  const initials = isSupport
    ? 'AS'
    : name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View
        style={[
          styles.avatar,
          isSupport && styles.supportAvatar,
          isArchived && styles.archivedAvatar,
        ]}
      >
        <Body
          weight="semibold"
          style={[isSupport && styles.supportAvatarText, isArchived && styles.archivedAvatarText]}
        >
          {initials}
        </Body>
      </View>

      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <View style={styles.nameBadgeRow}>
            <Display level="xs" style={styles.grow} numberOfLines={1}>
              {name}
            </Display>
            {isSupport && <StatusPill tone="info" label="Support" />}
            {isArchived && (
              <StatusPill
                tone={thread.archivedReason === 'BLOCKED' ? 'danger' : 'neutral'}
                label={thread.archivedReason === 'BLOCKED' ? 'Blocked' : 'Withdrawn'}
              />
            )}
          </View>
          <Meta>{formatTimestamp(thread.lastMessageAt)}</Meta>
        </View>

        <View style={styles.rowBottom}>
          <Body size="sm" tone="muted" numberOfLines={1} style={styles.grow}>
            {thread.lastMessagePreview || 'No messages yet.'}
          </Body>
          {thread.unread > 0 && (
            <View style={styles.unreadChip}>
              <Meta style={styles.unreadChipText}>{thread.unread}</Meta>
            </View>
          )}
        </View>
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
  },
  listContainer: {
    gap: space.lg,
  },
  section: {
    gap: space.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingBottom: space.xs,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  countBadge: {
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space['2xs'],
  },
  countBadgeText: {
    color: color.textInverse,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  avatar: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportAvatar: {
    backgroundColor: color.infoSoft,
  },
  supportAvatarText: {
    color: color.info,
  },
  archivedAvatar: {
    backgroundColor: color.surfaceSunken,
  },
  archivedAvatarText: {
    color: color.textMuted,
  },
  rowInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  unreadChip: {
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space['2xs'],
  },
  unreadChipText: {
    color: color.textInverse,
  },
})
