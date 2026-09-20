import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Card, Eyebrow } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'

export function InterviewerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()

  const sampleChats = [
    {
      id: 'chat-1',
      candidateName: 'Candidate #4092 (Tier 2)',
      lastMsg: 'Hello, looking forward to our interview session tomorrow at 2 PM.',
      time: '10:45 AM',
      unread: true,
    },
    {
      id: 'chat-2',
      candidateName: 'Candidate #3811 (Tier 1)',
      lastMsg: 'Thank you for the detailed feedback in the scorecard!',
      time: 'Yesterday',
      unread: false,
    },
  ]

  return (
    <InterviewerShell back={{ label: 'Account', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>SECURE MESSAGING</Eyebrow>
        <Text style={styles.title}>Candidate Conversations</Text>
      </View>

      {/* Identity Masking Privacy Banner */}
      <Card style={styles.maskingBanner}>
        <View style={styles.maskingHeader}>
          <Text style={styles.maskingIcon}>🛡️</Text>
          <Text style={styles.maskingTitle}>Identity Masking Protocol</Text>
        </View>
        <Text style={styles.maskingBody}>
          All communications with candidates are relayed through Apostrophe’s masked proxy. Sharing personal contact information (phone numbers, personal emails, LinkedIn or social handles) is strictly prohibited to prevent evaluation bias and platform disintermediation.
        </Text>
      </Card>

      {/* Conversations List */}
      <View style={styles.list}>
        {sampleChats.map((c) => (
          <Card key={c.id} style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.candidateTitle}>{c.candidateName}</Text>
              <Text style={styles.timeText}>{c.time}</Text>
            </View>
            <Text style={styles.msgText} numberOfLines={2}>
              {c.lastMsg}
            </Text>
          </Card>
        ))}
      </View>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
    fontWeight: '700',
    color: color.text,
  },
  maskingBanner: {
    padding: space.md,
    gap: space.xs,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  maskingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  maskingIcon: {
    fontSize: 18,
  },
  maskingTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  maskingBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#1d4ed8',
    lineHeight: 17,
  },
  list: {
    gap: space.sm,
  },
  chatCard: {
    padding: space.md,
    gap: space.xs,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  candidateTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  timeText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
  },
  msgText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
})
