import React, { useState, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Video from 'react-native-video'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, color, radius, space } from '../../theme'
import { Display, EmptyState, Eyebrow, Meta, Skeleton } from '../../components/ui'
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
          <Skeleton lines={2} />
        ) : limitReached ? (
          <View style={styles.limitState}>
            <Eyebrow tone="muted">Daily video limit reached</Eyebrow>
            <EmptyState
              title="100 full plays watched today"
              body="Full video plays reset at midnight IST. Vertical card previews remain unmetered."
            />
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
              <Display level="xs">Full 16:9 Interview Recording</Display>
              <Meta>
                Duration: {Math.floor(recording.durationSec / 60)}:
                {String(recording.durationSec % 60).padStart(2, '0')} min
              </Meta>
            </View>
          </View>
        ) : (
          <EmptyState
            title="Recording unavailable"
            body="The 16:9 composite recording is currently being processed."
          />
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
  playerContainer: {
    gap: space.sm,
  },
  videoBox: {
    width: '100%',
    aspectRatio: aspect.fullVideo,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  metaRow: {
    gap: space['2xs'],
  },
  limitState: {
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
})
