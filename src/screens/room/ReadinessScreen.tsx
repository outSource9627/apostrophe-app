import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { getReadiness } from '../../lib/api/interviews'
import { fmtTime } from '../../lib/interviews/slots'
import { color, space } from '../../theme'
import { AppBar, Body, Button, Card, CaptureFrame, Eyebrow, ObjectRow, Skeleton, StatusPill, StickyFooter, text } from '../../components/ui'

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
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load the device check.</Body></View>)

  const join = q.data!.joinStatus

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow tone="accent">{`Mandatory before you join · ${fmtTime(q.data!.slotStart)} IST`}</Eyebrow>
          <Text style={text.displayLead}>This is the frame that publishes.</Text>
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

      <StickyFooter>
        {join.reason === 'TOO_EARLY' && <Text style={[text.uiXs, styles.note]}>This check opens closer to your interview.</Text>}
        {join.reason === 'EXPIRED' && <Text style={[text.uiXs, styles.note]}>The join window for this interview has closed.</Text>}
        {conn && !conn.ok && join.active && <Text style={[text.uiXs, styles.warn]}>Your connection is weak — you can still join, but keep other apps closed.</Text>}
        <Button variant="primary" size="lg" full disabled={!join.active} label="Join interview" onPress={onJoin} />
      </StickyFooter>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.xl, paddingBottom: space.xl },
  note: { color: color.textMuted },
  warn: { color: color.warning },
})
