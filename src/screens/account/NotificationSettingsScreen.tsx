import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORY_LABELS, CHANNEL_ORDER, getNotificationPrefs, putNotificationPrefs,
  type NotificationCategory, type NotificationChannel,
} from '../../lib/api/account'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { StatusPill, Toggle } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { GroupLabel, Skel, StateBlock } from '../../components/tab/kit'

const SUBLINE: Partial<Record<NotificationCategory, string>> = {
  CONNECTION: 'When an employer sends an Interest',
  MESSAGE: 'New messages in an open chat',
  APPLICATION: 'Updates on jobs you applied to',
  MARKETING: 'Occasional, never more than monthly',
}
const HIDDEN: NotificationCategory[] = ['JOB']
const channelHead = (c: NotificationChannel) => (c === 'IN_APP' ? 'In-app' : c)

/**
 * ST-47 — notification settings. ACCOUNT, PAYMENT and INTERVIEW CANNOT be switched
 * off (NT-05): they render as a different kind of row — a mono ALWAYS ON pill
 * naming the channels — never a disabled toggle, greyed switch or padlock. The
 * rest are per-category × per-channel switches. (OS push-block detection needs a
 * native permissions module the app does not yet bundle, so the ST-47b variant is
 * a follow-up here.)
 */
export function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notification-prefs'], queryFn: () => getNotificationPrefs() })
  const put = useMutation({
    mutationFn: (change: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean }) => putNotificationPrefs([change]),
    onSuccess: (rows) => qc.setQueryData(['notification-prefs'], rows),
    onError: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })

  const bar = (
    <View style={styles.head}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressedDim]}>
        <Icon name="arrowL" size={22} tint={color.text} />
      </Pressable>
      <View style={styles.headText}>
        <Text style={styles.headTitle}>Notification settings</Text>
        <Text style={styles.headSub}>Push, email and in-app</Text>
      </View>
    </View>
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.skels}>
        {[0, 1, 2, 3].map((i) => <Skel key={i} w="100%" h={90} />)}
      </View>,
    )
  }
  if (q.isError) {
    return frame(<StateBlock icon="alert" title="Could not load your settings." body="Nothing was changed. Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)
  }

  const rows = q.data!.filter((r) => !HIDDEN.includes(r.category))
  const locked = rows.filter((r) => r.locked)
  const choose = rows.filter((r) => !r.locked)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Choose how each kind of message reaches you.</Text>

        <GroupLabel style={styles.eyebrow}>Always on</GroupLabel>
        <View style={styles.pad}>
          <View style={styles.card}>
            {locked.map((r, i) => (
              <View key={r.category} style={[styles.mrow, i < locked.length - 1 && styles.rule]}>
                <Text style={[styles.mTitle, styles.grow]}>{CATEGORY_LABELS[r.category]}</Text>
                <StatusPill tone="neutral" label="All channels" />
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.foot}>We always send these. They carry money, a booked time, or your account&rsquo;s security, so they aren&rsquo;t ours to switch off.</Text>

        <GroupLabel style={styles.eyebrow}>You choose</GroupLabel>
        <View style={styles.pad}>
          <View style={styles.card}>
            <View style={styles.headRow}>
              <View style={styles.grow} />
              {CHANNEL_ORDER.map((c) => <Text key={c} style={styles.colHead}>{channelHead(c)}</Text>)}
            </View>
            {choose.map((r) => (
              <View key={r.category} style={styles.chooseRow}>
                <View style={styles.label}>
                  <Text style={styles.mTitle}>{CATEGORY_LABELS[r.category]}</Text>
                  {!!SUBLINE[r.category] && <Text style={styles.small}>{SUBLINE[r.category]}</Text>}
                </View>
                {CHANNEL_ORDER.map((c) => (
                  <View key={c} style={styles.col}>
                    <View style={styles.scaled}>
                      <Toggle on={r.channels[c]} onChange={(v) => put.mutate({ category: r.category, channel: c, enabled: v })} label={`${channelHead(c)} for ${CATEGORY_LABELS[r.category]}`} />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  skels: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  pressedDim: { opacity: 0.6 },
  headText: { flex: 1, minWidth: 0 },
  headTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.475, color: color.text },
  headSub: { fontFamily: FF.body, fontSize: 13, color: color.textMuted, marginTop: 1 },
  body: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  intro: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted, paddingHorizontal: 24, paddingTop: 6 },
  eyebrow: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 },
  foot: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textSubtle, paddingHorizontal: 24, paddingTop: 10 },
  card: { backgroundColor: color.surface, borderRadius: 20, borderWidth: borderWidth.thin, borderColor: color.border, overflow: 'hidden' },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  grow: { flex: 1, minWidth: 0 },
  mTitle: { fontFamily: FF.bodySemiBold, fontSize: 16, letterSpacing: -0.16, color: color.text },
  small: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingTop: 14, paddingBottom: 4 },
  colHead: { width: 56, textAlign: 'center', fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.84, textTransform: 'uppercase', color: color.textSubtle },
  chooseRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  label: { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 6 },
  col: { width: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scaled: { transform: [{ scale: 0.88 }] },
})
