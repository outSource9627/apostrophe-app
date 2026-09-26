import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmError } from '../../components/employer/em'
import {
  CATEGORY_LABELS, getNotificationPrefs, putNotificationPrefs,
  type NotificationCategory, type NotificationChannel, type PrefRow,
} from '../../lib/api/account'
import type { RootStackParamList } from '../../../App'

const COLUMNS: { channel: NotificationChannel; label: string }[] = [
  { channel: 'PUSH', label: 'PUSH' },
  { channel: 'EMAIL', label: 'EMAIL' },
  { channel: 'IN_APP', label: 'IN-APP' },
]

/** Categories that reach a student or an interviewer only; an older server may still list them. */
const NOT_EMPLOYER: NotificationCategory[] = ['PAYMENT', 'INTERVIEW']

/**
 * EM-29 · Notification settings (Employer Android): a grid of switches — push,
 * email, in-app — one row per category the server lists (the API's preferences
 * are per category, not per event). Locked rows read ALWAYS ON with their
 * switches on and dimmed; a channel a category never uses is a dash, not a
 * switch. Each change is saved as it is made and reloaded if the save fails.
 */
export function EmployerNotificationSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<PrefRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await getNotificationPrefs()
      setRows(data.filter((r) => r.available || !NOT_EMPLOYER.includes(r.category)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your settings.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(category: NotificationCategory, channel: NotificationChannel, enabled: boolean) {
    setNotice(null)
    setRows((prev) => (prev ?? []).map((r) => (r.category === category ? { ...r, channels: { ...r.channels, [channel]: enabled } } : r)))
    try {
      const updated = await putNotificationPrefs([{ category, channel, enabled }])
      setRows(updated.filter((r) => r.available || !NOT_EMPLOYER.includes(r.category)))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Not saved. Try again.')
      load()
    }
  }

  const anyOff = (rows ?? []).some((r) => !r.locked && COLUMNS.some((c) => (r.available?.[c.channel] ?? true) && !r.channels[c.channel]))
  async function reset() {
    const changes = (rows ?? []).flatMap((r) =>
      r.locked ? [] : COLUMNS.filter((c) => (r.available?.[c.channel] ?? true) && !r.channels[c.channel]).map((c) => ({ category: r.category, channel: c.channel, enabled: true })),
    )
    if (!changes.length) return
    try {
      setRows(await putNotificationPrefs(changes))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Not saved. Try again.')
      load()
    }
  }

  return (
    <EmployerShell back={() => navigation.goBack()} title="Notification settings" bodyStyle={styles.body}>
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !rows ? (
        <EmError title="Couldn’t load your settings." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      ) : (
        <>
          <View style={styles.headRow}>
            <View style={styles.grow} />
            {COLUMNS.map((c) => <Text key={c.channel} style={[text.metaSm, styles.col, styles.muted]}>{c.label}</Text>)}
          </View>
          {(rows ?? []).map((r) => (
            <View key={r.category} style={styles.row}>
              <View style={styles.grow}>
                <Text style={text.uiMdMedium}>{r.label ?? CATEGORY_LABELS[r.category]}</Text>
                {!!r.line && <Text style={[text.uiXs, styles.muted]}>{r.line}</Text>}
                {r.locked && (
                  <View style={styles.locked}>
                    <Icon name="lock" size={space.md - 2} tint={color.textMuted} weight={2} />
                    <Text style={[text.metaXs, styles.muted, styles.mono]}>ALWAYS ON</Text>
                  </View>
                )}
              </View>
              {COLUMNS.map((c) => {
                const offered = r.available ? r.available[c.channel] : true
                return (
                  <View key={c.channel} style={styles.col}>
                    {offered ? (
                      <Switch
                        on={r.locked || r.channels[c.channel]}
                        locked={r.locked}
                        label={`${r.label ?? CATEGORY_LABELS[r.category]}, ${c.label.toLowerCase()}`}
                        onChange={(v) => { toggle(r.category, c.channel, v) }}
                      />
                    ) : (
                      <Text style={[text.uiMd, styles.dash]}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>
          ))}
          {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}
          {anyOff && <Button variant="text" size="sm" label="Reset to defaults" onPress={() => { reset() }} style={styles.reset} />}
        </>
      )}
    </EmployerShell>
  )
}

/** The design's small switch (36 × 22), inside a 44 tap cell. */
function Switch({ on, locked, label, onChange }: { on: boolean; locked?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: locked }}
      disabled={locked}
      onPress={() => onChange(!on)}
      style={({ pressed }) => [styles.tap, pressed && styles.pressed]}
    >
      <View style={[styles.track, on ? styles.trackOn : styles.trackOff, locked && styles.trackLocked]}>
        <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { gap: 0 },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'], paddingRight: spaceHalf['1.5'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger, marginTop: space.md },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: space.sm },
  col: { width: height.control + 2, alignItems: 'center', textAlign: 'center', letterSpacing: trackingNative.meta },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spaceHalf['2.5'] + 1, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space['2xs'] },
  dash: { color: color.borderStrong },
  reset: { alignSelf: 'flex-start', marginTop: space.md },
  tap: { width: height.tap, height: height.tap, alignItems: 'center', justifyContent: 'center' },
  track: { width: space['2xl'] + space.md, height: spaceHalf['4.5'] + space.xs, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: space['2xs'] + 1 },
  trackOn: { backgroundColor: color.accent },
  trackOff: { backgroundColor: color.borderStrong },
  trackLocked: { opacity: opacity.disabled },
  knob: { width: space.lg, height: space.lg, borderRadius: radius.pill, backgroundColor: color.surface },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
})
