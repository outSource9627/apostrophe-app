import React, { useState, useEffect, useCallback } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  Skeleton,
  StatusPill,
  VerifiedSeal,
} from '../../components/ui'
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

function initialsFor(name?: string | null): string {
  return (name || 'C')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function EmployerConnectionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [rows, setRows] = useState<EmployerConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'] })
      setRows(res.rows)
    } catch (err) {
      console.error('Failed to load connections', err)
      setError(err instanceof Error ? err : new Error('We could not load your connections.'))
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Eyebrow>
            {`${activeRows.length} accepted · ${archivedRows.length} in archive · times in IST`}
          </Eyebrow>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('EmployerChats')}
          >
            <Body size="sm" weight="medium">
              Chats →
            </Body>
          </Pressable>
        </View>
        <Display level="lg" accessibilityRole="header">
          Connections
        </Display>
      </View>

      {/* Content */}
      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load your connections."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No one has accepted yet."
          body="A candidate appears here when they accept your Interest, or when they apply to one of your jobs after you shortlisted them. Interests stay open for 14 days."
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
        <View style={styles.content}>
          {/* Active, accepted connections */}
          <View style={styles.list}>
            {activeRows.map((row) => (
              <Card key={row.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Body weight="semibold">{initialsFor(row.counterparty.name)}</Body>
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Display level="xs" style={styles.grow} numberOfLines={1}>
                        {row.counterparty.name || 'Candidate'}
                      </Display>
                      <StatusPill tone="success" label="Accepted" />
                    </View>
                    <View style={styles.subRow}>
                      {row.interviewedAt && <VerifiedSeal date={formatIstDate(row.interviewedAt)} />}
                      <Meta>
                        {row.origin === 'INTEREST' ? 'Interest accepted' : 'Applied · shortlisted'}
                        {row.openedAt ? ` · ${formatIstDate(row.openedAt)}` : ''}
                      </Meta>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Button variant="secondary" size="sm" label="Open chat" onPress={() => handleOpenChat(row)} />
                  <Button
                    variant="outline"
                    size="sm"
                    label="Withdraw"
                    busy={actionBusyId === row.id}
                    onPress={() => handleWithdraw(row)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    label="Block"
                    busy={actionBusyId === row.id}
                    onPress={() => handleBlock(row)}
                  />
                </View>
              </Card>
            ))}
          </View>

          {/* Archive: withdrawn and blocked connections */}
          {archivedRows.length > 0 && (
            <View style={styles.archiveSection}>
              <View style={styles.sectionHeader}>
                <Eyebrow>{`Archive (${archivedRows.length})`}</Eyebrow>
              </View>
              <Body size="xs" tone="muted">
                Withdrawn and blocked connections stay on this list.
              </Body>

              {archivedRows.map((row) => {
                const isBlocked = row.status === 'BLOCKED'
                return (
                  <Card key={row.id} style={[styles.card, styles.cardArchived]}>
                    <View style={styles.cardTop}>
                      <View style={styles.avatar}>
                        <Body weight="semibold">{initialsFor(row.counterparty.name)}</Body>
                      </View>
                      <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                          <Display level="xs" style={styles.grow} numberOfLines={1}>
                            {row.counterparty.name || 'Candidate'}
                          </Display>
                          <StatusPill tone={isBlocked ? 'danger' : 'neutral'} label={isBlocked ? 'Blocked' : 'Withdrawn'} />
                        </View>
                        <Meta>
                          {row.closedByMe ? 'By you' : 'By the candidate'}
                          {row.closedAt ? ` · ${formatIstDate(row.closedAt)}` : ''}
                        </Meta>
                      </View>
                    </View>

                    <Body size="xs" tone="muted">
                      {isBlocked
                        ? 'Permanently removed from your candidate feed. This can’t be undone from here.'
                        : 'The chat is kept, read-only. Nothing was deleted.'}
                    </Body>

                    <Button
                      variant="outline"
                      size="sm"
                      label="View chat (read-only)"
                      onPress={() => handleOpenChat(row)}
                    />
                  </Card>
                )
              })}
            </View>
          )}
        </View>
      )}
    </EmployerShell>
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
  content: { gap: space.lg },
  list: { gap: space.md },
  card: { padding: space.lg, gap: space.sm },
  cardArchived: { opacity: opacity.disabled },
  cardTop: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  avatar: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  archiveSection: {
    gap: space.sm,
  },
  sectionHeader: {
    paddingBottom: space.xs,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
})
