import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, fontFamilyNative as FF } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { SUPPORT_EMAIL } from '../../lib/support'
import { AcCard, AcHeading, AcList, AcPage, AcPill, AcRow, SupportSheet } from './accountKit'
import type { RootStackParamList } from '../../../App'

const TOPICS: { icon: IconName; title: string; subject: string }[] = [
  { icon: 'wallet', title: 'Payouts and wallet', subject: 'Payout or wallet question' },
  { icon: 'note', title: 'Interviews and scorecards', subject: 'Interview or scorecard question' },
  { icon: 'user', title: 'My account', subject: 'My interviewer account' },
  { icon: 'chat', title: 'Something else', subject: 'Interviewer app question' },
]

/**
 * Help and support (docs/interviewer-account-mockup.html, screen 4): the same
 * mailto hand-off the student app uses (openSupport), with a topic that only
 * fills in the subject line. A sheet shows the address and subject before the
 * mail app opens.
 */
export function InterviewerHelpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [subject, setSubject] = useState<string | null>(null)
  return (
    <AcPage title="Help and support" onBack={() => navigation.goBack()}>
      <AcCard>
        <View style={st.row}>
          <View style={st.tile}><Icon name="mail" size={22} tint={color.accent} weight={1.9} /></View>
          <View style={st.grow}>
            <Text style={st.title}>Talk to support</Text>
            <Text style={st.sub}>{`Opens your mail app, addressed to ${SUPPORT_EMAIL}.`}</Text>
          </View>
        </View>
        <AcPill label="Email support" onPress={() => setSubject('Interviewer app question')} />
      </AcCard>
      <AcHeading>Or start from a topic</AcHeading>
      <AcList>
        {TOPICS.map((t, i) => <AcRow key={t.title} icon={t.icon} title={t.title} onPress={() => setSubject(t.subject)} last={i === TOPICS.length - 1} />)}
      </AcList>
      <Text style={st.note}>A topic only fills in the subject line.</Text>
      <SupportSheet subject={subject} onClose={() => setSubject(null)} />
    </AcPage>
  )
}

const st = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 13, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FF.bodyBold, fontSize: 16, letterSpacing: -0.32, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.textMuted },
  note: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, paddingHorizontal: 4 },
})
