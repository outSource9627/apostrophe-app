import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORY_LABELS, CHANNEL_ORDER, getNotificationPrefs, putNotificationPrefs,
  type NotificationCategory, type NotificationChannel,
} from '../../lib/api/account'
import { borderWidth, color, radius, space, trackingNative } from '../../theme'
import { ErrorState, MenuGroup, MenuRow, ScreenHeader, Skeleton, StatusPill, Toggle, text } from '../../components/ui'

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

  const bar = <ScreenHeader title="Notification settings" subtitle="Push, email and in-app" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your settings." body="Nothing was changed. Try again in a moment." /></View>)

  const rows = q.data!.filter((r) => !HIDDEN.includes(r.category))
  const locked = rows.filter((r) => r.locked)
  const choose = rows.filter((r) => !r.locked)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[text.uiMd, styles.muted, styles.intro]}>Choose how each kind of message reaches you.</Text>

        <MenuGroup label="Always on">
          {locked.map((r) => (
            <MenuRow key={r.category} title={CATEGORY_LABELS[r.category]} right={<StatusPill tone="neutral" label="All channels" />} />
          ))}
        </MenuGroup>
        <Text style={[text.uiXs, styles.muted, styles.intro]}>We always send these. They carry money, a booked time, or your account&rsquo;s security, so they aren&rsquo;t ours to switch off.</Text>

        <View style={styles.group}>
          <Text style={[text.metaMd, styles.eyebrow]}>YOU CHOOSE</Text>
          <View style={styles.card}>
            <View style={styles.headRow}>
              <View style={styles.grow} />
              {CHANNEL_ORDER.map((c) => <View key={c} style={styles.col}><Text style={[text.metaSm, styles.subtle]}>{channelHead(c)}</Text></View>)}
            </View>
            {choose.map((r) => (
              <View key={r.category} style={styles.chooseRow}>
                <View style={styles.grow}>
                  <Text style={text.uiMdSemi}>{CATEGORY_LABELS[r.category]}</Text>
                  {!!SUBLINE[r.category] && <Text style={[text.uiXs, styles.muted]}>{SUBLINE[r.category]}</Text>}
                </View>
                {CHANNEL_ORDER.map((c) => (
                  <View key={c} style={styles.col}>
                    <Toggle on={r.channels[c]} onChange={(v) => put.mutate({ category: r.category, channel: c, enabled: v })} label={`${channelHead(c)} for ${CATEGORY_LABELS[r.category]}`} />
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
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  intro: { paddingHorizontal: space.xs },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  group: { gap: space.sm, marginTop: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow, paddingHorizontal: space.xs },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, paddingHorizontal: space.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.md, paddingBottom: space.xs },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  col: { width: space['4xl'], alignItems: 'center' },
  chooseRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
})
