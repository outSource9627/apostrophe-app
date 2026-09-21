import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  getEmployerThread,
  sendEmployerMessage,
  markEmployerThreadRead,
  reportEmployerThread,
  actOnEmployerConnection,
  type ThreadDto,
  type MessageDto,
} from '../../lib/api/employerChat'
import type { RootStackParamList } from '../../../App'

function formatMessageTime(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

function formatDayDivider(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'Yesterday'

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

export function EmployerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerThread'>>()
  const { id } = route.params

  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollViewRef = useRef<any>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const page = await getEmployerThread(id, { limit: 50 })
      setThread(page.thread)
      setMessages([...page.rows].reverse())
      void markEmployerThreadRead(id).catch(() => {})
    } catch (err) {
      console.error('Failed to load thread', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const body = text.trim()
    try {
      setSending(true)
      setText('')
      const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const res = await sendEmployerMessage(id, { body, clientMessageId })
      setMessages((prev) => [...prev, res.message])
      setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 100)
    } catch (err) {
      console.error('Failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  const handleReport = () => {
    Alert.alert(
      'Report conversation',
      'Report this conversation to Apostrophe moderation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async () => {
            try {
              await reportEmployerThread(id, 'HARASSMENT')
              Alert.alert('Reported', 'Thank you. Our moderation team will review this transcript.')
            } catch (err) {
              console.error('Failed to report thread', err)
            }
          },
        },
      ],
    )
  }

  const handleBlock = () => {
    if (!thread?.connectionId) return
    Alert.alert(
      'Block candidate',
      'They will be permanently removed from your candidate feed and cannot appear in searches again. The chat is archived read-only. This cannot be undone from here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block candidate',
          style: 'destructive',
          onPress: async () => {
            try {
              await actOnEmployerConnection(thread.connectionId!, 'BLOCK')
              load()
            } catch (err) {
              console.error('Failed to block connection', err)
            }
          },
        },
      ],
    )
  }

  const isReadOnly = Boolean(
    thread?.state.readOnly || thread?.state.archived || thread?.archivedReason,
  )
  const isSupport = thread?.kind === 'USER_ADMIN'
  const name = isSupport ? 'Apostrophe Support' : thread?.counterparty.name || 'Candidate'

  return (
    <EmployerShell
      back={{ label: 'CHATS', onPress: () => navigation.goBack() }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Title Bar */}
        <View style={styles.titleBar}>
          <View style={styles.titleLeft}>
            <Text style={styles.titleName}>{name}</Text>
            {isSupport && (
              <View style={styles.supportTag}>
                <Text style={styles.supportTagText}>Support</Text>
              </View>
            )}
            {isReadOnly && (
              <View style={styles.readOnlyTag}>
                <Text style={styles.readOnlyTagText}>
                  {thread?.archivedReason === 'BLOCKED' ? 'Blocked' : 'Read-only'}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert('Options', undefined, [
                { text: 'Report', onPress: handleReport },
                ...(!isReadOnly && thread?.connectionId
                  ? [{ text: 'Block', style: 'destructive' as const, onPress: handleBlock }]
                  : []),
                { text: 'Cancel', style: 'cancel' },
              ])
            }}
            style={styles.optionsBtn}
          >
            <Text style={styles.optionsBtnText}>⋯</Text>
          </TouchableOpacity>
        </View>

        {/* Transcript Area */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messageScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd?.({ animated: false })}
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color={color.ink} />
              <Text style={styles.loadingText}>Loading messages…</Text>
            </View>
          ) : (
            messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const showDay =
                !prev ||
                new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()

              return (
                <View key={msg.id} style={styles.messageGroup}>
                  {showDay && (
                    <View style={styles.dayDivider}>
                      <Text style={styles.dayText}>{formatDayDivider(msg.createdAt)}</Text>
                    </View>
                  )}

                  {msg.kind === 'SYSTEM' ? (
                    <View style={styles.systemBox}>
                      <Text style={styles.systemText}>
                        {msg.body || 'Chat event'} · {formatMessageTime(msg.createdAt)}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.bubbleWrap, msg.mine ? styles.mineWrap : styles.peerWrap]}>
                      <View style={[styles.bubble, msg.mine ? styles.mineBubble : styles.peerBubble]}>
                        {msg.body ? (
                          <Text style={[styles.bubbleText, msg.mine ? styles.mineText : styles.peerText]}>
                            {msg.body}
                          </Text>
                        ) : null}

                        {msg.attachment && (
                          <View style={styles.attachmentBox}>
                            <Text style={styles.attachmentName}>
                              📄 {msg.attachment.fileName || 'Attachment'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptTime}>{formatMessageTime(msg.createdAt)}</Text>
                        {msg.mine && (
                          <Text style={styles.receiptStatus}>
                            {msg.readAt ? ' · Read' : msg.deliveredAt ? ' · Delivered' : ' · Sent'}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>

        {/* Bottom Composer or Read-Only Banner */}
        {isReadOnly ? (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyEyebrow}>READ-ONLY · CONVERSATION ARCHIVED</Text>
            <Text style={styles.readOnlyTitle}>
              {thread?.archivedReason === 'BLOCKED'
                ? `${name} was blocked by you.`
                : 'This conversation has been archived.'}
            </Text>
            <Text style={styles.readOnlyDetail}>
              You can’t send messages here any more. The conversation stays readable for both of you, and nothing was deleted.
            </Text>
          </View>
        ) : (
          <View style={styles.composerBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a message…"
              placeholderTextColor={color.textSubtle}
              style={styles.composerInput}
              multiline
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    backgroundColor: color.background,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  optionsBtn: {
    padding: space.xs,
  },
  optionsBtnText: {
    fontSize: 20,
    color: color.textMuted,
    lineHeight: 20,
  },
  titleName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    fontWeight: 'bold',
    color: color.text,
  },
  supportTag: {
    backgroundColor: '#EFF8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  supportTagText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '600',
    color: '#175CD3',
  },
  readOnlyTag: {
    backgroundColor: '#F2F2F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  readOnlyTagText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '500',
    color: color.textMuted,
  },
  messageScroll: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  centerBox: {
    paddingVertical: space['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: space.sm,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  messageGroup: {
    gap: 6,
  },
  dayDivider: {
    alignItems: 'center',
    marginVertical: space.xs,
  },
  dayText: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
  },
  systemBox: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textSubtle,
    textAlign: 'center',
  },
  bubbleWrap: {
    maxWidth: '82%',
    gap: 2,
  },
  mineWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  peerWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  mineBubble: {
    backgroundColor: color.ink,
    borderBottomRightRadius: 2,
  },
  peerBubble: {
    backgroundColor: color.surfaceMuted,
    borderBottomLeftRadius: 2,
  },
  bubbleText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    lineHeight: 20,
  },
  mineText: {
    color: '#FFFFFF',
  },
  peerText: {
    color: color.text,
  },
  attachmentBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radius.sm,
  },
  attachmentName: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '500',
    color: color.text,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  receiptTime: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
  },
  receiptStatus: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
  },
  readOnlyBanner: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surfaceMuted,
    padding: space.md,
    gap: 4,
  },
  readOnlyEyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '700',
    color: color.textSubtle,
  },
  readOnlyTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '700',
    color: color.text,
  },
  readOnlyDetail: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    lineHeight: 16,
    color: color.textMuted,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.text,
  },
  sendBtn: {
    backgroundColor: color.accent,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
