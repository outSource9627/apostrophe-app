import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import {
  CATEGORY_LABELS, CHANNEL_ORDER, getNotificationPrefs, putNotificationPrefs,
  type NotificationCategory, type NotificationChannel, type PrefRow,
} from '../../lib/api/account'
import { AcBadge, AcErrorBlock, AcHeading, AcList, AcNotice, AcPage, AcSkel, AcSwitch, noticeText } from './accountKit'
import type { RootStackParamList } from '../../../App'

/** The kinds that cannot be switched off, with the interviewer's own line for each. */
const LOCKED: { category: NotificationCategory; line: string }[] = [
  { category: 'ACCOUNT', line: 'Sign-ins and changes to your account.' },
  { category: 'PAYMENT', line: 'Payouts, credits and statements.' },
  { category: 'INTERVIEW', line: 'Interviews assigned or moved, and scorecards due.' },
]
/** Interviewer events exist for these two only; interests, applications and job posts are not listed. */
const CHOOSE: { category: NotificationCategory; line: string }[] = [
  { category: 'MESSAGE', line: 'New messages in an open chat' },
  { category: 'MARKETING', line: 'Occasional, never more than monthly' },
]
const channelHead = (c: NotificationChannel) => (c === 'IN_APP' ? 'In-app' : c)
const KEY = ['notification-prefs']

/**
 * Notification settings (docs/interviewer-account-mockup.html, screen 3): the
 * same GET/PUT /me/notification-prefs the student screen uses, narrowed to what
 * an interviewer can receive. Account, payment and interview cannot be switched
 * off, so they are drawn as "All channels", never as a disabled switch.
 */
export function InterviewerNotifSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const [failed, setFailed] = useState(false)
  const q = useQuery({ queryKey: KEY, queryFn: () => getNotificationPrefs() })
  const put = useMutation({
    mutationFn: (change: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean }) => putNotificationPrefs([change]),
    onMutate: async (c) => {
      setFailed(false)
      await qc.cancelQueries({ queryKey: KEY })
      qc.setQueryData<PrefRow[]>(KEY, (rows) => rows?.map((r) => (r.category === c.category ? { ...r, channels: { ...r.channels, [c.channel]: c.enabled } } : r)))
    },
    onSuccess: (rows) => qc.setQueryData(KEY, rows),
    onError: () => { setFailed(true); void qc.invalidateQueries({ queryKey: KEY }) },
  })

  let body: React.ReactNode
  if (q.isPending) {
    body = <View style={st.gap}>{[0, 1, 2, 3].map((i) => <AcSkel key={i} h={86} r={16} />)}</View>
  } else if (q.isError) {
    body = <AcErrorBlock title="Could not load your settings." body="Nothing was changed. Try again in a moment." onRetry={() => { void q.refetch() }} />
  } else {
    const rows = q.data!
    const by = (c: NotificationCategory) => rows.find((r) => r.category === c)
    const locked = LOCKED.filter((l) => !!by(l.category))
    const choose = CHOOSE.filter((l) => !!by(l.category))
    body = (
      <>
        <Text style={st.lede}>Choose how each kind of message reaches you.</Text>
        {failed && <AcNotice tone="error"><Text style={noticeText('error')}><Text style={st.bold}>Couldn’t save that change.</Text>{' The switch went back. Try again.'}</Text></AcNotice>}
        <AcHeading>Always on</AcHeading>
        <AcList>
          {locked.map((l, i) => (
            <View key={l.category} style={[st.ar, i > 0 && st.top]}>
              <View style={st.grow}><Text style={st.title}>{CATEGORY_LABELS[l.category]}</Text><Text style={st.sub}>{l.line}</Text></View>
              <AcBadge label="All channels" tone="gray" />
            </View>
          ))}
        </AcList>
        <Text style={st.note}>We always send these. They carry money, a booked time, or your account’s security, so they aren’t ours to switch off.</Text>
        <AcHeading>You choose</AcHeading>
        <AcList>
          <View style={st.nh}>
            <View style={st.grow} />
            {CHANNEL_ORDER.map((c) => <Text key={c} style={st.col}>{channelHead(c)}</Text>)}
          </View>
          {choose.map((l) => {
            const r = by(l.category)!
            return (
              <View key={l.category} style={st.nr}>
                <View style={st.lab}><Text style={st.title}>{CATEGORY_LABELS[l.category]}</Text><Text style={st.sub}>{l.line}</Text></View>
                {CHANNEL_ORDER.map((c) => (
                  <View key={c} style={st.cell}>
                    {r.available?.[c] === false
                      ? <Text style={st.dash}>—</Text>
                      : <AcSwitch on={r.channels[c]} label={`${channelHead(c)} for ${CATEGORY_LABELS[l.category]}`} onChange={(v) => put.mutate({ category: l.category, channel: c, enabled: v })} />}
                  </View>
                ))}
              </View>
            )
          })}
        </AcList>
      </>
    )
  }

  return <AcPage title="Notification settings" sub="Push, email and in-app" onBack={() => navigation.goBack()}>{body}</AcPage>
}

const st = StyleSheet.create({
  gap: { gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  bold: { fontFamily: FF.bodyBold },
  lede: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  note: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, paddingHorizontal: 4 },
  title: { fontFamily: FF.bodySemiBold, fontSize: 15, lineHeight: 19, letterSpacing: -0.225, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 1 },
  ar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 58 },
  top: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  nh: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 4, paddingLeft: 16, paddingRight: 12 },
  col: { width: 56, textAlign: 'center', fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.84, textTransform: 'uppercase', color: color.textSubtle },
  nr: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  lab: { flex: 1, minWidth: 0, paddingVertical: 11, paddingRight: 6 },
  cell: { width: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dash: { fontFamily: FF.monoMedium, fontSize: 14, color: color.textSubtle },
})
