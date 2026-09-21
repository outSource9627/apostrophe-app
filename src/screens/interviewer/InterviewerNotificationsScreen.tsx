import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi } from '../../lib/api/interviewer'

export function InterviewerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { notifications, unreadNotifications, refresh } = useInterviewer()

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

  return (
    <InterviewerShell
      back={{ label: 'Back', onPress: () => navigation.goBack() }}
      rightAction={
        unreadNotifications > 0 ? (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </Pressable>
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Eyebrow>ACTIVITY & ALERTS</Eyebrow>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>
          Updates on candidate bookings, 24-hour scorecard reminders, and wallet payouts.
        </Text>
      </View>

      {notifications.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyDesc}>
            You have no unread alerts or notifications at this time.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {notifications.map((n) => (
            <Card
              key={n.id}
              style={[styles.noticeCard, !n.read && styles.noticeUnread]}
            >
              <View style={styles.noticeHeader}>
                <Text style={styles.noticeTitle}>{n.title}</Text>
                {!n.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.noticeBody}>{n.body}</Text>
              <Text style={styles.noticeTime}>{formatNoticeTime(n.createdAt)}</Text>
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
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
    fontWeight: '700',
    color: color.text,
  },
  subtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  markReadText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.accent,
  },
  list: {
    gap: space.xs,
  },
  noticeCard: {
    padding: space.md,
    gap: space['2xs'],
  },
  noticeUnread: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noticeTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.accent,
  },
  noticeBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  noticeTime: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 2,
  },
  emptyCard: {
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  emptyDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
  },
})
