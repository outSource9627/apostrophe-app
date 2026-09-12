import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api } from '../lib/api'
import { color, space, radius, fontSize, fontWeight, borderWidth, trackingNative } from '../theme'

type Health = { status: string; checks: Record<string, { ok: boolean; detail?: string }>; at: string }
type Config = { tiers: { tier: string; amountPaise: number; durationMin: number }[] }

/** Money is integer paise everywhere; format only at the very edge. */
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

/**
 * Phase 0/1 proof: the app reaches the same API the web platform does, and reads
 * pricing from the backend rather than embedding it. A ₹99 hard-coded in this
 * bundle would survive in the wild for months after an admin changed the price.
 */
export function HealthScreen() {
  const [health, setHealth] = useState<Health | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Health>('/health', { anonymous: true }),
      api.get<Config>('/config', { anonymous: true }).catch(() => null),
    ])
      .then(([h, c]) => {
        setHealth(h)
        setConfig(c)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const ok = health?.status === 'healthy'

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>APOSTROPHE · MOBILE</Text>
      <Text style={styles.title}>Connection check</Text>

      {loading && <ActivityIndicator style={styles.spinner} color={color.accent} />}

      {error && (
        <View style={[styles.card, styles.cardBad]}>
          <Text style={styles.cardTitle}>Cannot reach the API</Text>
          <Text style={styles.muted}>{error}</Text>
          <Text style={styles.hint}>
            Start it with `npm run dev` in apostrophe-admin. On an Android emulator the host is 10.0.2.2, not
            localhost.
          </Text>
        </View>
      )}

      {health && (
        <>
          <View style={[styles.card, ok ? styles.cardGood : styles.cardBad]}>
            <Text style={styles.cardTitle}>{health.status.toUpperCase()}</Text>
            <Text style={styles.muted}>{new Date(health.at).toLocaleString('en-IN')}</Text>
          </View>
          {Object.entries(health.checks).map(([name, check]) => (
            <View key={name} style={styles.row}>
              <Text style={styles.rowName}>{name}</Text>
              <Text style={check.ok ? styles.ok : styles.bad}>{check.ok ? 'ok' : check.detail ?? 'failed'}</Text>
            </View>
          ))}
        </>
      )}

      {config && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRICING, READ FROM THE BACKEND</Text>
          <Text style={styles.muted}>
            Nothing below is hard-coded in this app. An admin changes a price and it updates with no release.
          </Text>
          {config.tiers.map((t) => (
            <View key={t.tier} style={styles.row}>
              <Text style={styles.rowName}>{t.tier}</Text>
              <Text style={styles.muted}>
                {rupees(t.amountPaise)} · {t.durationMin} min
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.xl, paddingTop: space['4xl'], gap: space.md },
  eyebrow: { fontSize: fontSize.xs, letterSpacing: trackingNative.widest, color: color.textSubtle },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: trackingNative.tighter,
    color: color.text,
    marginBottom: space.md,
  },
  spinner: { marginTop: space.xl },
  card: { borderRadius: radius.md, padding: space.lg, borderWidth: borderWidth.thin, gap: space.xs },
  cardGood: { backgroundColor: color.successSoft, borderColor: color.success },
  cardBad: { backgroundColor: color.dangerSoft, borderColor: color.danger },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.text },
  muted: { fontSize: fontSize.sm, color: color.textMuted },
  hint: { fontSize: fontSize.sm, color: color.textMuted, marginTop: space.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  rowName: { fontSize: fontSize.base, color: color.text, fontWeight: fontWeight.semibold },
  ok: { fontSize: fontSize.sm, color: color.success },
  bad: { fontSize: fontSize.sm, color: color.danger, flexShrink: 1, textAlign: 'right' },
  section: { marginTop: space.xl, gap: space.xs },
  sectionTitle: { fontSize: fontSize.xs, letterSpacing: trackingNative.wider, color: color.textSubtle },
})
