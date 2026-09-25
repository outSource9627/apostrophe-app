import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { EmEmpty, EmError, initialsOf } from '../../components/employer/em'
import type { ThreadDto } from '../../lib/api/chat'
import { listInterviewerThreads } from '../../lib/api/interviewer'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { fmtRowStamp } from '../../lib/chat/format'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/**
 * Messages (no artboard — the drawn screens' language). The platform's chat
 * contract (`/interviewers/me/messages`): one thread per interview, opening
 * before it and turning read-only after it by the server's `config.chat`
 * windows. Rows: the candidate, the time, the last line and the unread count;
 * a thread not yet open or already read-only says so. New messages bump the
 * list live over the socket.
 */
export function InterviewerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const config = useAppConfig()
  const [threads, setThreads] = useState<ThreadDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    try {
      setThreads((await listInterviewerThreads()).rows)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your messages.')
    }
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])
  useChatSocketEvents({ onMessage: () => { load() } })

  const opens = config?.chat?.opensHoursBefore
  const closes = config?.chat?.readOnlyHoursAfter
  const rule = opens && closes
    ? `A chat opens ${opens} hours before each interview and turns read-only ${closes} hours after it.`
    : 'A chat opens before each interview and turns read-only after it.'

  return (
    <InterviewerShell back={() => navigation.goBack()} title="Messages" sub={rule} scroll={false}>
      {threads === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !threads ? (
        <View style={styles.pad}><EmError title="Couldn’t load your messages." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /></View>
      ) : (threads ?? []).length === 0 ? (
        <View style={[styles.pad, styles.center]}><EmEmpty icon="chat" title="No conversations yet." body={rule} /></View>
      ) : (
        <FlatList
          data={threads ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: t }) => {
            const support = t.kind === 'USER_ADMIN'
            const name = support ? 'Apostrophe Support' : t.counterparty.name || 'Candidate'
            const readOnly = t.state.readOnly || t.state.archived
            const notYet = !t.state.open && !readOnly
            const preview = notYet && t.opensAt ? `Opens ${fmtRowStamp(t.opensAt, now)}` : readOnly ? 'Read-only' : t.lastMessagePreview || 'No messages yet'
            return (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerThread', { id: t.id })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={[styles.face, support ? styles.faceSupport : readOnly ? styles.faceMuted : styles.facePerson]}>
                  <Text style={[text.uiBaseSemi, { color: readOnly && !support ? color.textMuted : color.textInverse }]}>{support ? '’' : initialsOf(name)}</Text>
                </View>
                <View style={styles.grow}>
                  <View style={styles.line}>
                    <Text style={[text.uiBaseSemi, styles.grow, readOnly && styles.subtle]} numberOfLines={1}>{name}</Text>
                    {!!t.lastMessageAt && <Text style={[text.metaSm, styles.subtle]}>{fmtRowStamp(t.lastMessageAt, now).toUpperCase()}</Text>}
                  </View>
                  <View style={styles.line}>
                    <Text style={[t.unread ? text.uiSmMedium : text.uiSm, styles.grow, { color: t.unread ? color.text : color.textMuted }]} numberOfLines={1}>{preview}</Text>
                    {t.unread > 0 && <View style={styles.count}><Text style={[text.uiXsSemi, styles.countText]}>{t.unread}</Text></View>}
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  list: { paddingHorizontal: space.sm, paddingBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  face: { width: height.control, height: height.control, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  facePerson: { backgroundColor: color.accentBright },
  faceSupport: { backgroundColor: color.accent },
  faceMuted: { backgroundColor: color.border },
  count: { minWidth: spaceHalf['4.5'], height: spaceHalf['4.5'], paddingHorizontal: space.xs + 1, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  countText: { color: color.textInverse },
})
