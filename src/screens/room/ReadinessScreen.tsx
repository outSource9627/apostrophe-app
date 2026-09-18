import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import Svg, { Ellipse, Path } from 'react-native-svg'
import { getReadiness } from '../../lib/api/interviews'
import { fmtTime } from '../../lib/interviews/slots'
import { color, space, radius, borderWidth, fontFamilyNative, fontSize } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow, Meta } from '../../components/ui'

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

        <View style={styles.preview}>
          <Svg width="100%" height="100%" viewBox="0 0 90 160" preserveAspectRatio="none">
            <Ellipse cx={45} cy={58} rx={26} ry={34} fill="none" stroke={color.guideLine} strokeWidth={0.5} strokeDasharray="3 2.5" />
          </Svg>
          <View style={styles.previewNote}><Meta style={{ color: color.textOnInkSubtle }}>Preview only · not recorded · opens in the room</Meta></View>
        </View>

        <View style={{ gap: space.sm }}>
          <Row label="Connection" note={conn?.label ?? 'Checking…'} tone={conn == null ? 'wait' : conn.ok ? 'ok' : 'warn'} />
          <Row label="Camera" note="Opens in the room" tone="pending" />
          <Row label="Microphone" note="Opens in the room" tone="pending" />
          <Row label="Speaker" note="Opens in the room" tone="pending" />
          <Row label="Permissions" note="You will be asked when you join" tone="pending" />
        </View>
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

const TONE: Record<'ok' | 'warn' | 'wait' | 'pending', { fg: string; bg: string }> = {
  ok: { fg: color.success, bg: color.successSoft },
  warn: { fg: color.warning, bg: color.warningSoft },
  wait: { fg: color.textSubtle, bg: color.surfaceSunken },
  pending: { fg: color.textSubtle, bg: color.surfaceSunken },
}
function Row({ label, note, tone }: { label: string; note: string; tone: 'ok' | 'warn' | 'wait' | 'pending' }) {
  const t = TONE[tone]
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body size="sm" weight="medium">{label}</Body>
        <Meta style={{ color: t.fg, marginTop: 2 }}>{note}</Meta>
      </View>
      {tone === 'ok'
        ? <View style={[styles.chip, { backgroundColor: t.bg }]}><Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6 9 17l-5-5" /></Svg></View>
        : <View style={[styles.pill, { backgroundColor: t.bg }]}><Text style={[styles.pillText, { color: t.fg }]}>{tone === 'warn' ? 'WEAK' : tone === 'wait' ? '…' : 'IN THE ROOM'}</Text></View>}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  preview: { alignSelf: 'center', width: 189, height: 336, borderRadius: radius.lg, backgroundColor: color.ink, overflow: 'hidden', justifyContent: 'flex-end' },
  previewNote: { alignItems: 'center', paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.md },
  chip: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['meta-sm'], letterSpacing: 1, textTransform: 'uppercase' },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.md },
})
