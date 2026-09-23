import React, { useState, useEffect, useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, space } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  Body,
  Button,
  Card,
  Display,
  ErrorState,
  Eyebrow,
  Skeleton,
  StatusPill,
  Toggle,
} from '../../components/ui'
import {
  getNotificationPrefs,
  putNotificationPrefs,
  type NotificationCategory,
  type NotificationChannel,
  type PrefRow,
} from '../../lib/api/account'
import type { RootStackParamList } from '../../../App'

const ALWAYS_ON = [
  {
    title: 'Account and security',
    line: 'Sign-ins, password changes and verification decisions.',
    channels: 'Push · Email · In app',
  },
  {
    title: 'Interests and connections',
    line: 'A candidate accepts, or an application connects you.',
    channels: 'Push · In app',
  },
  {
    title: 'Messages',
    line: 'Messages from connected candidates and from support.',
    channels: 'Push · In app',
  },
]

export function EmployerNotificationSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [rows, setRows] = useState<PrefRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getNotificationPrefs()
      setRows(data)
    } catch (err) {
      console.error('Failed to load notification prefs', err)
      setError(err instanceof Error ? err : new Error('Failed to load notification prefs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getPref = (cat: NotificationCategory, ch: NotificationChannel): boolean => {
    const row = rows.find((r) => r.category === cat)
    return row?.channels[ch] ?? true
  }

  const handleToggle = async (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.category === category
          ? { ...r, channels: { ...r.channels, [channel]: enabled } }
          : r,
      ),
    )
    try {
      const updated = await putNotificationPrefs([{ category, channel, enabled }])
      setRows(updated)
    } catch (err) {
      console.error('Failed to save notification pref', err)
      load()
    }
  }

  const handleResetDefaults = async () => {
    const batch: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean }[] = [
      { category: 'APPLICATION', channel: 'PUSH', enabled: true },
      { category: 'APPLICATION', channel: 'IN_APP', enabled: true },
      { category: 'JOB', channel: 'PUSH', enabled: true },
      { category: 'JOB', channel: 'EMAIL', enabled: true },
      { category: 'JOB', channel: 'IN_APP', enabled: true },
      { category: 'MARKETING', channel: 'PUSH', enabled: true },
      { category: 'MARKETING', channel: 'EMAIL', enabled: true },
      { category: 'MARKETING', channel: 'IN_APP', enabled: true },
    ]
    try {
      const updated = await putNotificationPrefs(batch)
      setRows(updated)
    } catch (err) {
      console.error('Failed to reset defaults', err)
      load()
    }
  }

  return (
    <EmployerShell
      back={{ label: 'ACCOUNT', onPress: () => navigation.goBack() }}
      scroll={false}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Display level="lg">Notifications</Display>
          <Body tone="muted">
            Choose how each kind of update reaches you. Changes save as you make them.
          </Body>
        </View>

        {loading ? (
          <Skeleton lines={4} />
        ) : error && rows.length === 0 ? (
          <ErrorState
            title="We could not load your notification settings."
            body={error.message}
            action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
          />
        ) : (
          <View style={styles.content}>
            {/* Always on */}
            <View style={styles.section}>
              <Eyebrow>Always on</Eyebrow>
              <Card style={styles.card}>
                {ALWAYS_ON.map((item, idx) => (
                  <View
                    key={item.title}
                    style={[styles.alwaysRow, idx > 0 && styles.rowBorder]}
                  >
                    <View style={styles.rowTop}>
                      <Body weight="semibold" style={styles.grow}>
                        {item.title}
                      </Body>
                      <StatusPill tone="neutral" label="Always on" />
                    </View>
                    <Body size="xs" tone="muted">
                      {item.line}
                    </Body>
                    <Eyebrow>{item.channels}</Eyebrow>
                  </View>
                ))}
              </Card>
            </View>

            {/* You choose */}
            <View style={styles.section}>
              <Eyebrow>You choose</Eyebrow>
              <Card style={styles.card}>
                {/* Job applications */}
                <View style={styles.choiceRow}>
                  <View style={styles.choiceInfo}>
                    <Body weight="semibold">Job applications</Body>
                    <Body size="xs" tone="muted">Someone applies to one of your posts.</Body>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Body size="sm">Push</Body>
                      <Toggle
                        on={getPref('APPLICATION', 'PUSH')}
                        onChange={(v) => handleToggle('APPLICATION', 'PUSH', v)}
                        label="Push for job applications"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">Email</Body>
                      <Toggle
                        on={getPref('APPLICATION', 'EMAIL')}
                        onChange={(v) => handleToggle('APPLICATION', 'EMAIL', v)}
                        label="Email for job applications"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">In app</Body>
                      <Toggle
                        on={getPref('APPLICATION', 'IN_APP')}
                        onChange={(v) => handleToggle('APPLICATION', 'IN_APP', v)}
                        label="In app for job applications"
                      />
                    </View>
                  </View>
                </View>

                {/* Your job posts */}
                <View style={[styles.choiceRow, styles.rowBorder]}>
                  <View style={styles.choiceInfo}>
                    <Body weight="semibold">Your job posts</Body>
                    <Body size="xs" tone="muted">A post is approved, or needs changes.</Body>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Body size="sm">Push</Body>
                      <Toggle
                        on={getPref('JOB', 'PUSH')}
                        onChange={(v) => handleToggle('JOB', 'PUSH', v)}
                        label="Push for your job posts"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">Email</Body>
                      <Toggle
                        on={getPref('JOB', 'EMAIL')}
                        onChange={(v) => handleToggle('JOB', 'EMAIL', v)}
                        label="Email for your job posts"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">In app</Body>
                      <Toggle
                        on={getPref('JOB', 'IN_APP')}
                        onChange={(v) => handleToggle('JOB', 'IN_APP', v)}
                        label="In app for your job posts"
                      />
                    </View>
                  </View>
                </View>

                {/* News from Apostrophe */}
                <View style={[styles.choiceRow, styles.rowBorder]}>
                  <View style={styles.choiceInfo}>
                    <Body weight="semibold">News from Apostrophe</Body>
                    <Body size="xs" tone="muted">Occasional product news.</Body>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Body size="sm">Push</Body>
                      <Toggle
                        on={getPref('MARKETING', 'PUSH')}
                        onChange={(v) => handleToggle('MARKETING', 'PUSH', v)}
                        label="Push for news from Apostrophe"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">Email</Body>
                      <Toggle
                        on={getPref('MARKETING', 'EMAIL')}
                        onChange={(v) => handleToggle('MARKETING', 'EMAIL', v)}
                        label="Email for news from Apostrophe"
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Body size="sm">In app</Body>
                      <Toggle
                        on={getPref('MARKETING', 'IN_APP')}
                        onChange={(v) => handleToggle('MARKETING', 'IN_APP', v)}
                        label="In app for news from Apostrophe"
                      />
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            {/* Reset Defaults */}
            <View style={styles.resetWrap}>
              <Button variant="outline" size="sm" label="Reset to defaults" onPress={handleResetDefaults} />
            </View>
          </View>
        )}
      </ScrollView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space['2xl'] * 2,
  },
  header: {
    marginBottom: space.lg,
    gap: space.xs,
  },
  content: {
    gap: space.lg,
  },
  section: {
    gap: space.xs,
  },
  card: {
    padding: space.md,
  },
  grow: {
    flex: 1,
  },
  alwaysRow: {
    paddingVertical: space.sm,
    gap: space['2xs'],
  },
  rowBorder: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    marginTop: space.sm,
    paddingTop: space.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  choiceRow: {
    paddingVertical: space.sm,
    gap: space.sm,
  },
  choiceInfo: {
    gap: space['2xs'],
  },
  togglesCol: {
    gap: space.xs,
    paddingTop: space.xs,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space['2xs'],
  },
  resetWrap: {
    alignSelf: 'center',
    marginTop: space.sm,
  },
})
