import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import {
  Banner,
  Card,
  Display,
  EmptyState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'

export function InterviewerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()

  // No live chat feed is wired to this screen yet (sample data below) — this
  // local flag exists only to drive the shared loading state until it is.
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(false)
  }, [])

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

  if (loading) {
    return (
      <InterviewerShell back={{ label: 'Account', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Account', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>SECURE MESSAGING</Eyebrow>
        <Display level="lg">Candidate Conversations</Display>
      </View>

      {/* Identity Masking Privacy Banner */}
      <Banner tone="info" title="Identity Masking Protocol">
        All communications with candidates are relayed through Apostrophe’s masked proxy. Sharing personal contact information (phone numbers, personal emails, LinkedIn or social handles) is strictly prohibited to prevent evaluation bias and platform disintermediation.
      </Banner>

      {/* Conversations List */}
      {sampleChats.length === 0 ? (
        <Card>
          <EmptyState
            title="No conversations yet"
            body="A conversation opens once secure messaging is available for a candidate."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {sampleChats.map((c) => (
            <Card key={c.id} style={styles.chatCard}>
              <ObjectRow last title={c.candidateName} meta={c.lastMsg} status={<Meta>{c.time}</Meta>} />
            </Card>
          ))}
        </View>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  list: {
    gap: space.sm,
  },
  chatCard: {
    padding: space.md,
  },
})
