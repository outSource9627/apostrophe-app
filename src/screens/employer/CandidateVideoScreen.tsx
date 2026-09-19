import React, { useState, useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  playCandidateRecording,
  type CandidateRecordingPlay,
} from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateVideo'>

export function CandidateVideoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const { id } = route.params

  const [recording, setRecording] = useState<CandidateRecordingPlay | null>(null)
  const [loading, setLoading] = useState(true)
  const [limitReached, setLimitReached] = useState(false)

  useEffect(() => {
    let active = true
    playCandidateRecording(id, 'LANDSCAPE')
      .then((data) => {
        if (active) setRecording(data)
      })
      .catch((err: any) => {
        if (err?.code === 'RATE_LIMITED' || err?.meta?.reason === 'VIDEO_PLAY_LIMIT_REACHED') {
          if (active) setLimitReached(true)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <EmployerShell back={{ label: 'PROFILE', onPress: () => navigation.goBack() }}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading 16:9 recording…</Text>
          </View>
        ) : limitReached ? (
          <View style={styles.limitCard}>
            <Text style={styles.limitEyebrow}>DAILY VIDEO LIMIT REACHED</Text>
            <Text style={styles.limitTitle}>100 full plays watched today</Text>
            <Text style={styles.limitBody}>
              Full video plays reset at midnight IST. Vertical card previews remain unmetered.
            </Text>
          </View>
        ) : recording?.url ? (
          <View style={styles.playerContainer}>
            <View style={styles.videoBox}>
              <Video
                source={{ uri: recording.url }}
                poster={recording.posterUrl || undefined}
                controls
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.titleText}>Full 16:9 Interview Recording</Text>
              <Text style={styles.durationText}>
                Duration: {Math.floor(recording.durationSec / 60)}:
                {String(recording.durationSec % 60).padStart(2, '0')} min
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.limitCard}>
            <Text style={styles.limitTitle}>Recording unavailable</Text>
            <Text style={styles.limitBody}>
              The 16:9 composite recording is currently being processed.
            </Text>
          </View>
        )}
      </View>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 13,
    color: color.textMuted,
    marginTop: space.sm,
  },
  playerContainer: {
    gap: space.sm,
  },
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  metaRow: {
    gap: 2,
  },
  titleText: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  durationText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.textMuted,
  },
  limitCard: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xl,
  },
  limitEyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    color: color.textMuted,
  },
  limitTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
    textAlign: 'center',
  },
  limitBody: {
    fontSize: 12,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
})
