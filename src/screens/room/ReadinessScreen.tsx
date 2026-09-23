import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { getReadiness } from '../../lib/api/interviews'
import { fmtTime } from '../../lib/interviews/slots'
import { color, space, borderWidth } from '../../theme'
import { AppBar, Body, Button, Card, CaptureFrame, Display, Eyebrow, Meta, ObjectRow, StatusPill } from '../../components/ui'

/**
 * ST-29 — device check. The 9:16 guide the room uses, a per-device readout, and
 * Join as the single primary action, gated by the server's join window. The
 * live camera/mic/speaker check runs in the room (react-native has no
 * getUserMedia and the camera opens with the Agora module), so those rows state
 * that honestly rather than claim a pass they did not run; the CONNECTION check
 * is real via NetInfo. Low connection warns but still lets the student through.
 */
export function ReadinessScreen({ id, onJoin, onBack }: { id: string; onJoin: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['readiness', id], queryFn: () => getReadiness(id) })
  const [conn, setConn] = useState<{ label: string; ok: boolean } | null>(null)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      const gen = (s.details as { cellularGeneration?: string } | null)?.cellularGeneration
      const label = !s.isConnected ? 'No connection' : s.type === 'wifi' ? 'Wi-Fi' : gen ? gen.toUpperCase() : s.type === 'cellular' ? 'Mobile data' : 'Connected'
      setConn({ label, ok: Boolean(s.isConnected) && gen !== '2g' })
    })
    return () => unsub()
  }, [])

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load the device check.</Body></View>)

  const join = q.data!.joinStatus

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>{`Mandatory before you join · ${fmtTime(q.data!.slotStart)} IST`}</Eyebrow>
          <Display level="lg">This is the frame that publishes.</Display>
        </View>

        <CaptureFrame hint="Preview only · not recorded · opens in the room" />

        <Card>
          <ObjectRow
            title="Connection"
            meta={conn?.label ?? 'Checking…'}
            status={
              <StatusPill
                tone={conn == null ? 'neutral' : conn.ok ? 'success' : 'warning'}
                label={conn == null ? 'Checking' : conn.ok ? 'Connected' : 'Weak'}
              />
            }
          />
          <ObjectRow title="Camera" meta="Opens in the room" status={<StatusPill tone="neutral" label="In the room" />} />
          <ObjectRow title="Microphone" meta="Opens in the room" status={<StatusPill tone="neutral" label="In the room" />} />
          <ObjectRow title="Speaker" meta="Opens in the room" status={<StatusPill tone="neutral" label="In the room" />} />
          <ObjectRow
            title="Permissions"
            meta="You will be asked when you join"
            status={<StatusPill tone="neutral" label="In the room" />}
            last
          />
        </Card>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.lg }]}>
        {join.reason === 'TOO_EARLY' && <Meta style={{ color: color.textSubtle, marginBottom: space.sm }}>This check opens closer to your interview.</Meta>}
        {join.reason === 'EXPIRED' && <Meta style={{ color: color.textSubtle, marginBottom: space.sm }}>The join window for this interview has closed.</Meta>}
        {conn && !conn.ok && join.active && <Meta style={{ color: color.warning, marginBottom: space.sm }}>Your connection is weak — you can still join, but keep other apps closed.</Meta>}
        <Button variant="primary" size="block" full disabled={!join.active} label="Join the interview" onPress={onJoin} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.md },
})
