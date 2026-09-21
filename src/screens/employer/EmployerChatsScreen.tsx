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

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [liveRes, archivedRes] = await Promise.all([
        getEmployerThreads({ archived: false, perPage: 50 }),
        getEmployerThreads({ archived: true, perPage: 50 }),
      ])
      setLive(liveRes.rows)
      setArchived(archivedRes.rows)
    } catch (err) {
      console.error('Failed to load employer threads', err)
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.eyebrow}>
              {`${totalUnread} unread · ${totalConversations} conversations`}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EmployerConnections')}
            >
              <Text style={styles.connectionsLink}>Connections →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Chats</Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={color.ink} />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : totalConversations === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No conversations yet.</Text>
            <Text style={styles.emptySubtitle}>
              A chat opens when a candidate accepts your Interest, or applies to your job after you shortlisted them. There is no other way to start one.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EmployerFeed')}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>Browse candidates</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {/* Unread section */}
            {unreadThreads.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>UNREAD</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{unreadThreads.length}</Text>
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
                  <Text style={styles.sectionTitle}>EARLIER</Text>
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
                  <Text style={styles.sectionTitle}>ARCHIVED · READ-ONLY ({archived.length})</Text>
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
      </ScrollView>
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
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.row}>
      <View
        style={[
          styles.avatar,
          isSupport && styles.supportAvatar,
          isArchived && styles.archivedAvatar,
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            isSupport && styles.supportAvatarText,
            isArchived && styles.archivedAvatarText,
          ]}
        >
          {initials}
        </Text>
      </View>

      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <View style={styles.nameBadgeRow}>
            <Text style={[styles.rowName, thread.unread > 0 && styles.unreadName]} numberOfLines={1}>
              {name}
            </Text>
            {isSupport && (
              <View style={styles.supportTag}>
                <Text style={styles.supportTagText}>Support</Text>
              </View>
            )}
            {isArchived && (
              <View style={styles.archivedTag}>
                <Text style={styles.archivedTagText}>
                  {thread.archivedReason === 'BLOCKED' ? 'Blocked' : 'Withdrawn'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.timestamp}>{formatTimestamp(thread.lastMessageAt)}</Text>
        </View>

        <View style={styles.rowBottom}>
          <Text style={styles.preview} numberOfLines={1}>
            {thread.lastMessagePreview || 'No messages yet.'}
          </Text>
          {thread.unread > 0 && (
            <View style={styles.unreadChip}>
              <Text style={styles.unreadChipText}>{thread.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  eyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  connectionsLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.accent,
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
    borderStyle: 'dashed',
    backgroundColor: color.background,
    marginVertical: space.xl,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    fontWeight: 'bold',
    color: color.text,
    marginBottom: space.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    lineHeight: 20,
    color: color.textMuted,
    textAlign: 'center',
    marginBottom: space.lg,
  },
  browseBtn: {
    backgroundColor: color.accent,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
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
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textSubtle,
  },
  countBadge: {
    backgroundColor: color.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    fontWeight: 'bold',
    color: color.text,
  },
  supportAvatar: {
    backgroundColor: '#EFF8FF',
  },
  supportAvatarText: {
    color: '#175CD3',
  },
  archivedAvatar: {
    backgroundColor: '#F2F2F0',
  },
  archivedAvatarText: {
    color: color.textMuted,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: space.xs,
  },
  rowName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 15,
    color: color.text,
  },
  unreadName: {
    fontWeight: 'bold',
  },
  supportTag: {
    backgroundColor: '#EFF8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  supportTagText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '600',
    color: '#175CD3',
  },
  archivedTag: {
    backgroundColor: '#F2F2F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  archivedTagText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '500',
    color: color.textMuted,
  },
  timestamp: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  preview: {
    flex: 1,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  unreadChip: {
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadChipText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
})
