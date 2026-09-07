import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api } from '../lib/api'

type Health = {
  status: string
  checks: Record<string, { ok: boolean; detail?: string }>
  at: string
}

/**
 * Phase 0 proof: the app reaches the same API the web platform does, through the
 * same client. Replaced by the real home surface in Phase 2.
 */
export function HealthScreen() {
  const [state, setState] = useState<{ loading: boolean; data?: Health; error?: string }>({ loading: true })

  useEffect(() => {
    api
      .get<Health>('/health', { anonymous: true })
      .then((data) => setState({ loading: false, data }))
      .catch((err: Error) => setState({ loading: false, error: err.message }))
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>APOSTROPHE · PLATFORM CORE</Text>
      <Text style={styles.title}>Connection check</Text>

      {state.loading && <ActivityIndicator style={styles.spinner} />}

      {state.error && (
        <View style={[styles.card, styles.cardBad]}>
          <Text style={styles.cardTitle}>Cannot reach the API</Text>
          <Text style={styles.detail}>{state.error}</Text>
          <Text style={styles.hint}>
            Start it with `npm run dev` in apostrophe-admin. On an Android emulator the host is
            10.0.2.2, not localhost.
          </Text>
        </View>
      )}

      {state.data && (
        <>
          <View style={[styles.card, state.data.status === 'healthy' ? styles.cardGood : styles.cardBad]}>
            <Text style={styles.cardTitle}>{state.data.status.toUpperCase()}</Text>
            <Text style={styles.detail}>{new Date(state.data.at).toLocaleString()}</Text>
          </View>
          {Object.entries(state.data.checks).map(([name, check]) => (
            <View key={name} style={styles.row}>
              <Text style={styles.rowName}>{name}</Text>
              <Text style={check.ok ? styles.ok : styles.bad}>{check.ok ? 'ok' : check.detail ?? 'failed'}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 72, gap: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#737B9A' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: '#141829', marginBottom: 12 },
  spinner: { marginTop: 24 },
  card: { borderRadius: 6, padding: 16, borderWidth: 1, gap: 4 },
  cardGood: { backgroundColor: '#DCF0E9', borderColor: '#0C7355' },
  cardBad: { backgroundColor: '#FAE3DF', borderColor: '#A93122' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#141829' },
  detail: { fontSize: 13, color: '#474D68' },
  hint: { fontSize: 12, color: '#474D68', marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#D7DCEA' },
  rowName: { fontSize: 14, color: '#141829', fontWeight: '600' },
  ok: { fontSize: 13, color: '#0C7355' },
  bad: { fontSize: 13, color: '#A93122', flexShrink: 1, textAlign: 'right' },
})
