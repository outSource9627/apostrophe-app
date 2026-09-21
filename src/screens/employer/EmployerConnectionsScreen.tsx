import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
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
  getEmployerConnections,
  actOnEmployerConnection,
  threadIdForEmployerConnection,
  type EmployerConnectionRow,
} from '../../lib/api/employerChat'
import type { RootStackParamList } from '../../../App'

function formatIstDate(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  const mon = months[d.getMonth()]
  return `${day} ${mon}`
}

export function EmployerConnectionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [rows, setRows] = useState<EmployerConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'] })
      setRows(res.rows)
    } catch (err) {
      console.error('Failed to load connections', err)
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
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  const handleOpenChat = async (row: EmployerConnectionRow) => {
    if (row.threadId) {
      navigation.navigate('EmployerThread', { id: row.threadId })
      return
    }
    const resolved = await threadIdForEmployerConnection(row.id)
    if (resolved) {
      navigation.navigate('EmployerThread', { id: resolved })
    } else {
      navigation.navigate('EmployerChats')
    }
  }

  const handleWithdraw = (row: EmployerConnectionRow) => {
    Alert.alert(
      'Withdraw connection',
      `Withdraw from ${row.counterparty.name || 'candidate'}? You can’t send messages here any more. The conversation stays readable for both of you, and nothing was deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionBusyId(row.id)
              await actOnEmployerConnection(row.id, 'WITHDRAW')
              load()
            } catch (err) {
              console.error('Failed to withdraw', err)
            } finally {
              setActionBusyId(null)
            }
          },
        },
      ],
    )
  }

  const handleBlock = (row: EmployerConnectionRow) => {
    Alert.alert(
      'Block candidate',
      `Block ${row.counterparty.name || 'candidate'}? They will be permanently removed from your candidate feed and cannot appear in searches again. The chat is archived read-only. This cannot be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block candidate',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionBusyId(row.id)
              await actOnEmployerConnection(row.id, 'BLOCK')
              load()
            } catch (err) {
              console.error('Failed to block', err)
            } finally {
              setActionBusyId(null)
            }
          },
        },
      ],
    )
  }

  const activeRows = rows.filter((r) => r.status === 'ACTIVE')
  const archivedRows = rows.filter((r) => r.status !== 'ACTIVE')

  return (
    <EmployerShell nav={<EmployerNav current="chat" onSelect={handleNavSelect} />}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.eyebrow}>
              {`${activeRows.length} accepted · ${archivedRows.length} in archive · times in IST`}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EmployerChats')}
            >
              <Text style={styles.chatLink}>Chats →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Connections</Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={color.ink} />
            <Text style={styles.loadingText}>Loading connections…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No one has accepted yet.</Text>
            <Text style={styles.emptySubtitle}>
              A candidate appears here when they accept your Interest, or when they apply to one of your jobs after you shortlisted them.
            </Text>
            <Text style={styles.emptyFootnote}>Interests stay open for 14 days</Text>
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
            {/* Active Accepted Rows */}
            {activeRows.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(row.counterparty.name || 'C')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.headerMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{row.counterparty.name || 'Candidate'}</Text>
                      <View style={styles.acceptedPill}>
                        <Text style={styles.acceptedPillText}>Accepted</Text>
                      </View>
                    </View>
                    <View style={styles.subRow}>
                      {row.interviewedAt && (
                        <View style={styles.verifiedTag}>
                          <Text style={styles.verifiedTagText}>
                            Verified · {formatIstDate(row.interviewedAt)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.originText}>
                        {row.origin === 'INTEREST' ? 'Interest accepted' : 'Applied · shortlisted'}
                        {row.openedAt ? ` · ${formatIstDate(row.openedAt)}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenChat(row)}
                    style={styles.openBtn}
                  >
                    <Text style={styles.openBtnText}>Open chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={actionBusyId === row.id}
                    onPress={() => handleWithdraw(row)}
                    style={styles.outlineBtn}
                  >
                    <Text style={styles.outlineBtnText}>Withdraw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={actionBusyId === row.id}
                    onPress={() => handleBlock(row)}
                    style={styles.dangerBtn}
                  >
                    <Text style={styles.dangerBtnText}>Block</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Archive Section */}
            {archivedRows.length > 0 && (
              <View style={styles.archiveSection}>
                <View style={styles.sectionDivider}>
                  <Text style={styles.archiveTitle}>Archive ({archivedRows.length})</Text>
                </View>
                <Text style={styles.archiveSubtitle}>
                  Withdrawn and blocked connections stay on this list.
                </Text>

                {archivedRows.map((row) => {
                  const isBlocked = row.status === 'BLOCKED'
                  return (
                    <View key={row.id} style={styles.archiveCard}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.avatar,
                            isBlocked && { backgroundColor: '#FBECEC' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarText,
                              isBlocked && { color: color.accent },
                            ]}
                          >
                            {(row.counterparty.name || 'C')
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.headerMeta}>
                          <View style={styles.nameRow}>
                            <Text style={styles.name}>{row.counterparty.name || 'Candidate'}</Text>
                            <View
                              style={[
                                styles.pill,
                                isBlocked ? styles.blockedPill : styles.withdrawnPill,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pillText,
                                  isBlocked ? styles.blockedPillText : styles.withdrawnPillText,
                                ]}
                              >
                                {isBlocked ? 'Blocked' : 'Withdrawn'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.originText}>
                            {row.closedByMe ? 'By you' : 'By the candidate'}
                            {row.closedAt ? ` · ${formatIstDate(row.closedAt)}` : ''}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.archiveNote}>
                        {isBlocked
                          ? 'Permanently removed from your candidate feed. This can’t be undone from here.'
                          : 'The chat is kept, read-only. Nothing was deleted.'}
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenChat(row)}
                        style={styles.viewChatBtn}
                      >
                        <Text style={styles.viewChatBtnText}>View chat (read-only)</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
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
  chatLink: {
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
    marginBottom: space.md,
  },
  emptyFootnote: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
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
    gap: space.md,
  },
  card: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    gap: space.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
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
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    fontWeight: 'bold',
    color: color.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: '#FBECEC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  verifiedTagText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '700',
    color: color.accent,
  },
  originText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  acceptedPill: {
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  acceptedPillText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    fontWeight: '600',
    color: '#027A48',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  openBtn: {
    backgroundColor: color.accent,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
  },
  outlineBtnText: {
    color: color.text,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '500',
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#E4CDC9',
    backgroundColor: '#FDF2F2',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
  },
  dangerBtnText: {
    color: color.accent,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
  },
  archiveSection: {
    marginTop: space.lg,
    gap: space.sm,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.md,
  },
  archiveTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '700',
    color: color.textSubtle,
    textTransform: 'uppercase',
  },
  archiveSubtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
    marginBottom: space.xs,
  },
  archiveCard: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    fontWeight: '600',
  },
  withdrawnPill: {
    backgroundColor: '#F2F2F0',
  },
  withdrawnPillText: {
    color: color.textMuted,
  },
  blockedPill: {
    backgroundColor: '#FBECEC',
  },
  blockedPillText: {
    color: color.accent,
  },
  archiveNote: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    lineHeight: 16,
    color: color.textMuted,
    marginVertical: 4,
  },
  viewChatBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  viewChatBtnText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '500',
    color: color.text,
  },
})
