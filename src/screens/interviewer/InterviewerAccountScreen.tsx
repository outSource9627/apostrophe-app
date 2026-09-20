import React from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, StatusPill } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { tokenStore } from '../../lib/api'

export function InterviewerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile } = useInterviewer()

  const isSuspended = profile?.status === 'SUSPENDED'

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your interviewer account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await tokenStore.clear()
          navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          })
        },
      },
    ])
  }

  return (
    <InterviewerShell navTab="account">
      <View style={styles.header}>
        <Eyebrow>GOVERNANCE & SETTINGS</Eyebrow>
        <Text style={styles.title}>Interviewer Account</Text>
      </View>

      {/* Suspension Alert Box (Settled Decision D4/D5) */}
      {isSuspended && (
        <Card style={styles.suspensionCard}>
          <View style={styles.suspensionHeader}>
            <Text style={styles.suspensionIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.suspensionTitle}>Account Under Active Suspension</Text>
              <Text style={styles.suspensionSub}>
                Status: SUSPENDED · Action restricted
              </Text>
            </View>
          </View>
          <Text style={styles.suspensionBody}>
            Your interviewer account has been temporarily restricted due to consecutive overdue scorecards or candidate complaints. While suspended:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• You cannot accept or conduct new interviews.</Text>
            <Text style={styles.bulletItem}>• Payout withdrawals are temporarily frozen.</Text>
            <Text style={styles.bulletItem}>• You can still complete owed scorecards and view your ledger.</Text>
          </View>
          <Text style={styles.appealText}>
            To appeal your suspension, contact platform governance at compliance@apostrophe.jobs.
          </Text>
        </Card>
      )}

      {/* Profile Overview */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || 'I').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile?.name || 'Interviewer'}</Text>
            <Text style={styles.email}>{profile?.email || ''}</Text>
            <Text style={styles.phone}>{profile?.phone || ''}</Text>
          </View>
          <StatusPill
            tone={isSuspended ? 'danger' : 'success'}
            label={profile?.status || 'ACTIVE'}
          />
        </View>

        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </Card>

      {/* Quality Metrics & Tier Access */}
      <Card style={styles.metricsCard}>
        <Text style={styles.cardHeading}>Performance & Evaluation Tier</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Quality Score</Text>
            <Text style={styles.metricVal}>
              {profile?.qualityScore ? profile.qualityScore.toFixed(1) : '5.0'} / 5.0
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Total Sessions</Text>
            <Text style={styles.metricVal}>{profile?.totalInterviews ?? 0}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Reliability</Text>
            <Text style={[styles.metricVal, { color: '#059669' }]}>99.2%</Text>
          </View>
        </View>

        <View style={styles.tierAccessBox}>
          <Text style={styles.tierAccessLabel}>Permitted Evaluation Tiers:</Text>
          <View style={styles.tierPillsRow}>
            {profile?.permittedTiers?.map((tier) => (
              <View key={tier} style={styles.tierPill}>
                <Text style={styles.tierPillText}>{tier.replace('_', ' ')}</Text>
              </View>
            )) || (
              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>TIER 1</Text>
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Account Actions & Shortcuts */}
      <View style={styles.actionsList}>
        <Pressable
          style={styles.actionItem}
          onPress={() => navigation.navigate('InterviewerNotifications')}
        >
          <Text style={styles.actionIcon}>🔔</Text>
          <Text style={styles.actionLabel}>Notifications & System Alerts</Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <Pressable
          style={styles.actionItem}
          onPress={() => navigation.navigate('InterviewerChats')}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Candidate Support Conversations</Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <Pressable
          style={styles.actionItem}
          onPress={() => navigation.navigate('InterviewerPassword', { email: profile?.email })}
        >
          <Text style={styles.actionIcon}>🔑</Text>
          <Text style={styles.actionLabel}>Change Password</Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <Pressable
          style={[styles.actionItem, styles.signOutItem]}
          onPress={handleSignOut}
        >
          <Text style={[styles.actionIcon, styles.signOutText]}>🚪</Text>
          <Text style={[styles.actionLabel, styles.signOutText]}>Sign Out</Text>
          <Text style={[styles.chevron, styles.signOutText]}>→</Text>
        </Pressable>
      </View>
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
  suspensionCard: {
    padding: space.md,
    gap: space.xs,
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  suspensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  suspensionIcon: {
    fontSize: 22,
  },
  suspensionTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: '#9f1239',
  },
  suspensionSub: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: '#be123c',
  },
  suspensionBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#881337',
    lineHeight: 17,
  },
  bulletList: {
    gap: 2,
    marginVertical: 2,
  },
  bulletItem: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#881337',
  },
  appealText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: '#be123c',
    fontStyle: 'italic',
    marginTop: 2,
  },
  profileCard: {
    padding: space.md,
    gap: space.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 20,
    fontWeight: '700',
    color: color.text,
  },
  name: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  email: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  phone: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  bio: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
    lineHeight: 18,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.xs,
  },
  metricsCard: {
    padding: space.md,
    gap: space.md,
  },
  cardHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  metricRow: {
    flexDirection: 'row',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    color: color.textSubtle,
  },
  metricVal: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  tierAccessBox: {
    gap: space.xs,
  },
  tierAccessLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  tierPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  tierPill: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: borderWidth.thin,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  tierPillText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    color: color.accent,
  },
  actionsList: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
    gap: space.sm,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    flex: 1,
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  chevron: {
    fontSize: 16,
    color: color.textSubtle,
  },
  signOutItem: {
    borderBottomWidth: 0,
  },
  signOutText: {
    color: color.accent,
  },
})
