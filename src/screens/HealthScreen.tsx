import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { api } from '../lib/api'
import { space } from '../theme'
import { Body, Card, Display, ErrorState, Eyebrow, ListRow, Meta, ObjectRow, Skeleton, StatusPill } from '../components/ui'

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
      <Eyebrow>APOSTROPHE · MOBILE</Eyebrow>
      <Display level="md" style={styles.title}>
        Connection check
      </Display>

      {loading && <Skeleton lines={3} />}

      {error && (
        <ErrorState
          title="Cannot reach the API"
          body={`${error} Start it with \`npm run dev\` in apostrophe-admin. On an Android emulator the host is 10.0.2.2, not localhost.`}
        />
      )}

      {health && (
        <>
          <Card style={styles.statusCard}>
            <StatusPill tone={ok ? 'success' : 'danger'} label={health.status.toUpperCase()} dot />
            <Meta>{new Date(health.at).toLocaleString('en-IN')}</Meta>
          </Card>
          <Card>
            {Object.entries(health.checks).map(([name, check], i, all) => (
              <ObjectRow
                key={name}
                title={name}
                status={
                  <StatusPill tone={check.ok ? 'success' : 'danger'} label={check.ok ? 'ok' : check.detail ?? 'failed'} />
                }
                last={i === all.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      {config && (
        <View style={styles.section}>
          <Eyebrow>PRICING, READ FROM THE BACKEND</Eyebrow>
          <Body size="sm" tone="muted">
            Nothing below is hard-coded in this app. An admin changes a price and it updates with no release.
          </Body>
          <Card>
            {config.tiers.map((t, i, all) => (
              <ListRow
                key={t.tier}
                label={t.tier}
                value={`${rupees(t.amountPaise)} · ${t.durationMin} min`}
                style={i === all.length - 1 ? styles.rowLast : undefined}
              />
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.xl, paddingTop: space['4xl'], gap: space.md },
  title: { marginBottom: space.md },
  statusCard: { padding: space.lg, gap: space.xs },
  section: { marginTop: space.xl, gap: space.xs },
  rowLast: { borderBottomWidth: 0 },
})
