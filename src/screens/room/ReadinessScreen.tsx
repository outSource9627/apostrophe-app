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
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { borderWidth, color, fontFamilyNative as FF, radius } from '../../theme'
import { StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { Eyebrow, FlowFooter, FlowHeader, Lead } from '../../components/tab/flow'

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

  const bar = <FlowHeader title="Device check" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skel w="60%" h={12} /><Skel w="90%" h={28} /><Skel w={141} h={250} /></View>)
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load the device check." />)

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
        <View style={{ gap: 8 }}>
          <Eyebrow tone="accent">{`Mandatory before you join · ${fmtTime(q.data!.slotStart)} IST`}</Eyebrow>
          <Lead>This is the frame that publishes.</Lead>
        </View>

        <View style={styles.frame}>
          {cameraOk && previewOn && device ? <Camera style={StyleSheet.absoluteFill} device={device} isActive={previewOn} /> : null}
          {ovalStyle && cameraOk ? <View style={ovalStyle} pointerEvents="none" /> : null}
          <Text style={styles.frameHint}>Live preview · not recorded</Text>
        </View>

        <Panel style={styles.checks}>
          <CheckRow glyph="camera" title="Camera" meta={perm == null ? 'Checking…' : cameraOk ? 'Working' : permDenied && !perm.camera ? 'Access blocked' : 'No camera found'} status={pill(perm == null ? null : cameraOk, 'Ready', 'Blocked')} />
          <CheckRow glyph="mic" title="Microphone" meta={perm == null ? 'Checking…' : micOk ? 'Access granted' : 'Access blocked'} status={pill(perm == null ? null : micOk, 'Ready', 'Blocked')} />
          <CheckRow
            glyph="speaker"
            title="Speaker"
            meta={speaker === true ? 'You heard the tone' : speaker === false ? 'Not heard — raise the volume and retry' : 'Play the tone and confirm'}
            status={speaker === true ? pill(true, 'Ready', '') : <Btn variant="outline" label={speaker === false ? 'Play again' : 'Play tone'} onPress={playTone} style={styles.small} />}
          />
          <CheckRow
            glyph="wifi"
            title="Bandwidth"
            meta={bw === 'measuring' || bw == null ? 'Measuring…' : bwMbps ? `${bwMbps.toFixed(1)} Mbps · needs ${minMbps}` : 'Could not measure'}
            status={bw === 'measuring' || bw == null ? pill(null, '', '') : bwOk ? pill(true, 'Fast enough', '') : <Btn variant="outline" label="Retest" onPress={measure} style={styles.small} />}
          />
          <CheckRow glyph="wifi" title="Connection" meta={conn?.label ?? 'Checking…'} status={pill(conn == null ? null : conn.ok, 'Connected', 'Weak')} />
          <CheckRow
            glyph="shield"
            title="Permissions"
            meta={perm == null ? 'Checking…' : permOk ? 'Camera and microphone allowed' : 'Allow both in Settings'}
            status={permOk ? pill(true, 'Allowed', '') : <Btn variant="outline" label={permDenied ? 'Open Settings' : 'Allow'} onPress={() => (permDenied ? Linking.openSettings() : askPermissions())} style={styles.small} />}
            last
          />
        </Panel>
        {speaker === null && plays > 0 && (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>Did you hear the tone?</Text>
            <Btn label="Yes, I heard it" onPress={() => setSpeaker(true)} />
            <Btn variant="outline" label="No" onPress={() => setSpeaker(false)} />
          </View>
        )}
        {onPrepare && <Btn variant="quiet" label="How to prepare: lighting, background, questions" onPress={onPrepare} />}
      </ScrollView>

      {plays > 0 && speaker === null && <Video key={plays} source={{ uri: tone }} style={styles.hidden} paused={false} volume={1} playInBackground={false} />}

      <FlowFooter>
        {join.reason === 'TOO_EARLY' && <Text style={styles.note}>This check opens closer to your interview.</Text>}
        {join.reason === 'EXPIRED' && <Text style={styles.note}>The join window for this interview has closed.</Text>}
        {join.active && !allOk && <Text style={styles.note}>All five checks must pass before you can join.</Text>}
        {!!submitError && <Text style={styles.warn}>{submitError}</Text>}
        <Btn disabled={!join.active || !allOk || submitting} busy={submitting} label="Join interview" onPress={submit} />
      </FlowFooter>
    </View>
  )
}

type Glyph = 'camera' | 'mic' | 'speaker' | 'wifi' | 'shield'
function CheckRow({ glyph, title, meta, status, last }: { glyph: Glyph; title: string; meta: string; status: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.check, last && styles.checkLast]}>
      <View style={styles.checkIcon}><Glyph name={glyph} /></View>
      <View style={styles.checkText}>
        <Text style={styles.checkTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.checkMeta} numberOfLines={2}>{meta}</Text>
      </View>
      {status}
    </View>
  )
}

function Glyph({ name }: { name: Glyph }) {
  if (name === 'shield') return <Icon name="shield" size={19} tint={color.accent} />
  const p = { stroke: color.accent, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      {name === 'camera' && <><Path d="m16 10 5-3v10l-5-3" {...p} /><Rect x={3} y={6} width={13} height={12} rx={2} {...p} /></>}
      {name === 'mic' && <><Path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" {...p} /><Path d="M5 11a7 7 0 0 0 14 0" {...p} /><Path d="M12 18v3" {...p} /></>}
      {name === 'speaker' && <><Path d="M11 5 6 9H3v6h3l5 4V5Z" {...p} /><Path d="M15.5 8.5a5 5 0 0 1 0 7" {...p} /><Path d="M18.5 6a9 9 0 0 1 0 12" {...p} /></>}
      {name === 'wifi' && <><Path d="M2 9a15 15 0 0 1 20 0" {...p} /><Path d="M5.5 12.5a10 10 0 0 1 13 0" {...p} /><Path d="M9 16a5 5 0 0 1 6 0" {...p} /><Circle cx={12} cy={19.5} r={0.6} {...p} /></>}
    </Svg>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 16, paddingBottom: 28 },
  frame: { width: 141, height: 250, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: color.inkRaised },
  frameHint: { position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', fontFamily: FF.monoMedium, fontSize: 9, letterSpacing: 0.72, textTransform: 'uppercase', color: color.textOnInkSubtle },
  checks: { paddingVertical: 4, paddingHorizontal: 16, gap: 0 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  checkLast: { borderBottomWidth: 0 },
  checkIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1 },
  checkTitle: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  checkMeta: { fontFamily: FF.body, fontSize: 13, color: color.textMuted },
  small: { height: 38, borderRadius: 12, paddingHorizontal: 14 },
  note: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted, textAlign: 'center' },
  warn: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.warning, textAlign: 'center' },
  confirm: { gap: 8 },
  confirmText: { fontFamily: FF.body, fontSize: 15, color: color.text },
  hidden: { position: 'absolute', opacity: 0 },
})
