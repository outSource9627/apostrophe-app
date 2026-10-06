import React, { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Linking } from 'react-native'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { tokenStore } from '../../lib/api'
import { logout } from '../../lib/api/account'
import { formatPaise } from '../../lib/format/money'
import { initialsFrom, mobileLabel, webUrl } from '../../lib/interviewer/profile'
import { useForgetInterviewer, useInterviewerIdentity, useInterviewerMe, useInterviewerUnread } from '../../lib/interviewer/useInterviewer'
import { AcBadge, AcCard, AcDisc, AcHeading, AcKV, AcList, AcNotice, AcPill, AcRow, AcSkel, noticeText } from './accountKit'
import pkg from '../../../package.json'
import type { RootStackParamList } from '../../../App'

/**
 * Account (docs/interviewer-account-mockup.html, option A): the identity card,
 * the facts, the fee per tier and the last-N-days figures — each drawn only when
 * the server sent it — then the grouped menu (Your profile, Work, Settings, Help)
 * and a sign-out that ends the session on the server and clears this phone.
 * Name, email and mobile come from /auth/me; the profile, status and its reason
 * from /interviewers/me.
 */
export function InterviewerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { me, suspended, loading, error, mustChangePassword, refresh } = useInterviewerMe()
  const identity = useInterviewerIdentity()
  const unread = useInterviewerUnread()
  const forget = useForgetInterviewer()
  const [signingOut, setSigningOut] = useState(false)

  function signOut() {
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
            try {
              await logout()
            } catch {
              /* best-effort; the phone is cleared regardless */
            }
            await tokenStore.clear()
            forget()
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
          },
        },
      ]
    )
  }

  const p = me?.profile
  const s = me?.stats
  const q = me?.quality
  const name = p?.name || identity?.name || 'Interviewer'
  const fees = p ? (p.tiers ?? []).filter((t) => typeof p.feePaise?.[t] === 'number') : []
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)
  const loadCap = [p?.loadCaps?.perDay != null ? `${p.loadCaps.perDay} a day` : null, p?.loadCaps?.perWeek != null ? `${p.loadCaps.perWeek} a week` : null].filter(Boolean).join(' · ')
  const facts: { icon: IconName; label: string; value: string }[] = [
    !!identity?.email && { icon: 'mail' as IconName, label: 'Email', value: identity.email },
    !!identity?.mobile && { icon: 'phone' as IconName, label: 'Mobile', value: mobileLabel(identity.mobile) },
    !!p?.domains?.length && { icon: 'tag' as IconName, label: 'Domains', value: p.domains.join(', ') },
    !!p?.languages?.length && { icon: 'globe' as IconName, label: 'Languages', value: p.languages.join(', ') },
    !!loadCap && { icon: 'pie' as IconName, label: 'Load cap', value: loadCap },
  ].filter(Boolean) as { icon: IconName; label: string; value: string }[]
  const tiles: { icon: IconName; label: string; value: string; tone?: 'ok' | 'dim' }[] = s
    ? [
        { icon: 'checkCircle', label: 'Conducted', value: String(s.conducted) },
        { icon: 'pie', label: 'Completion', value: pct(s.completionPct), tone: s.completionPct != null ? 'ok' : 'dim' },
        { icon: 'clock', label: 'On-time', value: pct(s.onTimeScorecardPct), tone: s.onTimeScorecardPct != null ? 'ok' : 'dim' },
        ...(s.assigned > 0 && q ? [{ icon: 'x' as IconName, label: 'No-shows', value: String(q.noShows) }] : []),
      ]
    : []

  const go = (route: keyof RootStackParamList, params?: object) => () => (navigation.navigate as (...x: unknown[]) => void)(route, params)
  const openWeb = (path: string) => () => { void Linking.openURL(webUrl(path)).catch(() => undefined) }

  const groups: { title: string; rows: { icon: IconName; title: string; sub?: string; onPress?: () => void; external?: boolean; value?: string }[] }[] = [
    {
      title: 'Your profile',
      rows: [
        { icon: 'edit', title: 'Edit profile', sub: 'Name, photo, languages, bio', onPress: go('InterviewerEditProfile') },
        { icon: 'shield', title: 'Contact and verification', sub: 'Email and mobile', onPress: go('InterviewerContact') },
      ],
    },
    {
      title: 'Work',
      rows: [
        { icon: 'note', title: 'Scorecards owed', sub: me?.scorecardsOwed ? `${me.scorecardsOwed.count} open` : undefined, onPress: go('PendingScorecards') },
        { icon: 'cal', title: 'Date overrides', sub: 'Days off and one-off hours', onPress: go('InterviewerOverrides') },
        { icon: 'bell', title: 'Notifications', sub: unread ? `${unread} unread` : undefined, onPress: go('InterviewerNotifications') },
        { icon: 'chat', title: 'Messages', sub: 'Chats with your candidates', onPress: go('InterviewerChats') },
      ],
    },
    {
      title: 'Settings',
      rows: [
        { icon: 'sliders', title: 'Notification settings', sub: 'Push, email and in-app', onPress: go('InterviewerNotifSettings') },
        { icon: 'lock', title: 'Change password', onPress: go('InterviewerPassword', {}) },
        { icon: 'download', title: 'Your data', sub: 'Export or delete my data', onPress: go('InterviewerData') },
      ],
    },
    {
      title: 'Help',
      rows: [
        { icon: 'info', title: 'Help and support', sub: 'Talk to support', onPress: go('InterviewerHelp') },
        { icon: 'file', title: 'Terms of Service', onPress: openWeb('/terms'), external: true },
        { icon: 'eye', title: 'Privacy Policy', onPress: openWeb('/privacy'), external: true },
        { icon: 'info', title: 'App version', value: pkg.version },
      ],
    },
  ]

  if (loading && !me) {
    return (
      <InterviewerShell title="Account" contentGap="sm">
        <AcCard gap={0}>
          <View style={st.idRow}>
            <AcSkel h={52} w={52} r={26} />
            <View style={[st.grow, { gap: 8 }]}><AcSkel h={18} w="55%" /><AcSkel h={18} w="28%" r={99} /></View>
          </View>
        </AcCard>
        <AcList>{[0, 1, 2].map((i) => <View key={i} style={[st.skelKv, i < 2 && st.rule]}><AcSkel h={12} w="30%" /><AcSkel h={16} w="70%" /></View>)}</AcList>
        <View style={st.grid}><View style={st.cell}><AcSkel h={78} r={16} /></View><View style={st.cell}><AcSkel h={78} r={16} /></View></View>
        <AcList>{[0, 1, 2].map((i) => <View key={i} style={[st.skelRow, i < 2 && st.rule]}><AcSkel h={34} w={34} r={11} /><View style={st.grow}><AcSkel h={16} w="50%" /></View></View>)}</AcList>
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell title="Account" contentGap="md">
      <View style={[st.content, signingOut && st.busy]} pointerEvents={signingOut ? 'none' : 'auto'}>
        {!!error && !me && !mustChangePassword && (
          <AcNotice tone="info">
            <Text style={noticeText('info')}>
              <Text style={st.bold}>Couldn’t load your account.</Text>{' Nothing was changed. '}
              <Text accessibilityRole="button" onPress={() => { void refresh() }} style={st.retry}>Try again</Text>
            </Text>
          </AcNotice>
        )}

        <AcCard gap={0}>
          <View style={st.idRow}>
            <AcDisc size={52} initials={initialsFrom(p?.name || identity?.name)} uri={p?.avatarUrl} />
            <View style={st.grow}>
              <Text style={st.name} numberOfLines={1}>{name}</Text>
              {me && <View style={st.badgeGap}><AcBadge label={suspended ? 'Suspended' : 'Active'} tone={suspended ? 'red' : 'green'} /></View>}
            </View>
          </View>
          {suspended && !!me?.statusReason && (
            <View style={st.reason}><Text style={st.reasonText}>{me.statusReason}</Text></View>
          )}
        </AcCard>

        {facts.length > 0 && (
          <AcList>{facts.map((f, i) => <AcKV key={f.label} icon={f.icon} label={f.label} value={f.value} last={i === facts.length - 1} />)}</AcList>
        )}

        {fees.length > 0 && (
          <>
            <AcHeading>Your fee per interview</AcHeading>
            <AcList>
              <View style={st.fees}>
                {fees.map((t, i) => (
                  <View key={t} style={[st.fee, i < fees.length - 1 && st.feeRule]}>
                    <Text style={st.tier}>{t}</Text>
                    <Text style={st.feeValue}>{formatPaise(p!.feePaise![t]!)}</Text>
                  </View>
                ))}
              </View>
            </AcList>
          </>
        )}

        {!!s && (
          <>
            <AcHeading>{`Last ${s.windowDays} days`}</AcHeading>
            <View style={st.grid}>
              {tiles.map((t) => (
                <View key={t.label} style={st.cell}>
                  <View style={st.tile}>
                    <View style={st.tileHead}><Icon name={t.icon} size={16} tint={color.textMuted} weight={1.9} /><Text style={st.tileLabel}>{t.label}</Text></View>
                    <Text style={[st.fig, t.tone === 'ok' && { color: color.success }, t.tone === 'dim' && { color: color.textSubtle }]} numberOfLines={1}>{t.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {groups.map((g) => (
          <React.Fragment key={g.title}>
            <AcHeading>{g.title}</AcHeading>
            <AcList>
              {g.rows.map((r, i) => <AcRow key={r.title} icon={r.icon} title={r.title} sub={r.sub} onPress={r.onPress} external={r.external} value={r.value} last={i === g.rows.length - 1} />)}
            </AcList>
          </React.Fragment>
        ))}

        <AcPill tone="danger" icon="out" label="Sign out" busy={signingOut} busyLabel="Signing out…" onPress={signOut} />
      </View>
    </InterviewerShell>
  )
}

const st = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  content: { gap: 12 },
  busy: { opacity: 0.55 },
  bold: { fontFamily: FF.bodyBold },
  retry: { fontFamily: FF.bodyBold, color: color.accent },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  name: { fontFamily: FF.bodyBold, fontSize: 19, lineHeight: 23, letterSpacing: -0.57, color: color.text },
  badgeGap: { marginTop: 4 },
  reason: { backgroundColor: color.dangerSoft, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginTop: 10 },
  reasonText: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.danger },
  fees: { flexDirection: 'row' },
  fee: { flex: 1, minWidth: 0, paddingTop: 11, paddingBottom: 12, paddingHorizontal: 16 },
  feeRule: { borderRightWidth: borderWidth.thin, borderRightColor: color.border },
  tier: { fontFamily: FF.bodyMedium, fontSize: 12, color: color.textMuted },
  feeValue: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.66, color: color.text, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47.8%', flexGrow: 1, flexBasis: '47%', maxWidth: '48.5%' },
  tile: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, paddingTop: 12, paddingBottom: 13, paddingHorizontal: 14 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { fontFamily: FF.bodyMedium, fontSize: 13, color: color.textMuted },
  fig: { fontFamily: FF.bodyBold, fontSize: 25, lineHeight: 26, letterSpacing: -1, color: color.text, marginTop: 5 },
  skelKv: { gap: 8, paddingTop: 9, paddingBottom: 10, paddingHorizontal: 16 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 14, minHeight: 58 },
})
