import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import { useRoom } from '../../lib/room/useRoom'
import { LogoMark } from '../../components/Logo'
import { color, space, radius, borderWidth, fontFamilyNative, fontSize } from '../../theme'
import { Body, Display, Meta } from '../../components/ui'

/**
 * ST-30 — the interview room (student), the twin of the web room. Paper/ink only
 * as the letterbox behind footage — not a dark studio. The interviewer is masked
 * until the session starts (SC-16), then revealed with a real name in the serif.
 * Recording is a radius-4 chip on a scrim ground with white REC + a crimson dot,
 * NOT a pressable pill, and a permanent truth line states neither party can stop
 * it. Only the interviewer ends the interview — the student gets LEAVE (the one
 * white-ground control), never End. The self-preview is an ink placeholder until
 * the Agora native module lands (see src/lib/room/useRoom.ts).
 */
export function RoomScreen({ id, onEnded }: { id: string; onEnded: () => void; onBack?: () => void }) {
  const insets = useSafeAreaInsets()
  const room = useRoom(id, onEnded)
  useEffect(() => { if (room.state === 'ended') onEnded() }, [room.state, onEnded])

  const audioOnly = room.state === 'audio-only'
  const showGuide = !room.cameraOff && !audioOnly
  const truth = room.recording ? 'Recording · neither party can stop it' : 'Recording starts when the interview does'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.stage}>
        <View style={styles.previewNote}>
          <Ico size={40} stroke={color.textOnInkSubtle}>{room.cameraOff || audioOnly ? <><Path d="M3 3l18 18" /><Path d="M16 10.5V7a1 1 0 0 0-1-1H8" /><Path d="M4 6.5V17a1 1 0 0 0 1 1h10" /></> : <><Path d="m16 10 5-3v10l-5-3" /><Rect x={3} y={6} width={13} height={12} rx={2} /></>}</Ico>
          <Meta style={{ color: color.textOnInkSubtle, marginTop: space.sm }}>{audioOnly ? 'Audio only' : room.cameraOff ? 'Your camera is off' : 'Your camera opens here'}</Meta>
        </View>
        {showGuide && (
          <Svg width="100%" height="100%" viewBox="0 0 90 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
            <Ellipse cx={45} cy={58} rx={26} ry={34} fill="none" stroke={color.guideLine} strokeWidth={0.5} strokeDasharray="3 2.5" />
          </Svg>
        )}

        <View style={styles.topRow}>
          <View style={{ gap: space.sm }}>
            {room.recording && <View style={styles.recChip}><View style={styles.recDot} /><Text style={styles.onInkMeta}>REC</Text></View>}
            {room.state === 'live' && <View style={styles.recChip}><Text style={styles.onInkMeta}>{fmtElapsed(room.elapsedSec)}</Text><Text style={styles.onInkMeta}>ELAPSED</Text></View>}
          </View>
          <InterviewerTile name={room.interviewer?.name ?? null} />
        </View>

        {room.state === 'waiting' && (
          <View style={styles.centre}>
            <Display level="sm" style={{ color: color.textOnInk, textAlign: 'center' }}>Waiting for your interviewer</Display>
            <Body size="sm" style={{ color: color.textOnInkMuted, textAlign: 'center', marginTop: space.sm }}>They will appear here the moment the session starts.</Body>
          </View>
        )}
        {room.state === 'reconnecting' && (
          <View style={styles.reconnect}>
            <Meta style={{ color: color.warning }}>Reconnecting · nothing is lost</Meta>
            <Meta style={{ color: color.warning }}>{`${room.reconnectSecLeft ?? 90}s`}</Meta>
          </View>
        )}
        {room.state === 'live' && (room.minutesLeft === 5 || room.minutesLeft === 1) && (
          <View style={styles.warnBand}><Meta style={{ color: color.warning }}>{`${room.minutesLeft} minute${room.minutesLeft === 1 ? '' : 's'} left`}</Meta></View>
        )}

        {/* Permanent recording truth line. */}
        <View style={styles.truth}><Meta style={{ color: color.textOnInkSubtle }}>{truth}</Meta></View>
      </View>

      {/* Controls over ink — four toggles + LEAVE (the one white-ground control), each captioned. */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + space.md }]}>
        <Ctl caption={room.muted ? 'Unmute' : 'Mute'} lit={room.muted} onPress={room.toggleMic}>
          {room.muted ? <><Path d="M3 3l18 18" /><Path d="M9 9v3a3 3 0 0 0 5 2" /><Path d="M12 3a3 3 0 0 1 3 3v5" /><Path d="M19 11a7 7 0 0 1-7 7v3" /></> : <><Path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" /><Path d="M5 11a7 7 0 0 0 14 0" /><Path d="M12 18v3" /></>}
        </Ctl>
        <Ctl caption="Camera" lit={room.cameraOff} onPress={room.toggleCamera}>
          {room.cameraOff ? <><Path d="M3 3l18 18" /><Path d="M16 10.5V7a1 1 0 0 0-1-1H8" /><Path d="M4 6.5V17a1 1 0 0 0 1 1h10" /></> : <><Path d="m16 10 5-3v10l-5-3" /><Rect x={3} y={6} width={13} height={12} rx={2} /></>}
        </Ctl>
        <Ctl caption="Output"><><Path d="M11 5 6 9H3v6h3l5 4V5Z" /><Path d="M16 9a3 3 0 0 1 0 6" /></></Ctl>
        <View style={styles.ctlCol}>
          <View style={[styles.ctl, styles.ctlIdle]}><Quality quality={room.quality} /></View>
          <Text style={styles.caption}>NETWORK</Text>
        </View>
        <View style={styles.ctlCol}>
          <Pressable accessibilityLabel="Leave" onPress={room.leave} style={[styles.ctl, styles.leave]}>
            <Ico size={20} stroke={color.text}><Path d="M4 12a8 8 0 0 1 16 0" /><Path d="M9 14l-1.5 2.5M15 14l1.5 2.5" /></Ico>
          </Pressable>
          <Text style={styles.caption}>LEAVE</Text>
        </View>
      </View>
    </View>
  )
}

function fmtElapsed(sec: number) { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
function Ico({ size = 20, stroke, children }: { size?: number; stroke: string; children: React.ReactNode }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
}

function InterviewerTile({ name }: { name: string | null }) {
  const initials = name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <View style={styles.tile}>
      <View style={styles.plate}>{name ? <Text style={styles.initials}>{initials}</Text> : <LogoMark size={20} fill={color.ink} />}</View>
      <Text style={styles.tileEyebrow}>YOUR INTERVIEWER</Text>
      {!!name && <Text style={styles.tileName} numberOfLines={1}>{name}</Text>}
    </View>
  )
}

function Ctl({ caption, lit, onPress, children }: { caption: string; lit?: boolean; onPress?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.ctlCol}>
      <Pressable accessibilityLabel={caption} onPress={onPress} style={[styles.ctl, lit ? styles.leave : styles.ctlIdle]}>
        <Ico size={20} stroke={lit ? color.text : color.textOnInk}>{children}</Ico>
      </Pressable>
      <Text style={styles.caption}>{caption.toUpperCase()}</Text>
    </View>
  )
}

function Quality({ quality }: { quality: 'good' | 'fair' | 'poor' }) {
  const bars = quality === 'good' ? 3 : quality === 'fair' ? 2 : 1
  const c = quality === 'good' ? color.success : quality === 'fair' ? color.warning : color.danger
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3].map((n) => <View key={n} style={{ width: 4, height: 4 + n * 3, borderRadius: 1, backgroundColor: c, opacity: n <= bars ? 1 : 0.25 }} />)}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ink },
  stage: { flex: 1, overflow: 'hidden' },
  previewNote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  topRow: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: space.lg },
  recChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, backgroundColor: color.scrim, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  recDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: color.accent },
  onInkMeta: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['meta-sm'], letterSpacing: 1, color: color.textOnInk },
  tile: { width: 112, alignItems: 'center', gap: 4, borderRadius: radius.lg, backgroundColor: color.inkRaised, padding: space.sm },
  plate: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border },
  initials: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['ui-sm'], color: color.textMuted },
  tileEyebrow: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['meta-sm'], letterSpacing: 1, color: color.textOnInkSubtle },
  tileName: { fontFamily: fontFamilyNative.display, fontSize: fontSize['ui-sm'], color: color.textOnInk, maxWidth: '100%' },
  centre: { position: 'absolute', top: '30%', left: space.xl, right: space.xl, alignItems: 'center' },
  reconnect: { position: 'absolute', left: space.lg, right: space.lg, bottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: color.warningSoft, paddingHorizontal: space.md, paddingVertical: space.sm },
  warnBand: { position: 'absolute', left: space.xl, right: space.xl, top: 84, alignItems: 'center', borderRadius: radius.md, backgroundColor: color.warningSoft, paddingVertical: space.sm },
  truth: { position: 'absolute', left: 0, right: 0, bottom: space.md, alignItems: 'center' },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: space.lg, backgroundColor: color.ink, paddingHorizontal: space.xl, paddingTop: space.md },
  ctlCol: { alignItems: 'center', gap: 6 },
  ctl: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctlIdle: { backgroundColor: color.onInkGround },
  leave: { backgroundColor: color.surface },
  caption: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['meta-xs'], letterSpacing: 1, color: color.textOnInkSubtle },
})
