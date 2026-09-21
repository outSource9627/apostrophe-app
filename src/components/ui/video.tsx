import React from 'react'
import { Image, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { aspect, borderWidth, color, container, height, radius, space } from '../../theme'
import { Body } from './Type'
import { Button } from './Button'
import { UnverifiedMark, VerifiedSeal } from './status'
import { text } from './typography'

/**
 * Foundations §07 — video components. The most important pieces in the system.
 *
 * Video sits ON PAPER inside a hairline frame, never in a dark theatre. The
 * ground stays light everywhere, including the interview room, so the footage
 * itself is the only dark area on any screen — which makes it the focal point
 * without a single decorative pixel. None of these components paint a dark
 * background of their own; the poster does.
 *
 * Verified and self-uploaded are the product's central distinction, so the
 * difference is structural and typographic rather than a colour swap:
 *
 *   Verified        solid ink frame · red seal · serif name · interview date
 *   Self-uploaded   dashed frame · no seal · mono label · explicit "Unverified"
 *
 * A student can never see one without the other being legible as what it is.
 *
 * The caption band is a solid scrim rather than a gradient: RN has no CSS
 * gradient without pulling in a native module, and the token already carries the
 * ink-at-82% the web foot fades to. If a gradient library ever lands, this is
 * the one place to change.
 */

function Poster({ uri, label }: { uri?: string; label?: string }) {
  if (!uri) return <View style={styles.posterEmpty} />
  return <Image source={{ uri }} accessibilityLabel={label} style={styles.poster} resizeMode="cover" />
}

function PlayGlyph({ solid = true }: { solid?: boolean }) {
  return (
    <View style={[styles.play, solid ? styles.playSolid : styles.playOutline]}>
      <Svg viewBox="0 0 16 16" width={space.lg} height={space.lg}>
        <Path d="M3 1.5 14 8 3 14.5Z" fill={color.text} />
      </Svg>
    </View>
  )
}

/** The verified interview. Leads the profile, and the only video in the feed. */
export function VerifiedVideo({
  name, date, duration, poster, onPress,
}: { name: string; date?: string; duration?: string; poster?: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.frame, styles.frameVerified]}>
      <Poster uri={poster} label={`${name} — verified interview`} />
      <VerifiedSeal style={styles.badge} />
      <PlayGlyph />
      <View style={styles.caption}>
        <Text style={[text.displayXs, styles.onInk]}>{name}</Text>
        <Text style={[text.metaXs, styles.captionMeta]}>
          {['Interview', date, duration].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * A student's own upload. Full profile only — never the swipe feed. Max 3,
 * 90 seconds and 100 MB each, and always marked unverified.
 */
export function SelfUploadedVideo({
  title, duration, index, total, poster, onPress,
}: {
  title: string
  duration?: string
  index?: number
  total?: number
  poster?: string
  onPress?: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.frame, styles.frameSelf]}>
      <Poster uri={poster} label={title} />
      <UnverifiedMark style={styles.badge} />
      <PlayGlyph solid={false} />
      <View style={styles.captionPlain}>
        <Body size="md" weight="semibold">
          {title}
        </Body>
        <Text style={[text.metaXs, styles.captionMetaPlain]}>
          {['Self-uploaded', duration, index && total ? `${index} of ${total}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * Publication is automatic (RC-10). Nothing in this copy implies an approval
 * step, because there isn't one — implying otherwise makes a student wait for a
 * decision that is never coming.
 */
export function ProcessingVideo({ note }: { note?: string }) {
  return (
    <View style={[styles.frame, styles.frameState, styles.stateBody]}>
      <View style={styles.stateRing} />
      <Text style={[text.metaSm, { color: color.warning }]}>Processing</Text>
      <Body size="xs" tone="muted" style={styles.stateText}>
        {note ?? "Your interview is being prepared. Usually ready within an hour — we'll notify you."}
      </Body>
    </View>
  )
}

/**
 * Failure states always state the money position first (RC-13). "Nothing was
 * charged" is the sentence the person is looking for; everything else can wait
 * until they have read it.
 */
export function FailedVideo({ note, onRebook }: { note?: string; onRebook?: () => void }) {
  return (
    <View style={[styles.frame, styles.frameFailed, styles.stateBody]}>
      <View style={styles.errorRing}>
        <Text style={[text.displayXs, { color: color.danger }]}>!</Text>
      </View>
      <Text style={[text.metaSm, { color: color.danger }]}>Processing failed</Text>
      <Body size="xs" tone="muted" style={styles.stateText}>
        {note ?? "Nothing was lost and nothing was charged. You've been given a free re-interview."}
      </Body>
      <Button variant="destructive" size="sm" label="Rebook free" onPress={onRebook} />
    </View>
  )
}

/** Output B — the full composite, employer-facing and seekable. */
export function CompositeVideo({
  poster, progressPct = 0, elapsed, total, onPress,
}: { poster?: string; progressPct?: number; elapsed?: string; total?: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.frameWide]}>
      <Poster uri={poster} />
      <View style={styles.wideTag}>
        <Text style={[text.metaXs, { color: color.text }]}>Full video</Text>
      </View>
      <View style={styles.scrubber}>
        <Svg viewBox="0 0 16 16" width={space.md} height={space.md}>
          <Path d="M3 1.5 14 8 3 14.5Z" fill={color.textInverse} />
        </Svg>
        <View style={styles.scrubTrack}>
          <View style={[styles.scrubFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={[text.metaSm, styles.onInk]}>{`${elapsed ?? ''} / ${total ?? ''}`}</Text>
      </View>
    </Pressable>
  )
}

/**
 * Capture, locked to 9:16 on every device (IR-02/IR-03). The framing guide is
 * drawn over the preview and never appears in the output.
 */
export function CaptureFrame({
  recording = false, hint = 'Framing guide · not recorded', children,
}: { recording?: boolean; hint?: string; children?: React.ReactNode }) {
  return (
    <View style={[styles.frame, styles.frameCapture]}>
      {children}
      <View style={styles.guide} pointerEvents="none" />
      {recording && (
        <View style={styles.recording}>
          <View style={styles.recordingDot} />
          <Text style={[text.metaXs, styles.onInk]}>Recording</Text>
        </View>
      )}
      <View style={styles.captureHint}>
        <Text style={[text.metaXs, styles.onInk]}>{hint}</Text>
      </View>
    </View>
  )
}

/** A small framed still in a list — the thumbnail beside an interview row. */
export function VideoThumb({ verified = true, poster, style }: { verified?: boolean; poster?: string; style?: ViewProps['style'] }) {
  return (
    <View style={[styles.thumb, verified ? styles.frameVerified : styles.frameSelf, style]}>
      <Poster uri={poster} />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: aspect.videoResume,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  frameWide: {
    width: '100%',
    aspectRatio: aspect.fullVideo,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  frameVerified: { borderWidth: borderWidth.thin, borderColor: color.ink },
  frameSelf: {
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: color.surfaceMuted,
  },
  frameState: { borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted },
  frameFailed: { borderWidth: borderWidth.thin, borderColor: color.dangerBorder, backgroundColor: color.dangerSoft },
  frameCapture: { borderWidth: borderWidth.thin, borderColor: color.ink, backgroundColor: color.ink },

  poster: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  posterEmpty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.surfaceSunken },

  badge: { position: 'absolute', top: space.md, left: space.md },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    width: height.control,
    height: height.control,
    marginTop: -height.control / 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playSolid: { backgroundColor: color.surface },
  playOutline: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },

  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
    backgroundColor: color.scrimStrong,
  },
  captionPlain: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md },
  captionMeta: { color: color.textOnInkMuted, marginTop: space.xs },
  captionMetaPlain: { color: color.textSubtle, marginTop: space.xs },
  onInk: { color: color.textInverse },

  stateBody: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  stateText: { textAlign: 'center' },
  stateRing: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    borderWidth: borderWidth.accent,
    borderColor: color.border,
    borderTopColor: color.warning,
  },
  errorRing: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium,
    borderColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wideTag: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  scrubber: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.scrimStrong,
  },
  scrubTrack: { flex: 1, height: space.xs, borderRadius: radius.pill, backgroundColor: color.textOnInkSubtle },
  scrubFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },

  guide: {
    position: 'absolute',
    top: space['2xl'],
    bottom: space['2xl'],
    left: space.xl,
    right: space.xl,
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium,
    borderColor: color.textOnInkSubtle,
    borderStyle: 'dashed',
  },
  recording: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.scrimStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  recordingDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.accent },
  captureHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
    alignItems: 'center',
    backgroundColor: color.scrimStrong,
  },

  thumb: {
    width: container['video-thumb-compact'],
    aspectRatio: aspect.videoResume,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
})
