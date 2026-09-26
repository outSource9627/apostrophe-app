import { PermissionsAndroid, Platform } from 'react-native'
import {
  ChannelProfileType,
  ClientRoleType,
  ConnectionStateType,
  OrientationMode,
  QualityType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
} from 'react-native-agora'
import { VisionCamera } from 'react-native-vision-camera'

/**
 * A thin adapter over react-native-agora v4 (IR-06). The screens and hooks never
 * import the SDK directly; they drive this class and read plain values, so the
 * SDK surface stays in one file.
 *
 * NOT VERIFIED IN THIS ENVIRONMENT: the SDK is a native module — it needs a
 * device build (pod install / gradle sync) and a real Agora project to run.
 */
export type Role = 'student' | 'interviewer'
export type LinkState = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'disconnected'
export type Quality = 'good' | 'fair' | 'poor'

/** IR-02 / IR-05 — the student publishes 9:16 portrait, the interviewer 16:9 landscape. */
export const VIDEO_PROFILE: Record<Role, { w: number; h: number; fps: number; orientation: OrientationMode }> = {
  student: { w: 720, h: 1280, fps: 30, orientation: OrientationMode.OrientationModeFixedPortrait },
  interviewer: { w: 1280, h: 720, fps: 30, orientation: OrientationMode.OrientationModeFixedLandscape },
}

export interface EngineHandlers {
  onLink?: (s: LinkState) => void
  onQuality?: (q: Quality) => void
  onRemoteJoined?: (uid: number) => void
  onRemoteLeft?: (uid: number) => void
  onRemoteVideo?: (uid: number, on: boolean) => void
  /** The token is about to expire — fetch fresh credentials and call renewToken. */
  onTokenExpiring?: () => void
}

export interface JoinArgs { appId: string; channel: string; token: string; uid: number }

/** Collapses Agora's 0–6 QualityType into the three bars the room draws. */
export function qualityOf(q: number): Quality | null {
  if (q === QualityType.QualityUnknown || q === QualityType.QualityDown) return null
  if (q <= QualityType.QualityGood) return 'good'
  if (q === QualityType.QualityPoor) return 'fair'
  return 'poor'
}

/** Camera + microphone runtime permissions. Resolves true only when both are granted. */
export async function requestMediaPermissions(): Promise<{ camera: boolean; microphone: boolean }> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ])
    return {
      camera: r['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED,
      microphone: r['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED,
    }
  }
  const [camera, microphone] = await Promise.all([
    VisionCamera.requestCameraPermission(),
    VisionCamera.requestMicrophonePermission(),
  ])
  return { camera, microphone }
}

export class RoomEngine {
  private engine: IRtcEngine | null = null
  private handler: IRtcEngineEventHandler | null = null
  private joined = false
  private destroyed = false

  constructor(private readonly role: Role, private readonly handlers: EngineHandlers = {}) {}

  /** Creates the engine and starts the local camera preview (no channel yet). */
  init(appId: string) {
    const e = createAgoraRtcEngine()
    this.engine = e
    e.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication })
    const h = this.handlers
    this.handler = {
      onConnectionStateChanged: (_c, state) => {
        h.onLink?.(
          state === ConnectionStateType.ConnectionStateConnected ? 'connected'
            : state === ConnectionStateType.ConnectionStateReconnecting ? 'reconnecting'
            : state === ConnectionStateType.ConnectionStateFailed ? 'failed'
            : state === ConnectionStateType.ConnectionStateDisconnected ? 'disconnected'
            : 'connecting',
        )
      },
      // remoteUid 0 is the local user's own uplink/downlink; the worse of the two is what the user feels.
      onNetworkQuality: (_c, remoteUid, tx, rx) => {
        if (remoteUid !== 0) return
        const a = qualityOf(tx), b = qualityOf(rx)
        const rank = { good: 0, fair: 1, poor: 2 } as const
        const worst = a && b ? (rank[a] >= rank[b] ? a : b) : (a ?? b)
        if (worst) h.onQuality?.(worst)
      },
      onUserJoined: (_c, uid) => h.onRemoteJoined?.(uid),
      onUserOffline: (_c, uid) => h.onRemoteLeft?.(uid),
      onRemoteVideoStateChanged: (_c, uid, state) => h.onRemoteVideo?.(uid, state === 2 /* Decoding */),
      onTokenPrivilegeWillExpire: () => h.onTokenExpiring?.(),
    }
    e.registerEventHandler(this.handler)
    e.enableAudio()
    e.enableVideo()
    const p = VIDEO_PROFILE[this.role]
    e.setVideoEncoderConfiguration({
      dimensions: { width: p.w, height: p.h },
      frameRate: p.fps,
      orientationMode: p.orientation,
    })
    e.setEnableSpeakerphone(true)
    e.startPreview()
  }

  join({ channel, token, uid }: JoinArgs) {
    if (!this.engine) return
    this.joined = true
    this.engine.joinChannel(token, channel, uid, {
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
    })
  }

  renewToken(token: string) { this.engine?.renewToken(token) }
  muteMic(muted: boolean) { this.engine?.muteLocalAudioStream(muted) }
  /** Camera off = stop publishing video (audio continues). Also used for the audio-only fallback. */
  publishVideo(on: boolean) { this.engine?.muteLocalVideoStream(!on); this.engine?.enableLocalVideo(on) }
  setSpeaker(on: boolean) { this.engine?.setEnableSpeakerphone(on) }
  /** Receive the remote video stream, or audio only. */
  receiveVideo(on: boolean) { this.engine?.muteAllRemoteVideoStreams(!on) }

  leave() {
    if (!this.engine || !this.joined) return
    this.joined = false
    try { this.engine.leaveChannel() } catch { /* already gone */ }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    const e = this.engine
    this.engine = null
    if (!e) return
    try {
      if (this.joined) e.leaveChannel()
      e.stopPreview()
      if (this.handler) e.unregisterEventHandler(this.handler)
      e.release()
    } catch { /* teardown is best effort */ }
  }
}
