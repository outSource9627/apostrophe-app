import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { tokenStore } from '../../lib/api'
import { getMe, logout, resendVerificationEmail } from '../../lib/api/account'
import { color, space, borderWidth } from '../../theme'
import { AppBar, Body, Button, Card, Display, Eyebrow, Meta, StatusPill } from '../../components/ui'

/**
 * ST-49 — Account. Identity state is shown PER identifier, at the identifier. The
 * one crimson element is Verify on the unverified email. "Delete or export" is an
 * ORDINARY row — not tinted, not red; the destructive control lives on the data
 * screen below its explanation. A student signs in with a mobile OTP, so there is
 * no password to change — the Security section carries only Sign out.
 */
export function AccountScreen({ onBack, onSignedOut, onReceipts, onVisibility, onNotificationSettings, onData }: {
  onBack: () => void; onSignedOut: () => void; onReceipts: () => void
  onVisibility: () => void; onNotificationSettings: () => void; onData: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['me'], queryFn: () => getMe() })
  const [verify, setVerify] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [signingOut, setSigningOut] = useState(false)

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your account.</Body></View>)
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

  const more = [
    { label: 'Receipts', sub: 'Payments and invoices', onPress: onReceipts },
    { label: 'Visibility', sub: 'Who can see your profile', onPress: onVisibility },
    { label: 'Notifications', sub: 'Push, email and in-app', onPress: onNotificationSettings },
    { label: 'Delete or export my data', sub: 'Your legal rights', onPress: onData },
  ]

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Account</Display>

        <View style={{ gap: space.md }}>
          <Eyebrow>Identity</Eyebrow>
          <Identifier label="Email" value={me.email ?? '—'} verified={me.emailVerified}
            reason={me.emailVerified ? undefined : 'Until it’s verified you can’t pay or book another interview.'}
            action={!me.emailVerified && me.email
              ? verify === 'sent'
                ? <Meta style={{ color: color.success }}>Verification link sent</Meta>
                : <Button variant="primary" size="md" busy={verify === 'sending'} label="Verify" onPress={onVerify} />
              : undefined} />
          <Identifier label="Mobile" value={me.mobile ?? '—'} verified={me.mobileVerified} />
        </View>

        <View style={{ gap: space.md }}>
          <Eyebrow>Security</Eyebrow>
          <Card style={styles.group}>
            <Row title="Sign out" sub="On this device only" onPress={onSignOut} busy={signingOut} last />
          </Card>
        </View>

        <View style={{ gap: space.md }}>
          <Eyebrow>More</Eyebrow>
          <Card style={styles.group}>
            {more.map((m, i) => <Row key={m.label} title={m.label} sub={m.sub} onPress={m.onPress} last={i === more.length - 1} />)}
          </Card>
        </View>
      </ScrollView>
    </View>
  )
}

function Identifier({ label, value, verified, reason, action }: {
  label: string; value: string; verified?: boolean; reason?: string; action?: React.ReactNode
}) {
  return (
    <Card style={styles.identifier}>
      <Eyebrow>{label}</Eyebrow>
      <Body size="base">{value}</Body>
      <View style={{ alignSelf: 'flex-start' }}>{verified ? <StatusPill tone="success" label="Verified" /> : <StatusPill tone="warning" label="Not verified" />}</View>
      {!!reason && <Body size="xs" tone="muted">{reason}</Body>}
      {!!action && <View style={{ marginTop: space.xs, alignSelf: 'flex-start' }}>{action}</View>}
    </Card>
  )
}

function Row({ title, sub, onPress, busy, last }: { title: string; sub?: string; onPress: () => void; busy?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.row, last ? null : styles.rowBorder]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body size="lg">{title}</Body>
        {!!sub && <Body size="xs" tone="muted">{sub}</Body>}
      </View>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="m9 5 7 7-7 7" /></Svg>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  identifier: { padding: space.lg, gap: space.sm },
  group: { overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
})
