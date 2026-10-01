import React from 'react'
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import { RtcSurfaceView, RenderModeType } from 'react-native-agora'
import { useRoom } from '../../lib/room/useRoom'
import { LogoMark } from '../../components/Logo'
import { borderWidth, color, fontFamilyNative as FF, radius } from '../../theme'
import { Btn } from '../../components/tab/kit'
import { Disc } from '../../components/tab/flow'

/**
 * ST-30 — the interview room (student), the twin of the web room. Paper/ink only
 * as the letterbox behind footage — not a dark studio. The interviewer is masked
 * until the session starts (SC-16), then revealed with a real name in the serif.
 * Recording is a radius-4 chip on a scrim ground with white REC + a crimson dot,
 * NOT a pressable pill, and a permanent truth line states neither party can stop
 * it. Only the interviewer ends the interview — the student gets LEAVE (the one
 * white-ground control), never End. The full-screen self-preview is the REAL Agora
 * camera track (RtcSurfaceView uid 0) with the framing guide drawn over it as an
 * overlay — never composited into the published stream. On a phone the floating
 * tile carries the interviewer's live video once revealed; on a tablet (IR-04) the
 * student's portrait pane sits beside a real interviewer panel. The interviewer
 * publishes 16:9 (IR-05), so their picture is drawn 16:9 and never cropped.
 */
/** The width from which the room lays out for a tablet: portrait pane beside an interviewer panel (IR-04). */
const TABLET_MIN_WIDTH = 600

export function RoomScreen({ id, onEnded, onLeft, onReadiness, onBack }: {
  id: string; onEnded: () => void; onLeft?: () => void; onReadiness?: () => void; onBack?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  // IR-04 — from a tablet's width the interviewer is a panel beside the portrait pane, not a corner tile.
  const wide = width >= TABLET_MIN_WIDTH
  const room = useRoom(id, { onLeft: onLeft ?? onEnded, onEnded, onReadinessRequired: onReadiness })

  const audioOnly = room.state === 'audio-only'
  const showGuide = !room.cameraOff && !audioOnly
  const truth = room.recording ? 'Recording · neither party can stop it' : 'Recording starts when the interview does'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.stage}>
       <View style={wide ? styles.wideRow : StyleSheet.absoluteFill}>
        <View style={wide ? styles.portraitPane : StyleSheet.absoluteFill}>
        {room.localReady && !room.cameraOff && !audioOnly && (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} />
        )}
        {(!room.localReady || room.cameraOff || audioOnly) && (
          <View style={styles.previewNote}>
            <Ico size={40} stroke={color.textOnInkSubtle}>{room.cameraOff || audioOnly ? <><Path d="M3 3l18 18" /><Path d="M16 10.5V7a1 1 0 0 0-1-1H8" /><Path d="M4 6.5V17a1 1 0 0 0 1 1h10" /></> : <><Path d="m16 10 5-3v10l-5-3" /><Rect x={3} y={6} width={13} height={12} rx={2} /></>}</Ico>
            <Text style={[styles.mono, { color: color.textOnInkSubtle, marginTop: 8 }]}>{audioOnly ? 'Audio only · weak connection' : room.cameraOff ? 'Your camera is off' : 'Opening your camera…'}</Text>
          </View>
        )}
        {showGuide && (
          <Svg width="100%" height="100%" viewBox="0 0 90 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Ellipse cx={45} cy={58} rx={26} ry={34} fill="none" stroke={color.guideLine} strokeWidth={0.5} strokeDasharray="3 2.5" />
          </Svg>
        )}
        </View>
        {wide && (
          <View style={styles.panelPane}>
            <InterviewerTile panel name={room.interviewer?.name ?? null} photoUrl={room.interviewer?.photoUrl ?? null} remoteUid={room.remoteVideoOn && !audioOnly ? room.remoteUid : null} />
          </View>
        )}
       </View>

        <View style={styles.topRow}>
          <View style={{ gap: 8 }}>
            {room.recording && <View style={styles.recChip}><View style={styles.recDot} /><Text style={styles.recText}>REC</Text></View>}
            {room.state === 'live' && <View style={styles.recChip}><Text style={styles.clock}>{fmtElapsed(room.elapsedSec)}</Text></View>}
          </View>
          {!wide && <InterviewerTile name={room.interviewer?.name ?? null} photoUrl={room.interviewer?.photoUrl ?? null} remoteUid={room.remoteVideoOn && !audioOnly ? room.remoteUid : null} />}
        </View>

        {room.state === 'waiting' && (
          <View style={styles.centre}>
            <Text style={styles.waitTitle}>Waiting for your interviewer</Text>
            <Text style={styles.waitBody}>They will appear here the moment the session starts.</Text>
          </View>
        )}
        {room.state === 'reconnecting' && (
          <View style={styles.reconnect}>
            <Text style={styles.glassWarn}>Reconnecting · nothing is lost</Text>
            <Text style={styles.glassWarn}>{`${room.reconnectSecLeft ?? 90}s`}</Text>
          </View>
        )}
        {room.state === 'dropped' && (
          <View style={styles.centre}>
            <View style={styles.errorCard}>
              <Disc tone="danger">
                <Ico size={26} stroke={color.danger}><Path d="M3 3l18 18" /><Path d="M16 10.5V7a1 1 0 0 0-1-1H8" /><Path d="M4 6.5V17a1 1 0 0 0 1 1h10" /></Ico>
              </Disc>
              <Text style={styles.errorTitle}>{ERROR_TITLE[room.error?.kind ?? 'other']}</Text>
              <Text style={styles.errorBody}>{room.error?.message ?? 'We could not reconnect in time. Nothing about your interview was lost.'}</Text>
              <View style={styles.errorActions}>
                {room.error?.kind !== 'ended' && room.error?.kind !== 'not-open' && (
                  <Btn label={room.error?.kind === 'permissions' ? 'Try again' : 'Rejoin'} onPress={room.retry} style={styles.errorBtn} />
                )}
                <Btn
                  variant="outline"
                  label={room.error ? 'Back' : 'Leave'}
                  onPress={room.error ? (onBack ?? room.leave) : room.leave}
                  style={styles.errorBtn}
                />
              </View>
            </View>
          </View>
        )}
        {room.warning != null && (room.state === 'live' || room.state === 'audio-only') && (
          <View style={styles.warnBand}><Text style={styles.glassWarn}>{`${room.warning} minute${room.warning === 1 ? '' : 's'} left`}</Text></View>
        )}

        {/* Permanent recording truth line. */}
        <View style={styles.truth}><Text style={styles.truthText}>{truth}</Text></View>
      </View>

      {/* Controls over ink — four toggles + LEAVE (the one white-ground control), each captioned. */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <Ctl caption={room.muted ? 'Unmute' : 'Mute'} lit={room.muted} onPress={room.toggleMic}>
          {room.muted ? <><Path d="M3 3l18 18" /><Path d="M9 9v3a3 3 0 0 0 5 2" /><Path d="M12 3a3 3 0 0 1 3 3v5" /><Path d="M19 11a7 7 0 0 1-7 7v3" /></> : <><Path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" /><Path d="M5 11a7 7 0 0 0 14 0" /><Path d="M12 18v3" /></>}
        </Ctl>
        <Ctl caption="Camera" lit={room.cameraOff} onPress={room.toggleCamera}>
          {room.cameraOff ? <><Path d="M3 3l18 18" /><Path d="M16 10.5V7a1 1 0 0 0-1-1H8" /><Path d="M4 6.5V17a1 1 0 0 0 1 1h10" /></> : <><Path d="m16 10 5-3v10l-5-3" /><Rect x={3} y={6} width={13} height={12} rx={2} /></>}
        </Ctl>
        <Ctl caption={room.speakerOn ? 'Speaker' : 'Earpiece'} lit={!room.speakerOn} onPress={room.toggleSpeaker}>
          {room.speakerOn ? <><Path d="M11 5 6 9H3v6h3l5 4V5Z" /><Path d="M15.5 8.5a5 5 0 0 1 0 7" /><Path d="M18.5 6a9 9 0 0 1 0 12" /></> : <><Path d="M11 5 6 9H3v6h3l5 4V5Z" /></>}
        </Ctl>
        <View style={[styles.ctl, styles.ctlIdle]} accessibilityLabel="Network quality"><Quality quality={room.quality} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={room.leave} style={styles.leavePill}>
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>
    </View>
  )
}

function fmtElapsed(sec: number) { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
function Ico({ size = 20, stroke, children }: { size?: number; stroke: string; children: React.ReactNode }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
}

function InterviewerTile({ name, photoUrl, remoteUid, panel = false }: { name: string | null; photoUrl: string | null; remoteUid: number | null; panel?: boolean }) {
  const initials = name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <View style={panel ? styles.panelTile : styles.tile}>
      {remoteUid != null ? (
        <View style={styles.tileVideo}>
          <RtcSurfaceView style={StyleSheet.absoluteFill} zOrderMediaOverlay canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }} />
        </View>
      ) : (
        <View style={styles.plate}>
          {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} accessibilityLabel={name ?? undefined} />
            : name ? <Text style={styles.initials}>{initials}</Text> : <LogoMark size={20} fill={color.ink} />}
        </View>
      )}
      <Text style={styles.tileEyebrow}>YOUR INTERVIEWER</Text>
      {!!name && <Text style={styles.tileName} numberOfLines={1}>{name}</Text>}
    </View>
  )
}

const ERROR_TITLE: Record<string, string> = {
  unconfigured: 'Video is not ready',
  'not-open': 'The room is not open',
  ended: 'This interview has ended',
  permissions: 'Camera and microphone needed',
  readiness: 'Device check needed',
  other: 'Connection lost',
}

function Ctl({ caption, lit, onPress, children }: { caption: string; lit?: boolean; onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={caption} onPress={onPress} style={[styles.ctl, lit ? styles.leave : styles.ctlIdle]}>
      <Ico size={24} stroke={lit ? color.text : color.textOnInk}>{children}</Ico>
    </Pressable>
  )
}

function Quality({ quality }: { quality: 'good' | 'fair' | 'poor' }) {
  const bars = quality === 'good' ? 3 : quality === 'fair' ? 2 : 1
  const c = quality === 'good' ? color.success : quality === 'fair' ? color.warning : color.danger
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[6, 10, 14].map((h, i) => <View key={h} style={{ width: 4, height: h, borderRadius: 1.5, backgroundColor: c, opacity: i + 1 <= bars ? 1 : 0.25 }} />)}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ink },
  stage: { flex: 1, overflow: 'hidden' },
  previewNote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase' },
  topRow: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16 },
  recChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, backgroundColor: color.onInkGlass, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.dangerFill },
  recText: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, color: color.textOnInk },
  clock: { fontFamily: FF.monoMedium, fontSize: 13, letterSpacing: 0.52, color: color.textOnInk, fontVariant: ['tabular-nums'] },
  tile: { width: 112, alignItems: 'center', gap: 4, borderRadius: 18, backgroundColor: color.inkRaised, borderWidth: borderWidth.thin, borderColor: color.onInkEdge, padding: 8 },
  // The interviewer publishes 16:9 (IR-05): draw it 16:9 so nothing is cropped away.
  tileVideo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', backgroundColor: color.onInkGround },
  panelTile: { width: '100%', alignItems: 'center', gap: 4, borderRadius: 18, backgroundColor: color.inkRaised, borderWidth: borderWidth.thin, borderColor: color.onInkEdge, padding: 8 },
  wideRow: { position: 'absolute', top: 92, bottom: 60, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  portraitPane: { height: '100%', aspectRatio: 9 / 16, borderRadius: 18, overflow: 'hidden', backgroundColor: color.inkRaised },
  panelPane: { flex: 1, maxWidth: 520, justifyContent: 'center' },
  photo: { width: '100%', height: '100%', borderRadius: 22 },
  plate: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.onInkGround },
  initials: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.textOnInk },
  tileEyebrow: { fontFamily: FF.monoMedium, fontSize: 9.5, letterSpacing: 0.76, color: color.textOnInkSubtle },
  tileName: { fontFamily: FF.body, fontSize: 12, color: color.textOnInk, maxWidth: '100%' },
  waitTitle: { fontFamily: FF.bodySemiBold, fontSize: 22, letterSpacing: -0.33, color: color.textOnInk, textAlign: 'center' },
  waitBody: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textOnInkBody, textAlign: 'center', marginTop: 8 },
  centre: { position: 'absolute', top: '30%', left: 24, right: 24, alignItems: 'center' },
  errorCard: { alignSelf: 'stretch', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, padding: 20, gap: 10, alignItems: 'center' },
  errorTitle: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text, textAlign: 'center' },
  errorBody: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted, textAlign: 'center' },
  errorActions: { alignSelf: 'stretch', gap: 8 },
  errorBtn: { height: 38, borderRadius: 12 },
  reconnect: { position: 'absolute', left: 16, right: 16, bottom: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.pill, backgroundColor: color.onInkGlass, paddingHorizontal: 16, paddingVertical: 9 },
  warnBand: { position: 'absolute', left: 20, right: 20, bottom: 44, alignItems: 'center', borderRadius: radius.pill, backgroundColor: color.onInkGlass, paddingVertical: 9 },
  glassWarn: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: color.warningFill },
  truth: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  truthText: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase', color: color.textOnInkSubtle, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: color.ink, paddingHorizontal: 20, paddingTop: 18 },
  ctl: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctlIdle: { backgroundColor: color.onInkGround },
  leave: { backgroundColor: color.surface },
  leavePill: { width: 84, height: 48, borderRadius: 24, backgroundColor: color.dangerFill, alignItems: 'center', justifyContent: 'center' },
  leaveText: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.textInverse },
})
