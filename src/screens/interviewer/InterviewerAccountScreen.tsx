import React from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Display,
  Divider,
  ErrorState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
  StatusPill,
  Tag,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { tokenStore } from '../../lib/api'

/** The chevron on a drill-in row. Danger-toned on Sign Out so the row reads as the destructive one without reaching for accent. */
function RowChevron({ danger = false }: { danger?: boolean }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={danger ? color.danger : color.textSubtle}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m9 5 7 7-7 7" />
    </Svg>
  )
}

export function InterviewerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, error, refresh } = useInterviewer()

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
        <Display level="lg">Interviewer Account</Display>
      </View>

      {profile ? (
        <>
          {/* Suspension Alert Box (Settled Decision D4/D5) */}
          {isSuspended && (
            <Banner tone="danger" title="Account under active suspension" reference="SUSPENDED · ACTION RESTRICTED">
              <View style={styles.suspensionBody}>
                <Body size="sm" tone="danger">
                  Your interviewer account has been temporarily restricted due to consecutive overdue scorecards or
                  candidate complaints. While suspended:
                </Body>
                <View style={styles.bulletList}>
                  <Body size="xs" tone="danger">• You cannot accept or conduct new interviews.</Body>
                  <Body size="xs" tone="danger">• Payout withdrawals are temporarily frozen.</Body>
                  <Body size="xs" tone="danger">• You can still complete owed scorecards and view your ledger.</Body>
                </View>
                <Body size="xs" tone="danger" style={styles.appealText}>
                  To appeal your suspension, contact platform governance at compliance@apostrophe.jobs.
                </Body>
              </View>
            </Banner>
          )}

          {/* Profile Overview */}
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Display level="xs">{(profile?.name || 'I').slice(0, 1).toUpperCase()}</Display>
              </View>
              <View style={styles.grow}>
                <Display level="xs">{profile?.name || 'Interviewer'}</Display>
                <Body size="xs" tone="muted">{profile?.email || ''}</Body>
                <Meta style={styles.phone}>{profile?.phone || ''}</Meta>
              </View>
              <StatusPill tone={isSuspended ? 'danger' : 'success'} label={profile?.status || 'ACTIVE'} />
            </View>

            {!!profile?.bio && (
              <>
                <Divider />
                <Body size="sm">{profile.bio}</Body>
              </>
            )}
          </Card>

          {/* Quality Metrics & Tier Access */}
          <Card style={styles.metricsCard}>
            <Eyebrow>Performance & Evaluation Tier</Eyebrow>
            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Eyebrow>Quality Score</Eyebrow>
                <Display level="xs">
                  {profile?.qualityScore ? profile.qualityScore.toFixed(1) : '5.0'} / 5.0
                </Display>
              </View>
              <View style={styles.metricBox}>
                <Eyebrow>Total Sessions</Eyebrow>
                <Display level="xs">{profile?.totalInterviews ?? 0}</Display>
              </View>
              <View style={styles.metricBox}>
                <Eyebrow>Reliability</Eyebrow>
                <Display level="xs" style={styles.reliabilityValue}>99.2%</Display>
              </View>
            </View>

            <View style={styles.tierAccessBox}>
              <Body size="xs" weight="medium" tone="muted">Permitted Evaluation Tiers:</Body>
              <View style={styles.tierPillsRow}>
                {profile?.permittedTiers?.map((tier) => (
                  <Tag key={tier} label={tier.replace('_', ' ')} />
                )) || <Tag label="TIER 1" />}
              </View>
            </View>
          </Card>

          {/* Account Actions & Shortcuts */}
          <Card>
            <ObjectRow
              title="Notifications & System Alerts"
              status={<RowChevron />}
              onPress={() => navigation.navigate('InterviewerNotifications')}
            />
            <ObjectRow
              title="Candidate Support Conversations"
              status={<RowChevron />}
              onPress={() => navigation.navigate('InterviewerChats')}
            />
            <ObjectRow
              title="Change Password"
              status={<RowChevron />}
              onPress={() => navigation.navigate('InterviewerPassword', { email: profile?.email })}
            />
            <ObjectRow
              title="Sign Out"
              status={<RowChevron danger />}
              onPress={handleSignOut}
              last
            />
          </Card>
        </>
      ) : error ? (
        <ErrorState
          title="We could not load your account."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      ) : (
        <Skeleton lines={4} />
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
  suspensionBody: {
    gap: space.xs,
  },
  bulletList: {
    gap: space['2xs'],
  },
  appealText: {
    fontStyle: 'italic',
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
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    color: color.textSubtle,
  },
  metricsCard: {
    padding: space.md,
    gap: space.md,
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
    gap: space['2xs'],
  },
  reliabilityValue: {
    color: color.success,
  },
  tierAccessBox: {
    gap: space.xs,
  },
  tierPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
})
