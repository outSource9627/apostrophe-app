import React, { useState } from 'react'
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { tokenStore } from '../../lib/api'
import { getMe, logout, resendVerificationEmail } from '../../lib/api/account'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { StatusPill } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { ChatButton } from '../../components/tab/ChatButton'
import { CompactBar, GroupLabel, LargeTitle, Skel, StateBlock, useCollapsingTitle } from '../../components/tab/kit'

/**
 * ST-49 — Account, the Profile tab, as the signed-off mockup draws it
 * (docs/interviews-profile-chat-final.html). Identity state is shown PER
 * identifier, at the identifier. The one violet button is Verify on the
 * unverified email. "Delete or export" is an ORDINARY row — not tinted, not red;
 * the destructive control lives on the data screen below its explanation. A
 * student signs in with a mobile OTP, so there is no password to change — the
 * Security section carries only Sign out.
 */
export function AccountScreen({
  onSignedOut, onReceipts, onVisibility, onNotificationSettings, onData,
  onProfile, onProfileView, onVideos, onApplications, onConnections, onNotifications, onStats, onChat,
}: {
  /** Profile is a tab now: there is nothing to go back to. Kept optional so the route's wiring does not change. */
  onBack?: () => void
  onSignedOut: () => void; onReceipts: () => void
  onVisibility: () => void; onNotificationSettings: () => void; onData: () => void
  /** The destinations the dashboard Home no longer lists — reached from here instead. */
  onProfile: () => void; onProfileView: () => void; onVideos: () => void
  onApplications: () => void; onConnections: () => void; onNotifications: () => void; onStats: () => void
  onChat: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['me'], queryFn: () => getMe() })
  const [verify, setVerify] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [signingOut, setSigningOut] = useState(false)
  const title = useCollapsingTitle()

  const frame = (c: React.ReactNode) => (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <LargeTitle title="Account" right={<ChatButton onPress={onChat} />} />
      {c}
    </View>
  )
  if (q.isPending) {
    return frame(
      <View style={s.pad}>
        <View style={s.who}>
          <Skel w={60} h={60} round />
          <View style={s.skelText}><Skel w="50%" h={18} /><Skel w="80%" h={12} /></View>
        </View>
        <View style={{ marginTop: 22 }}><Skel w="100%" h={340} /></View>
      </View>,
    )
  }
  if (q.isError) {
    return frame(<StateBlock icon="alert" title="Could not load your account." body="Nothing has changed. Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)
  }
  const me = q.data!

  async function onVerify() {
    if (!me.email) return
    setVerify('sending')
    try { await resendVerificationEmail(me.email); setVerify('sent') } catch { setVerify('idle') }
  }

  function onSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true)
            try { await logout() } catch { /* best-effort; clear locally regardless */ }
            await tokenStore.clear()
            onSignedOut()
          },
        },
      ],
    )
  }

  const yours: Row[] = [
    { icon: 'user', label: 'My profile', sub: 'What employers see', onPress: onProfileView },
    { icon: 'edit', label: 'Finish or edit your profile', sub: 'The six profile steps', onPress: onProfile },
    { icon: 'video', label: 'Your videos', sub: 'Your video resume and self-uploads', onPress: onVideos },
    { icon: 'file', label: 'My applications', sub: 'Jobs you have applied to', onPress: onApplications },
    { icon: 'heart', label: 'Connections', sub: 'Employers you are connected with', onPress: onConnections },
    { icon: 'bell', label: 'Notifications', sub: 'Your inbox', onPress: onNotifications },
    { icon: 'star', label: 'Your stats', sub: 'How your profile is doing', onPress: onStats },
  ]
  const more: Row[] = [
    { icon: 'card', label: 'Receipts', sub: 'Payments and invoices', onPress: onReceipts },
    { icon: 'eye', label: 'Visibility', sub: 'Who can see your profile', onPress: onVisibility },
    { icon: 'sliders', label: 'Notification settings', sub: 'Push, email and in-app', onPress: onNotificationSettings },
    { icon: 'shield', label: 'Delete or export my data', sub: 'Your legal rights', onPress: onData },
  ]

  const initials = (me.name ?? '').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const emailRight = me.emailVerified
    ? <StatusPill tone="success" label="Verified" />
    : me.email
      ? verify === 'sent'
        ? <StatusPill tone="info" label="Link sent" />
        : (
          <Pressable
            accessibilityRole="button"
            disabled={verify === 'sending'}
            onPress={onVerify}
            style={({ pressed }) => [s.verifyBtn, (pressed || verify === 'sending') && s.pressed]}
          >
            <Text style={s.verifyText}>{verify === 'sending' ? 'Sending…' : 'Verify'}</Text>
          </Pressable>
        )
      : <StatusPill tone="warning" label="Not verified" />

  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <CompactBar title="Account" opacity={title.barOpacity} />
      <Animated.ScrollView onScroll={title.onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <LargeTitle title="Account" right={<ChatButton onPress={onChat} />} />

        <View style={[s.pad, s.who]}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials || '·'}</Text></View>
          <View style={s.whoText}>
            <Text style={s.name} numberOfLines={1}>{me.name ?? 'Your account'}</Text>
            <Text style={s.contact} numberOfLines={2}>{[me.mobile, me.email].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        <GroupLabel style={s.label}>Your profile</GroupLabel>
        <View style={s.pad}><Menu rows={yours} /></View>

        <GroupLabel style={s.label}>Identity</GroupLabel>
        <View style={s.pad}>
          <View style={s.menu}>
            <View style={[s.mrow, s.rule]}>
              <View style={s.grow}>
                <Text style={s.mTitle} numberOfLines={1}>{me.email ?? 'No email'}</Text>
                <Text style={s.mSub}>{me.emailVerified ? 'Email' : 'Email · until it’s verified you can’t pay or book another interview'}</Text>
              </View>
              {emailRight}
            </View>
            <View style={s.mrow}>
              <View style={s.grow}>
                <Text style={s.mTitle}>{me.mobile ? `+91 ${me.mobile}` : 'No mobile'}</Text>
                <Text style={s.mSub}>Mobile · how you sign in</Text>
              </View>
              {me.mobileVerified ? <StatusPill tone="success" label="Verified" /> : <StatusPill tone="warning" label="Not verified" />}
            </View>
          </View>
        </View>

        <GroupLabel style={s.label}>More</GroupLabel>
        <View style={s.pad}><Menu rows={more} plain /></View>

        <View style={[s.pad, s.signOut]}>
          <View style={[s.menu, s.menuDanger]}>
            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              onPress={onSignOut}
              style={({ pressed }) => [s.mrow, pressed && s.pressedRow]}
            >
              <Icon name="out" size={20} tint={color.danger} weight={1.9} />
              <View style={s.grow}>
                <Text style={[s.mTitle, s.mTitleDanger]}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
                <Text style={s.mSub}>On this device only</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  )
}

interface Row { icon: IconName; label: string; sub: string; onPress: () => void }

function Menu({ rows, plain }: { rows: Row[]; plain?: boolean }) {
  return (
    <View style={s.menu}>
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          accessibilityRole="button"
          onPress={r.onPress}
          style={({ pressed }) => [s.mrow, i < rows.length - 1 && s.rule, pressed && s.pressedRow]}
        >
          <View style={[s.icon, plain && s.iconPlain]}>
            <Icon name={r.icon} size={20} tint={plain ? color.textSecondary : color.accent} />
          </View>
          <View style={s.grow}>
            <Text style={s.mTitle}>{r.label}</Text>
            <Text style={s.mSub}>{r.sub}</Text>
          </View>
          <Icon name="chevR" size={18} tint={color.textSubtle} />
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  content: { paddingBottom: 130 },
  pad: { paddingHorizontal: 20 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  pressedRow: { backgroundColor: color.surfaceMuted },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  whoText: { flex: 1, minWidth: 0 },
  skelText: { flex: 1, gap: 9 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: color.accentDeep, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FF.bodyBold, fontSize: 20, color: color.textInverse },
  name: { fontFamily: FF.bodyBold, fontSize: 22, letterSpacing: -0.66, color: color.text },
  contact: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted },
  label: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  menu: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, overflow: 'hidden' },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconPlain: { backgroundColor: color.surfaceMuted },
  mTitle: { fontFamily: FF.bodySemiBold, fontSize: 16, letterSpacing: -0.16, color: color.text },
  mTitleDanger: { color: color.danger },
  menuDanger: { borderColor: color.dangerBorder },
  mSub: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 18, color: color.textMuted, marginTop: 1 },
  verifyBtn: { height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  verifyText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.textInverse },
  signOut: { marginTop: 22 },
})
