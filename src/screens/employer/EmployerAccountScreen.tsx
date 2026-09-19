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

export function EmployerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [data, setData] = useState<EmployerMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getEmployerMe()
      setData(res)
    } catch (err) {
      console.error('Failed to load employer account', err)
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
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={color.ink} />
            <Text style={styles.loadingText}>Loading account…</Text>
          </View>
        ) : data ? (
          <View style={styles.content}>
            {/* Suspended Alert */}
            {isSuspended && (
              <View style={styles.suspendedBox}>
                <Text style={styles.suspendedTag}>ACCOUNT SUSPENDED</Text>
                <Text style={styles.suspendedTitle}>{data.company.name}</Text>
                <Text style={styles.suspendedText}>
                  While the suspension lasts, candidate browsing, job applications, messaging, and new Interests are frozen.
                </Text>
              </View>
            )}

            {/* Pending Review Alert */}
            {isPending && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('EmployerStatus')}
                style={styles.pendingBox}
              >
                <View style={styles.pendingTop}>
                  <Text style={styles.pendingTitle}>In review</Text>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Pending review</Text>
                  </View>
                </View>
                <Text style={styles.pendingText}>
                  Your verification documents are under review. Candidates and chat open once approved.
                </Text>
              </TouchableOpacity>
            )}

            {/* Verification Card */}
            <View style={styles.verificationCard}>
              <View style={styles.cardHeader}>
                <View style={styles.shieldIcon}>
                  <Text style={styles.shieldText}>✓</Text>
                </View>
                <View style={styles.companyInfo}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.companyName}>{data.company.name}</Text>
                    <View
                      style={[
                        styles.badgePill,
                        isVerified ? styles.verifiedPill : styles.pendingPill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgePillText,
                          isVerified ? styles.verifiedPillText : styles.pendingPillText,
                        ]}
                      >
                        {isVerified ? 'Verified Employer' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sinceText}>
                    {data.verification.approvedAt
                      ? `Since ${formatApprovedDate(data.verification.approvedAt)}`
                      : 'Verification pending'}
                  </Text>
                </View>
              </View>

              <Text style={styles.metaRow}>
                {[data.company.industry, data.company.size, data.company.officeLocation]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              <View style={styles.hairline} />

              <Text style={styles.badgeExplainer}>
                Verified employers have submitted company PAN, registration documents, and an authorized signatory's government photo ID. Students see this seal next to every communication from your team.
              </Text>
            </View>

            {/* Sign-in & Security */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SIGN-IN & SECURITY</Text>
              <View style={styles.listCard}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>WORK EMAIL</Text>
                    <Text style={styles.fieldVal}>{data.contact.email}</Text>
                  </View>
                  <View style={styles.verifiedSmallPill}>
                    <Text style={styles.verifiedSmallPillText}>Verified</Text>
                  </View>
                </View>

                <View style={[styles.fieldRow, styles.rowBorder]}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                    <Text style={styles.fieldVal}>{data.contact.mobile}</Text>
                  </View>
                  <View style={styles.verifiedSmallPill}>
                    <Text style={styles.verifiedSmallPillText}>Verified</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Account Holder */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACCOUNT HOLDER</Text>
              <View style={styles.listCard}>
                <View style={styles.holderHeader}>
                  <Text style={styles.holderName}>{data.company.authorisedPerson.name}</Text>
                  <Text style={styles.holderDesignation}>
                    {data.company.authorisedPerson.designation} · Authorized Signatory
                  </Text>
                </View>

                <View style={[styles.fieldRow, styles.rowBorder]}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>PHOTO ID SUBMITTED</Text>
                    <Text style={styles.fieldVal}>Government Photo ID</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick Links */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PREFERENCES & ACTIVITY</Text>
              <View style={styles.listCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('EmployerNotifications')}
                  style={styles.linkRow}
                >
                  <Text style={styles.linkText}>Notifications inbox</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('EmployerNotificationSettings')}
                  style={[styles.linkRow, styles.rowBorder]}
                >
                  <Text style={styles.linkText}>Notification preferences</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('EmployerConnections')}
                  style={[styles.linkRow, styles.rowBorder]}
                >
                  <Text style={styles.linkText}>Connections</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Out */}
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={signingOut}
              onPress={handleSignOut}
              style={styles.signOutBtn}
            >
              <Text style={styles.signOutBtnText}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
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
  content: {
    gap: space.lg,
  },
  suspendedBox: {
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#E4CDC9',
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  suspendedTag: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: color.accent,
  },
  suspendedTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    fontWeight: 'bold',
    color: color.text,
  },
  suspendedText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    lineHeight: 18,
    color: color.text,
  },
  pendingBox: {
    backgroundColor: '#EFF8FF',
    borderWidth: 1,
    borderColor: '#B2DDFF',
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  pendingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#175CD3',
  },
  pendingText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  verificationCard: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    gap: space.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 20,
    fontWeight: 'bold',
    color: color.accent,
  },
  companyInfo: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  companyName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 17,
    fontWeight: 'bold',
    color: color.text,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgePillText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '600',
  },
  verifiedPill: {
    backgroundColor: '#ECFDF3',
  },
  verifiedPillText: {
    color: '#027A48',
  },
  pendingPill: {
    backgroundColor: '#FEF0C7',
  },
  pendingPillText: {
    color: '#B54708',
  },
  sinceText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  metaRow: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  hairline: {
    height: 1,
    backgroundColor: color.border,
  },
  badgeExplainer: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    lineHeight: 18,
    color: color.textMuted,
  },
  section: {
    gap: space.xs,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    color: color.textSubtle,
    letterSpacing: 0.5,
  },
  listCard: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  fieldInfo: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  fieldVal: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.text,
  },
  verifiedSmallPill: {
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  verifiedSmallPillText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '600',
    color: '#027A48',
  },
  holderHeader: {
    padding: space.md,
    gap: 2,
  },
  holderName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    fontWeight: 'bold',
    color: color.text,
  },
  holderDesignation: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
  },
  linkText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.text,
  },
  chevron: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textSubtle,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: '#E4CDC9',
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: space.sm,
  },
  signOutBtnText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.accent,
  },
})
