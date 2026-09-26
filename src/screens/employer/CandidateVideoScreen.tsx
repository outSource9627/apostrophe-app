import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Video, { type VideoRef } from 'react-native-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmIconButton } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import { playCandidateRecording, type CandidateRecordingPlay } from '../../lib/api/employerFeed'
import { clock, interviewDate, nameInitials, playhead } from '../../lib/employer/candidateFormat'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateVideo'>

/**
 * EM-10b · the full interview, portrait (Employer Android): the 16:9 recording
 * on the ink ground, the candidate above it, and the design's controls — play,
 * the time, a seek bar, sound and full screen (which is also how to go
 * landscape, EM-10). One play is metered per video per IST day by the server;
 * reopening the same video the same day is free, and a link that lapses mid-play
 * is simply asked for again.
 */
export function CandidateVideoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const { id, name, photoUrl, interviewAt } = route.params
  const insets = useSafeAreaInsets()
  const config = useEmployerConfig()

  const [recording, setRecording] = useState<CandidateRecordingPlay | null>(null)
  const [loading, setLoading] = useState(true)
  const [limitReached, setLimitReached] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState({ at: 0, total: 0 })
  const [barWidth, setBarWidth] = useState(0)
  const player = useRef<VideoRef>(null)
  const resumeAt = useRef(0)
  const retried = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(null)
    try {
      setRecording(await playCandidateRecording(id, 'LANDSCAPE'))
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === 'RATE_LIMITED' || e.meta?.reason === 'VIDEO_PLAY_LIMIT_REACHED')) setLimitReached(true)
      else setFailed(e instanceof Error ? e.message : 'The interview did not load.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const total = time.total || recording?.durationSec || 0
  const pct = total > 0 ? Math.min(1, time.at / total) : 0
  const date = interviewDate(interviewAt)
  const meta = ['16:9', clock(total), date ? `RECORDED ${date.toUpperCase()}` : null].filter(Boolean).join(' · ')

  const seekTo = (fraction: number) => {
    if (!total) return
    const at = Math.max(0, Math.min(total, fraction * total))
    player.current?.seek(at)
    setTime((t) => ({ ...t, at }))
  }

  let body: React.ReactNode
  if (loading) {
    body = <ActivityIndicator color={color.textOnInkMuted} />
  } else if (limitReached) {
    const limit = recording?.quota?.limit ?? config.feedDailyVideoPlayLimit
    body = (
      <View style={styles.state}>
        <Icon name="clock" size={height.glyph + 2} tint={color.textOnInkMuted} />
        <Text style={[text.displaySm, styles.onInk, styles.center]}>{limit ? `That’s ${limit} full videos today.` : 'That’s today’s full videos.'}</Text>
        <Text style={[text.uiMd, styles.onInkMuted, styles.center]}>Full videos reset at midnight IST. The previews on the cards still play.</Text>
      </View>
    )
  } else if (failed || !recording?.url) {
    body = (
      <View style={styles.state}>
        <Text style={[text.displaySm, styles.onInk, styles.center]}>{failed ? 'The interview did not load.' : 'The recording is still processing.'}</Text>
        {!!failed && <Text style={[text.uiMd, styles.onInkMuted, styles.center]}>{failed}</Text>}
        {!!failed && <Button variant="outline" size="md" icon="refresh" label="Try again" onPress={() => { load() }} />}
      </View>
    )
  } else {
    body = (
      <>
        <View style={styles.video}>
          <Video
            ref={player}
            source={{ uri: recording.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            paused={paused}
            muted={muted}
            progressUpdateInterval={250}
            onLoad={(d) => {
              // The link that just loaded works: a LATER lapse (links live 15 minutes, a full
              // interview is longer) is a new lapse and gets its own renewal, not "stopped playing".
              retried.current = false
              setTime({ at: resumeAt.current, total: d.duration })
              if (resumeAt.current) player.current?.seek(resumeAt.current)
            }}
            onProgress={(p) => setTime((t) => ({ at: p.currentTime, total: t.total || p.seekableDuration }))}
            onEnd={() => setPaused(true)}
            onError={() => {
              // A lapsed link: the same video, the same day, is free to ask for again — once.
              if (retried.current) {
                setFailed('The interview stopped playing.')
                return
              }
              retried.current = true
              resumeAt.current = time.at
              load()
            }}
          />
          {paused && (
            <Pressable accessibilityRole="button" accessibilityLabel="Play" onPress={() => setPaused(false)} style={styles.pausedHole}>
              <View style={styles.bigPlay}><Icon name="tri" size={height.glyph + 2} tint={color.ink} fill={color.ink} weight={1.5} /></View>
            </Pressable>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Play' : 'Pause'}
            onPress={() => setPaused((p) => !p)}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            {paused ? <Icon name="tri" size={space.lg} tint={color.ink} fill={color.ink} weight={1.5} /> : <Icon name="pause" size={spaceHalf['4.5']} tint={color.ink} weight={2.4} />}
          </Pressable>
          <Text style={[text.metaMd, styles.time]}>{`${playhead(time.at)} / ${clock(total) ?? '–'}`}</Text>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
            onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
            onPress={(e) => barWidth && seekTo(e.nativeEvent.locationX / barWidth)}
            style={styles.seek}
          >
            <View style={styles.track} />
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
            <View style={[styles.knob, { left: `${pct * 100}%` }]} />
          </Pressable>
          <EmIconButton name={muted ? 'mute' : 'sound'} label={muted ? 'Sound on' : 'Mute'} size={height.avatar} tint={color.textOnInk} onPress={() => setMuted((m) => !m)} />
          <EmIconButton name="max" label="Full screen" size={height.avatar} tint={color.textOnInk} onPress={() => player.current?.presentFullscreenPlayer()} />
        </View>

        <View style={styles.rotate}>
          <Icon name="phone" size={space.md + 2} tint={color.textOnInkSubtle} />
          <Text style={[text.metaSm, styles.subtle, styles.mono]}>ROTATE FOR FULL SCREEN</Text>
        </View>
      </>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.center1}>
        <View style={styles.head}>
          <View style={styles.face}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.faceImg} /> : <Text style={[text.uiSmSemi, styles.onInk]}>{nameInitials(name ?? '')}</Text>}
          </View>
          <View style={styles.grow}>
            <Text style={[text.uiLeadSemi, styles.onInk]} numberOfLines={1}>{name ? `${name} · Full interview` : 'Full interview'}</Text>
            {!!meta && <Text style={[text.metaSm, styles.onInkBody, styles.mono]} numberOfLines={1}>{meta}</Text>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="x" size={spaceHalf['4.5']} tint={color.textOnInk} weight={2} />
          </Pressable>
        </View>
        {body}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.inkDeep },
  center1: { flex: 1, justifyContent: 'center', paddingHorizontal: space.md, gap: spaceHalf['4.5'] },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  center: { textAlign: 'center' },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  onInkBody: { color: color.textOnInkBody },
  subtle: { color: color.textOnInkSubtle },
  mono: { letterSpacing: trackingNative.eyebrow },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  face: { width: height.chip + 4, height: height.chip + 4, borderRadius: radius.pill, backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceImg: { width: '100%', height: '100%' },
  close: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkHairline, alignItems: 'center', justifyContent: 'center' },

  video: { width: '100%', aspectRatio: aspect.fullVideo, borderRadius: radius.md, backgroundColor: color.inkDeep, overflow: 'hidden' },
  pausedHole: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: color.scrim },
  bigPlay: { width: height['deck-play'], height: height['deck-play'], borderRadius: radius.pill, backgroundColor: color.onInkDisc, alignItems: 'center', justifyContent: 'center', paddingLeft: space.xs },

  controls: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  play: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.textOnInk, alignItems: 'center', justifyContent: 'center' },
  time: { color: color.textOnInkSoft },
  seek: { flex: 1, height: height.tap, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: space.xs, borderRadius: radius.bar, backgroundColor: color.onInkEdge },
  fill: { position: 'absolute', left: 0, height: space.xs, borderRadius: radius.bar, backgroundColor: color.accent },
  knob: { position: 'absolute', width: space.md + 2, height: space.md + 2, marginLeft: -(space.md + 2) / 2, borderRadius: radius.pill, backgroundColor: color.textOnInk },

  state: { alignItems: 'center', gap: space.md, paddingVertical: space['2xl'] },
  rotate: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm },
})
