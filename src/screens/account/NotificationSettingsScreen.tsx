import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORY_LABELS, CHANNEL_ORDER, getNotificationPrefs, putNotificationPrefs,
  type NotificationCategory, type NotificationChannel,
} from '../../lib/api/account'
import { borderWidth, color, space } from '../../theme'
import { AppBar, Body, Display, Eyebrow, Meta, StatusPill, Toggle } from '../../components/ui'

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

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your settings.</Body></View>)

  const rows = q.data!.filter((r) => !HIDDEN.includes(r.category))
  const locked = rows.filter((r) => r.locked)
  const choose = rows.filter((r) => !r.locked)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Display level="lg">Notifications</Display>
          <Body size="sm" tone="muted">Choose how each kind of message reaches you.</Body>
        </View>

        <View style={styles.headRow}>
          <View style={{ flex: 1 }} />
          {CHANNEL_ORDER.map((c) => <View key={c} style={styles.col}><Meta style={{ color: color.textSubtle }}>{channelHead(c)}</Meta></View>)}
        </View>

        <View style={{ gap: space.md }}>
          <Eyebrow>Always on</Eyebrow>
          {locked.map((r) => (
            <View key={r.category} style={styles.lockedRow}>
              <Body size="lg" style={{ flex: 1 }}>{CATEGORY_LABELS[r.category]}</Body>
              <StatusPill tone="neutral" label="PUSH · EMAIL · IN-APP" />
            </View>
          ))}
          <Body size="xs" tone="muted">We always send these three. They carry money, a booked time, or your account&rsquo;s security, so they aren&rsquo;t ours to switch off.</Body>
        </View>

        <View style={{ gap: space.md }}>
          <Eyebrow>You choose</Eyebrow>
          {choose.map((r, i) => (
            <View key={r.category} style={[styles.chooseRow, i === 0 ? null : styles.chooseBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body size="lg">{CATEGORY_LABELS[r.category]}</Body>
                {!!SUBLINE[r.category] && <Body size="xs" tone="muted">{SUBLINE[r.category]}</Body>}
              </View>
              {CHANNEL_ORDER.map((c) => (
                <View key={c} style={styles.col}>
                  <Toggle on={r.channels[c]} onChange={(v) => put.mutate({ category: r.category, channel: c, enabled: v })} label={`${channelHead(c)} for ${CATEGORY_LABELS[r.category]}`} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  headRow: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { width: space['4xl'], alignItems: 'center' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chooseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  chooseBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
})
