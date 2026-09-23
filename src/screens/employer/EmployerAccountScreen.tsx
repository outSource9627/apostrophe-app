import React, { useState, useEffect, useCallback } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
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
} from '../../components/ui'
import { CompanyMonogram, EmployerShell, VerifiedEmployerBadge } from '../../components/employer'
import { getEmployerMe, type EmployerMe } from '../../lib/api/employer'
import { logout } from '../../lib/api/account'
import type { RootStackParamList } from '../../../App'

function formatApprovedDate(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  const mon = months[d.getMonth()]
  const yr = d.getFullYear()
  return `${day} ${mon} ${yr}`
}

/** The chevron on a drill-in row. Danger-toned on Sign out so the row reads as the destructive one without reaching for accent. */
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

export function EmployerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [data, setData] = useState<EmployerMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getEmployerMe()
      setData(res)
      setError(null)
    } catch (err) {
      console.error('Failed to load employer account', err)
      setError(err instanceof Error ? err : new Error('Failed to load employer account'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await logout()
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
    } catch (err) {
      console.error('Failed to sign out', err)
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
    } finally {
      setSigningOut(false)
    }
  }

  const isSuspended = data?.status === 'SUSPENDED'
  const isVerified = data?.verified === true
  const isPending = !isVerified && !isSuspended

  return (
    <EmployerShell
      back={{ label: 'HOME', onPress: () => navigation.goBack() }}
      scroll={false}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Display level="lg" accessibilityRole="header">
          Account
        </Display>

        {loading ? (
          <Skeleton lines={4} />
        ) : data ? (
          <View style={styles.content}>
            {/* Suspended Alert */}
            {isSuspended && (
              <Banner tone="danger" title={data.company.name} reference="ACCOUNT SUSPENDED">
                While the suspension lasts, candidate browsing, job applications, messaging, and new Interests are
                frozen.
              </Banner>
            )}

            {/* Pending Review Alert */}
            {isPending && (
              <Card>
                <ObjectRow
                  title="In review"
                  meta="Your verification documents are under review. Candidates and chat open once approved."
                  status={<StatusPill tone="warning" label="Pending review" />}
                  onPress={() => navigation.navigate('EmployerStatus')}
                  last
                />
              </Card>
            )}

            {/* Verification Card */}
            <Card style={styles.verificationCard}>
              <View style={styles.identity}>
                <CompanyMonogram name={data.company.name} size={space['4xl']} />
                <View style={styles.naming}>
                  <Display level="md">{data.company.name}</Display>
                  {isVerified ? <VerifiedEmployerBadge /> : <StatusPill tone="warning" label="Pending" />}
                </View>
              </View>

              <Meta>
                {data.verification.approvedAt
                  ? `Since ${formatApprovedDate(data.verification.approvedAt)}`
                  : 'Verification pending'}
              </Meta>

              <Body size="sm" tone="muted">
                {[data.company.industry, data.company.size, data.company.officeLocation]
                  .filter(Boolean)
                  .join(' · ')}
              </Body>

              <Divider />

              <Body size="xs" tone="muted">
                Verified employers have submitted company PAN, registration documents, and an authorized signatory's
                government photo ID. Students see this seal next to every communication from your team.
              </Body>
            </Card>

            {/* Sign-in & Security */}
            <View style={styles.section}>
              <Eyebrow>Sign-in & security</Eyebrow>
              <Card>
                <ObjectRow title={data.contact.email} meta="Work email" status={<StatusPill tone="success" label="Verified" />} />
                <ObjectRow
                  title={data.contact.mobile}
                  meta="Mobile number"
                  status={<StatusPill tone="success" label="Verified" />}
                  last
                />
              </Card>
            </View>

            {/* Account Holder */}
            <View style={styles.section}>
              <Eyebrow>Account holder</Eyebrow>
              <Card>
                <View style={styles.holderHeader}>
                  <Display level="xs">{data.company.authorisedPerson.name}</Display>
                  <Body size="sm" tone="muted">
                    {data.company.authorisedPerson.designation} · Authorized Signatory
                  </Body>
                </View>
                <Divider />
                <ObjectRow title="Government Photo ID" meta="Photo ID submitted" last />
              </Card>
            </View>

            {/* Quick Links */}
            <View style={styles.section}>
              <Eyebrow>Preferences & activity</Eyebrow>
              <Card>
                <ObjectRow
                  title="Notifications inbox"
                  status={<RowChevron />}
                  onPress={() => navigation.navigate('EmployerNotifications')}
                />
                <ObjectRow
                  title="Notification preferences"
                  status={<RowChevron />}
                  onPress={() => navigation.navigate('EmployerNotificationSettings')}
                />
                <ObjectRow
                  title="Connections"
                  status={<RowChevron />}
                  onPress={() => navigation.navigate('EmployerConnections')}
                  last
                />
              </Card>
            </View>

            {/* Sign Out */}
            <Card>
              <ObjectRow
                title={signingOut ? 'Signing out…' : 'Sign out'}
                status={signingOut ? <ActivityIndicator size="small" color={color.textMuted} /> : <RowChevron danger />}
                onPress={signingOut ? undefined : handleSignOut}
                last
              />
            </Card>
          </View>
        ) : error ? (
          <ErrorState
            title="We could not load your account."
            body={error.message}
            action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
          />
        ) : null}
      </ScrollView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space['4xl'],
    gap: space['2xl'],
  },
  content: {
    gap: space.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  naming: {
    flex: 1,
    gap: space.sm,
  },
  section: {
    gap: space.md,
  },
  holderHeader: {
    padding: space.lg,
    gap: space['2xs'],
  },
  verificationCard: {
    padding: space.md,
    gap: space.sm,
  },
})
