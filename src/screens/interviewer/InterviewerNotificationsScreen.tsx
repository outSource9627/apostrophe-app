import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space } from '../../theme'
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
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi } from '../../lib/api/interviewer'

export function InterviewerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { notifications, unreadNotifications, loading, error, refresh } = useInterviewer()

  const handleMarkAllRead = async () => {
    try {
      await interviewerApi.markNotificationsRead()
      await refresh()
    } catch {
      // ignore
    }
  }

  const formatNoticeTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  if (loading && notifications.length === 0) {
    return (
      <InterviewerShell back={{ label: 'Back', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && notifications.length === 0) {
    return (
      <InterviewerShell back={{ label: 'Back', onPress: () => navigation.goBack() }}>
        <ErrorState
          title="We could not load your notifications."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell
      back={{ label: 'Back', onPress: () => navigation.goBack() }}
      rightAction={
        unreadNotifications > 0 ? (
          <Button variant="text" size="sm" label="Mark all read" onPress={handleMarkAllRead} />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Eyebrow>ACTIVITY & ALERTS</Eyebrow>
        <Display level="sm">Notifications</Display>
        <Body size="sm" tone="muted">
          Updates on candidate bookings, 24-hour scorecard reminders, and wallet payouts.
        </Body>
      </View>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications"
            body="You have no unread alerts or notifications at this time."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {notifications.map((n) => (
            <Card key={n.id} style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <Body
                  size="md"
                  weight={n.read ? 'regular' : 'semibold'}
                  tone={n.read ? 'muted' : 'default'}
                  style={styles.grow}
                >
                  {n.title}
                </Body>
                {!n.read && <View style={styles.unreadDot} />}
              </View>
              <Body size="sm" tone="muted">
                {n.body}
              </Body>
              <Meta style={styles.noticeTime}>{formatNoticeTime(n.createdAt)}</Meta>
            </Card>
          ))}
        </View>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  grow: {
    flex: 1,
  },
  list: {
    gap: space.xs,
  },
  noticeCard: {
    padding: space.md,
    gap: space['2xs'],
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  unreadDot: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
  },
  noticeTime: {
    marginTop: space['2xs'],
  },
})
