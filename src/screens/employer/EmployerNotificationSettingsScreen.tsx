import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
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

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getNotificationPrefs()
      setRows(data)
    } catch (err) {
      console.error('Failed to load notification prefs', err)
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
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Choose how each kind of update reaches you. Changes save as you make them.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color={color.ink} />
          </View>
        ) : (
          <View style={styles.content}>
            {/* Always on */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ALWAYS ON</Text>
              <View style={styles.card}>
                {ALWAYS_ON.map((item, idx) => (
                  <View
                    key={item.title}
                    style={[styles.alwaysRow, idx > 0 && styles.rowBorder]}
                  >
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <View style={styles.alwaysPill}>
                        <Text style={styles.alwaysPillText}>Always on</Text>
                      </View>
                    </View>
                    <Text style={styles.rowLine}>{item.line}</Text>
                    <Text style={styles.channelsLine}>{item.channels}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* You choose */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>YOU CHOOSE</Text>
              <View style={styles.card}>
                {/* Job applications */}
                <View style={styles.choiceRow}>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.rowTitle}>Job applications</Text>
                    <Text style={styles.rowLine}>Someone applies to one of your posts.</Text>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Push</Text>
                      <Switch
                        value={getPref('APPLICATION', 'PUSH')}
                        onValueChange={(v) => handleToggle('APPLICATION', 'PUSH', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Email</Text>
                      <Switch
                        value={getPref('APPLICATION', 'EMAIL')}
                        onValueChange={(v) => handleToggle('APPLICATION', 'EMAIL', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>In app</Text>
                      <Switch
                        value={getPref('APPLICATION', 'IN_APP')}
                        onValueChange={(v) => handleToggle('APPLICATION', 'IN_APP', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                  </View>
                </View>

                {/* Your job posts */}
                <View style={[styles.choiceRow, styles.rowBorder]}>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.rowTitle}>Your job posts</Text>
                    <Text style={styles.rowLine}>A post is approved, or needs changes.</Text>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Push</Text>
                      <Switch
                        value={getPref('JOB', 'PUSH')}
                        onValueChange={(v) => handleToggle('JOB', 'PUSH', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Email</Text>
                      <Switch
                        value={getPref('JOB', 'EMAIL')}
                        onValueChange={(v) => handleToggle('JOB', 'EMAIL', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>In app</Text>
                      <Switch
                        value={getPref('JOB', 'IN_APP')}
                        onValueChange={(v) => handleToggle('JOB', 'IN_APP', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                  </View>
                </View>

                {/* News from Apostrophe */}
                <View style={[styles.choiceRow, styles.rowBorder]}>
                  <View style={styles.choiceInfo}>
                    <Text style={styles.rowTitle}>News from Apostrophe</Text>
                    <Text style={styles.rowLine}>Occasional product news.</Text>
                  </View>
                  <View style={styles.togglesCol}>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Push</Text>
                      <Switch
                        value={getPref('MARKETING', 'PUSH')}
                        onValueChange={(v) => handleToggle('MARKETING', 'PUSH', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>Email</Text>
                      <Switch
                        value={getPref('MARKETING', 'EMAIL')}
                        onValueChange={(v) => handleToggle('MARKETING', 'EMAIL', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                    <View style={styles.switchItem}>
                      <Text style={styles.switchLabel}>In app</Text>
                      <Switch
                        value={getPref('MARKETING', 'IN_APP')}
                        onValueChange={(v) => handleToggle('MARKETING', 'IN_APP', v)}
                        trackColor={{ true: color.ink, false: color.border }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Reset Defaults */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleResetDefaults}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>Reset to defaults</Text>
            </TouchableOpacity>
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
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 26,
    fontWeight: 'bold',
    color: color.text,
    marginBottom: space.xs,
  },
  subtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    lineHeight: 20,
    color: color.textMuted,
  },
  centerBox: {
    paddingVertical: space['2xl'],
    alignItems: 'center',
  },
  content: {
    gap: space.lg,
  },
  section: {
    gap: space.xs,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    fontWeight: '700',
    color: color.textSubtle,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
  },
  alwaysRow: {
    paddingVertical: space.sm,
    gap: 3,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    marginTop: space.sm,
    paddingTop: space.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 15,
    fontWeight: 'bold',
    color: color.text,
  },
  alwaysPill: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alwaysPillText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    color: color.textMuted,
    fontWeight: '600',
  },
  rowLine: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
    lineHeight: 16,
  },
  channelsLine: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
    marginTop: 2,
  },
  choiceRow: {
    paddingVertical: space.sm,
    gap: space.sm,
  },
  choiceInfo: {
    gap: 2,
  },
  togglesCol: {
    gap: 6,
    paddingTop: 4,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  switchLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
  },
  resetBtn: {
    alignSelf: 'center',
    paddingVertical: space.sm,
  },
  resetBtnText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
    textDecorationLine: 'underline',
  },
})
