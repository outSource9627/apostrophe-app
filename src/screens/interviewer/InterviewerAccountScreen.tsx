import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvCard, IvLabel, IvStat } from '../../components/interviewer/iv'
import { EmBadge, initialsOf } from '../../components/employer/em'
import { tokenStore } from '../../lib/api'
import { logout } from '../../lib/api/account'
import { formatPaise } from '../../lib/format/money'
import { useForgetInterviewer, useInterviewerIdentity, useInterviewerMe, useInterviewerUnread } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/** '+91 98000 00001'. Anything that is not ten digits is shown as stored. */
const mobileLabel = (m: string) => {
  const d = m.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : m
}

/**
 * Account (no artboard — the drawn screens' language). Name, email and mobile
 * from /auth/me (/interviewers/me carries none); the status and its reason,
 * the domains, languages, tiers with the interviewer's own fee per tier, the
 * load caps, and the figures over the server's window — each drawn only when
 * the server sent it. Links, change password, and a sign-out that ends the
 * session on the server and clears this phone.
 */
export function InterviewerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { me, suspended } = useInterviewerMe()
  const identity = useInterviewerIdentity()
  const unread = useInterviewerUnread()
  const forget = useForgetInterviewer()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
    } catch {
      /* best-effort; the phone is cleared regardless */
    }
    await tokenStore.clear()
    forget()
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
  }

  const p = me?.profile
  const s = me?.stats
  const q = me?.quality
  const fees = p ? (p.tiers ?? []).filter((t) => typeof p.feePaise?.[t] === 'number') : []
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)
  const links: { icon: IconName; label: string; sub?: string; onPress: () => void }[] = [
    { icon: 'note', label: 'Scorecards owed', sub: me?.scorecardsOwed ? `${me.scorecardsOwed.count} open` : undefined, onPress: () => navigation.navigate('PendingScorecards') },
    { icon: 'cal', label: 'Date overrides', sub: 'Days off and one-off hours', onPress: () => navigation.navigate('InterviewerOverrides') },
    { icon: 'bell', label: 'Notifications', sub: unread ? `${unread} unread` : undefined, onPress: () => navigation.navigate('InterviewerNotifications') },
    { icon: 'chat', label: 'Messages', sub: 'Chats with your candidates', onPress: () => navigation.navigate('InterviewerChats') },
    { icon: 'lock', label: 'Change password', onPress: () => navigation.navigate('InterviewerPassword', {}) },
  ]

  return (
    <InterviewerShell title="Account">
      <IvCard>
        <View style={styles.head}>
          <View style={styles.disc}><Text style={[text.uiLeadSemi, styles.onInk]}>{initialsOf(identity?.name)}</Text></View>
          <View style={styles.grow}>
            <Text style={text.uiLgSemi}>{identity?.name ?? 'Interviewer'}</Text>
            {me && <EmBadge label={suspended ? 'Suspended' : 'Active'} tone={suspended ? 'red' : 'green'} small />}
          </View>
        </View>
        {suspended && !!me?.statusReason && <Text style={[text.uiXs, styles.danger]}>{me.statusReason}</Text>}
      </IvCard>

      <View>
        {!!identity?.email && <Fact k="EMAIL" v={identity.email} />}
        {!!identity?.mobile && <Fact k="MOBILE" v={mobileLabel(identity.mobile)} />}
        {!!p?.domains?.length && <Fact k="DOMAINS" v={p.domains.join(', ')} />}
        {!!p?.languages?.length && <Fact k="LANGUAGES" v={p.languages.join(', ')} />}
        {(p?.loadCaps?.perDay != null || p?.loadCaps?.perWeek != null) && (
          <Fact k="LOAD CAP" v={[p?.loadCaps?.perDay != null ? `${p.loadCaps.perDay} a day` : null, p?.loadCaps?.perWeek != null ? `${p.loadCaps.perWeek} a week` : null].filter(Boolean).join(' · ')} />
        )}
      </View>

      {fees.length > 0 && (
        <IvCard>
          <IvLabel>YOUR FEE PER INTERVIEW</IvLabel>
          <View style={styles.fees}>
            {fees.map((t) => (
              <View key={t} style={styles.fee}>
                <Text style={[text.metaSm, styles.muted, styles.mono]}>{t}</Text>
                <Text style={[text.metaXl, styles.fig]}>{formatPaise(p!.feePaise![t]!)}</Text>
              </View>
            ))}
          </View>
        </IvCard>
      )}

      {!!s && (
        <>
          <IvLabel style={styles.section}>{`LAST ${s.windowDays} DAYS`}</IvLabel>
          <View style={styles.row}>
            <IvStat k="CONDUCTED" v={String(s.conducted)} />
            <IvStat k="COMPLETION" v={pct(s.completionPct)} tone={s.completionPct != null ? 'success' : 'ink'} />
          </View>
          <View style={styles.row}>
            <IvStat k="ON-TIME" v={pct(s.onTimeScorecardPct)} tone={s.onTimeScorecardPct != null ? 'success' : 'ink'} />
            {s.assigned > 0 && q ? <IvStat k="NO-SHOWS" v={String(q.noShows)} /> : <View style={styles.flex} />}
          </View>
        </>
      )}

      <View style={styles.links}>
        {links.map((l) => (
          <Pressable key={l.label} accessibilityRole="button" onPress={l.onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <View style={styles.linkIcon}><Icon name={l.icon} size={space.lg + 2} tint={color.textSecondary} /></View>
            <View style={styles.grow}>
              <Text style={text.uiMdSemi}>{l.label}</Text>
              {!!l.sub && <Text style={[text.uiXs, styles.muted]}>{l.sub}</Text>}
            </View>
            <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
          </Pressable>
        ))}
      </View>

      <Button variant="outline" size="cta" icon="out" label="Sign out" busy={signingOut} onPress={() => { signOut() }} />
    </InterviewerShell>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[text.metaSm, styles.muted, styles.mono]}>{k}</Text>
      <Text style={text.uiBase}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: spaceHalf['1.5'] },
  flex: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  onInk: { color: color.textInverse },
  mono: { letterSpacing: trackingNative.eyebrow },
  fig: { letterSpacing: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  disc: { width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill, backgroundColor: color.inkRaised, alignItems: 'center', justifyContent: 'center' },
  fact: { gap: space['2xs'] + 1, paddingVertical: spaceHalf['2.5'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  fees: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  fee: { gap: space['2xs'] },
  section: { marginTop: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  links: { gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  linkIcon: { width: height.avatar, height: height.avatar, borderRadius: radius.tile, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
})
