import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { tokenStore } from '../../lib/api'
import { getMe, logout, resendVerificationEmail } from '../../lib/api/account'
import { color, space } from '../../theme'
import { Avatar, Button, ErrorState, MenuGroup, MenuRow, ScreenHeader, Skeleton, StatusPill, text } from '../../components/ui'

/**
 * ST-49 — Account. Identity state is shown PER identifier, at the identifier. The
 * one crimson element is Verify on the unverified email. "Delete or export" is an
 * ORDINARY row — not tinted, not red; the destructive control lives on the data
 * screen below its explanation. A student signs in with a mobile OTP, so there is
 * no password to change — the Security section carries only Sign out.
 */
export function AccountScreen({
  onBack, onSignedOut, onReceipts, onVisibility, onNotificationSettings, onData,
  onProfile, onProfileView, onVideos, onApplications, onConnections, onNotifications, onStats,
}: {
  onBack: () => void; onSignedOut: () => void; onReceipts: () => void
  onVisibility: () => void; onNotificationSettings: () => void; onData: () => void
  /** The destinations the dashboard Home no longer lists — reached from here instead. */
  onProfile: () => void; onProfileView: () => void; onVideos: () => void
  onApplications: () => void; onConnections: () => void; onNotifications: () => void; onStats: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['me'], queryFn: () => getMe() })
  const [verify, setVerify] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [signingOut, setSigningOut] = useState(false)

  const bar = <ScreenHeader title="Account" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your account." body="Nothing has changed. Try again in a moment." /></View>)
  const me = q.data!

  async function onVerify() {
    if (!me.email) return
    setVerify('sending')
    try { await resendVerificationEmail(me.email); setVerify('sent') } catch { setVerify('idle') }
  }
  async function onSignOut() {
    setSigningOut(true)
    try { await logout() } catch { /* best-effort; clear locally regardless */ }
    await tokenStore.clear()
    onSignedOut()
  }

  const yours = [
    { label: 'My profile', sub: 'What employers see', onPress: onProfileView },
    { label: 'Finish or edit your profile', sub: 'The six profile steps', onPress: onProfile },
    { label: 'Your videos', sub: 'Your video resume and self-uploads', onPress: onVideos },
    { label: 'My applications', sub: 'Jobs you have applied to', onPress: onApplications },
    { label: 'Connections', sub: 'Employers you are connected with', onPress: onConnections },
    { label: 'Notifications', sub: 'Your inbox', onPress: onNotifications },
    { label: 'Your stats', sub: 'How your profile is doing', onPress: onStats },
  ]

  const more = [
    { label: 'Receipts', sub: 'Payments and invoices', onPress: onReceipts },
    { label: 'Visibility', sub: 'Who can see your profile', onPress: onVisibility },
    { label: 'Notification settings', sub: 'Push, email and in-app', onPress: onNotificationSettings },
    { label: 'Delete or export my data', sub: 'Your legal rights', onPress: onData },
  ]

  const initials = (me.name ?? '').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.who}>
          {!!initials && <Avatar initials={initials} />}
          <View style={styles.whoText}>
            <Text style={text.displaySm} numberOfLines={1}>{me.name ?? 'Your account'}</Text>
            <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{[me.mobile, me.email].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        <MenuGroup label="Your profile">
          {yours.map((m) => <MenuRow key={m.label} title={m.label} sub={m.sub} onPress={m.onPress} />)}
        </MenuGroup>

        <MenuGroup label="Identity">
          <MenuRow
            title={me.email ?? 'No email'}
            sub={me.emailVerified ? 'Email' : 'Email · until it’s verified you can’t pay or book another interview'}
            right={me.emailVerified
              ? <StatusPill tone="success" label="Verified" />
              : me.email
                ? verify === 'sent'
                  ? <StatusPill tone="info" label="Link sent" />
                  : <Button variant="primary" size="sm" busy={verify === 'sending'} label="Verify" onPress={onVerify} />
                : <StatusPill tone="warning" label="Not verified" />}
          />
          <MenuRow
            title={me.mobile ? `+91 ${me.mobile}` : 'No mobile'}
            sub="Mobile · how you sign in"
            right={me.mobileVerified ? <StatusPill tone="success" label="Verified" /> : <StatusPill tone="warning" label="Not verified" />}
          />
        </MenuGroup>

        <MenuGroup label="More">
          {more.map((m) => <MenuRow key={m.label} title={m.label} sub={m.sub} onPress={m.onPress} />)}
        </MenuGroup>

        <MenuGroup>
          <MenuRow title={signingOut ? 'Signing out…' : 'Sign out'} sub="On this device only" onPress={onSignOut} disabled={signingOut} right={null} />
        </MenuGroup>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.xl, paddingBottom: space.xl },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xs },
  whoText: { flex: 1, minWidth: 0, gap: space['2xs'] },
  muted: { color: color.textMuted },
})
