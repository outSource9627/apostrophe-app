import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import Video from 'react-native-video'
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import { getReadiness, measureBandwidthMbps, postReadiness } from '../../lib/api/interviews'
import { fmtTime } from '../../lib/interviews/slots'
import { requestMediaPermissions } from '../../lib/room/agoraEngine'
import { toneDataUri } from '../../lib/room/tone'
import { borderWidth, color, radius, space } from '../../theme'
import { AppBar, Body, Button, Card, CaptureFrame, Eyebrow, ObjectRow, Skeleton, StatusPill, StickyFooter, text } from '../../components/ui'

/**
 * ST-29 / SC-30 / SC-31 — the mandatory device check. Every row is a real check:
 *   camera + microphone + permissions — the OS grants, and a camera device must exist;
 *   preview — the live front camera inside the 9:16 frame with the FACE_OVAL guide
 *             (an overlay, never part of the published stream);
 *   speaker — a generated 440 Hz tone the student must confirm hearing;
 *   bandwidth — measured against the platform's own GET /readiness/probe;
 *   connection — NetInfo.
 * All five block Join. The result is POSTed to /interviews/:id/readiness, and the
 * room refuses entry (READINESS_REQUIRED) until a passing one exists. The mic
 * check is grant + presence: the level is not sampled here (no audio-capture
 * module outside the Agora engine, which needs the channel App ID).
 */
export function ReadinessScreen({ id, onJoin, onBack, onPrepare }: { id: string; onJoin: () => void; onBack: () => void; onPrepare?: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['readiness', id], queryFn: () => getReadiness(id) })
  const [conn, setConn] = useState<{ label: string; ok: boolean } | null>(null)
  const [perm, setPerm] = useState<{ camera: boolean; microphone: boolean } | null>(null)
  const [previewOn, setPreviewOn] = useState(true)
  const [speaker, setSpeaker] = useState<boolean | null>(null)
  const [plays, setPlays] = useState(0)
  const tone = useMemo(() => toneDataUri(), [])
  const [bw, setBw] = useState<{ mbps: number } | 'measuring' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const device = useCameraDevice('front')

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      const gen = (s.details as { cellularGeneration?: string } | null)?.cellularGeneration
      const label = !s.isConnected ? 'No connection' : s.type === 'wifi' ? 'Wi-Fi' : gen ? gen.toUpperCase() : s.type === 'cellular' ? 'Mobile data' : 'Connected'
      setConn({ label, ok: Boolean(s.isConnected) && gen !== '2g' })
    })
    return () => unsub()
  }, [])

  const askPermissions = useCallback(() => {
    requestMediaPermissions().then(setPerm).catch(() => setPerm({ camera: false, microphone: false }))
  }, [])
  useEffect(askPermissions, [askPermissions])

  const measure = useCallback(() => {
    setBw('measuring')
    measureBandwidthMbps().then((mbps) => setBw({ mbps }))
  }, [])
  useEffect(measure, [measure])

  const playTone = useCallback(() => {
    setSpeaker(null)
    setPlays((n) => n + 1) // remounts the hidden player so the tone restarts
  }, [])

  const spec = q.data?.spec
  const minMbps = spec?.MIN_BANDWIDTH_MBPS ?? 0
  const cameraOk = Boolean(perm?.camera) && device != null
  const micOk = Boolean(perm?.microphone)
  const permOk = Boolean(perm?.camera && perm?.microphone)
  const bwMbps = typeof bw === 'object' && bw ? bw.mbps : null
  const bwOk = bwMbps != null && bwMbps >= minMbps && bwMbps > 0
  const connOk = Boolean(conn?.ok)
  const allOk = cameraOk && micOk && permOk && speaker === true && bwOk && connOk
  const oval = spec?.FACE_OVAL
  const ovalStyle = useMemo(() => oval ? ({
    position: 'absolute' as const, top: `${oval.TOP_PCT}%`, left: `${oval.LEFT_PCT}%`, width: `${oval.WIDTH_PCT}%`, height: `${oval.HEIGHT_PCT}%`,
    borderRadius: radius.pill, borderWidth: borderWidth.medium, borderStyle: 'dashed' as const, borderColor: color.guideLine,
  }) : null, [oval])

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load the device check.</Body></View>)

  const join = q.data!.joinStatus

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await postReadiness(id, { camera: cameraOk, microphone: micOk, speaker: speaker === true, bandwidthMbps: bwMbps ?? 0, permissions: permOk })
      // Release the camera before the room's engine opens it.
      setPreviewOn(false)
      setTimeout(onJoin, 250)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'The device check could not be saved. Try again.')
      setSubmitting(false)
    }
  }

  const permDenied = perm != null && (!perm.camera || !perm.microphone)
  const pill = (ok: boolean | null, okLabel: string, badLabel: string) =>
    <StatusPill tone={ok == null ? 'neutral' : ok ? 'success' : 'warning'} label={ok == null ? 'Checking' : ok ? okLabel : badLabel} />

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow tone="accent">{`Mandatory before you join · ${fmtTime(q.data!.slotStart)} IST`}</Eyebrow>
          <Text style={text.displayLead}>This is the frame that publishes.</Text>
        </View>

        <CaptureFrame hint="Live preview · not recorded">
          {cameraOk && previewOn && device ? <Camera style={StyleSheet.absoluteFill} device={device} isActive={previewOn} /> : null}
          {ovalStyle && cameraOk ? <View style={ovalStyle} pointerEvents="none" /> : null}
        </CaptureFrame>

        <Card>
          <ObjectRow title="Camera" meta={perm == null ? 'Checking…' : cameraOk ? 'Working' : permDenied && !perm.camera ? 'Access blocked' : 'No camera found'} status={pill(perm == null ? null : cameraOk, 'Ready', 'Blocked')} />
          <ObjectRow title="Microphone" meta={perm == null ? 'Checking…' : micOk ? 'Access granted' : 'Access blocked'} status={pill(perm == null ? null : micOk, 'Ready', 'Blocked')} />
          <ObjectRow
            title="Speaker"
            meta={speaker === true ? 'You heard the tone' : speaker === false ? 'Not heard — raise the volume and retry' : 'Play the tone and confirm'}
            status={speaker === true ? pill(true, 'Ready', '') : <Button variant="outline" size="sm" label={speaker === false ? 'Play again' : 'Play tone'} onPress={playTone} />}
          />
          <ObjectRow
            title="Bandwidth"
            meta={bw === 'measuring' || bw == null ? 'Measuring…' : bwMbps ? `${bwMbps.toFixed(1)} Mbps · needs ${minMbps}` : 'Could not measure'}
            status={bw === 'measuring' || bw == null ? pill(null, '', '') : bwOk ? pill(true, 'Fast enough', '') : <Button variant="outline" size="sm" label="Retest" onPress={measure} />}
          />
          <ObjectRow title="Connection" meta={conn?.label ?? 'Checking…'} status={pill(conn == null ? null : conn.ok, 'Connected', 'Weak')} />
          <ObjectRow
            title="Permissions"
            meta={perm == null ? 'Checking…' : permOk ? 'Camera and microphone allowed' : 'Allow both in Settings'}
            status={permOk ? pill(true, 'Allowed', '') : <Button variant="outline" size="sm" label={permDenied ? 'Open Settings' : 'Allow'} onPress={() => (permDenied ? Linking.openSettings() : askPermissions())} />}
            last
          />
        </Card>
        {speaker === null && plays > 0 && (
          <View style={styles.confirm}>
            <Text style={text.uiMd}>Did you hear the tone?</Text>
            <Button variant="primary" size="sm" label="Yes, I heard it" onPress={() => setSpeaker(true)} />
            <Button variant="outline" size="sm" label="No" onPress={() => setSpeaker(false)} />
          </View>
        )}
        {onPrepare && <Button variant="ghost" size="block" full label="How to prepare: lighting, background, questions" onPress={onPrepare} />}
      </ScrollView>

      {plays > 0 && speaker === null && <Video key={plays} source={{ uri: tone }} style={styles.hidden} paused={false} volume={1} playInBackground={false} />}

      <StickyFooter>
        {join.reason === 'TOO_EARLY' && <Text style={[text.uiXs, styles.note]}>This check opens closer to your interview.</Text>}
        {join.reason === 'EXPIRED' && <Text style={[text.uiXs, styles.note]}>The join window for this interview has closed.</Text>}
        {join.active && !allOk && <Text style={[text.uiXs, styles.warn]}>All five checks must pass before you can join.</Text>}
        {!!submitError && <Text style={[text.uiXs, styles.warn]}>{submitError}</Text>}
        <Button variant="primary" size="lg" full disabled={!join.active || !allOk || submitting} busy={submitting} label="Join interview" onPress={submit} />
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
  confirm: { gap: space.sm },
  hidden: { position: 'absolute', opacity: 0 },
})
