import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { color, fontFamilyNative as FF, opacity, radius } from '../../theme'
import { LogoMark } from '../Logo'
import type { ThreadDto } from '../../lib/api/chat'
import { monogram } from '../../lib/chat/format'

/**
 * ONE PLATE RULE for every chat surface (docs/chat-redesign-mockups.html, A):
 * shape is the meaning.
 *
 *   company      a rounded SQUARE (≈30% corners), its initials on a soft pastel
 *                pair picked from the name, so neighbours differ and a company
 *                keeps its colour everywhere — chat, Interests, Connections.
 *   person       a CIRCLE: the photo when the server sends one, else initials
 *                on the accent gradient.
 *   masked       the unnamed interviewer (SC-16): an ink circle carrying the
 *                Apostrophe mark, never a face.
 *   support      a lifebuoy on the info wash.
 *
 * A read-only or archived conversation greys its company or person plate.
 */
export type PlateKind = 'company' | 'person' | 'masked' | 'support'

/** The square's corner as a share of its side — the mockup's 30%. */
const TILE_CORNER = 0.3
/** Initials as a share of the plate — the mockup's 36%. */
const INITIALS = 0.36
/** The mark and the lifebuoy as a share of a round plate. */
const GLYPH = 0.5

/** Soft fill + text pairs for a company tile; picked by name so a company is always the same colour. */
const TILE_TONES = [
  { bg: color.accentSoft, fg: color.accentText },
  { bg: color.successSoft, fg: color.success },
  { bg: color.warningSoft, fg: color.warning },
  { bg: color.surfaceSunken, fg: color.textSecondary },
] as const
export function tileTone(name: string | null | undefined) {
  let h = 0
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TILE_TONES[h % TILE_TONES.length]
}

/** Which plate a thread's counterparty draws, from what the server says they are. */
export function plateKindOf(t: Pick<ThreadDto, 'kind' | 'counterparty'>): PlateKind {
  if (t.kind === 'USER_ADMIN' || t.counterparty.role === 'ADMIN') return 'support'
  if (t.counterparty.role === 'EMPLOYER') return 'company'
  if (t.kind === 'STUDENT_INTERVIEWER' && t.counterparty.masked) return 'masked'
  return 'person'
}

const initialsSize = (size: number) => Math.round(size * INITIALS)

/** The company square on its own — also what Interests and Connections draw (LogoTile). */
export function CompanyTile({ name, size, muted }: { name: string | null | undefined; size: number; muted?: boolean }) {
  const tone = muted ? { bg: color.surfaceMuted, fg: color.textSubtle } : tileTone(name)
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.centre, { width: size, height: size, borderRadius: Math.round(size * TILE_CORNER), backgroundColor: tone.bg }]}
    >
      <Text style={[s.initials, { fontSize: initialsSize(size), color: tone.fg }]}>{monogram(name)}</Text>
    </View>
  )
}

function PersonPlate({ name, photoUrl, size, muted }: { name: string | null | undefined; photoUrl?: string | null; size: number; muted?: boolean }) {
  const round = { width: size, height: size, borderRadius: radius.pill }
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={[round, s.photo, muted && s.mutedPhoto]} accessibilityIgnoresInvertColors />
  }
  return (
    <View style={[s.centre, round, s.clip, muted && s.personMuted]}>
      {!muted && (
        <Svg style={StyleSheet.absoluteFill} width={size} height={size}>
          <Defs>
            <LinearGradient id="chatPlate" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color.accentMuted} />
              <Stop offset="1" stopColor={color.accent} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size} height={size} fill="url(#chatPlate)" />
        </Svg>
      )}
      <Text style={[s.initials, { fontSize: initialsSize(size), color: muted ? color.textMuted : color.textInverse }]}>{monogram(name)}</Text>
    </View>
  )
}

function Lifebuoy({ size, stroke }: { size: number; stroke: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={3.6} />
      <Path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </Svg>
  )
}

/** A plate by kind, for a caller that already knows what it is drawing. */
export function Plate({ kind, name, photoUrl, size, muted }: {
  kind: PlateKind; name: string | null | undefined; photoUrl?: string | null; size: number; muted?: boolean
}) {
  const round = { width: size, height: size, borderRadius: radius.pill }
  switch (kind) {
    case 'company':
      return <CompanyTile name={name} size={size} muted={muted} />
    case 'masked':
      return <View style={[s.centre, round, s.masked]}><LogoMark size={Math.round(size * GLYPH)} fill={color.textInverse} /></View>
    case 'support':
      return <View style={[s.centre, round, s.support]}><Lifebuoy size={Math.round(size * GLYPH)} stroke={color.info} /></View>
    default:
      return <PersonPlate name={name} photoUrl={photoUrl} size={size} muted={muted} />
  }
}

/** A thread's counterparty plate. A company never shows a photo; a person does when the server sends one. */
export function ChatPlate({ thread, size, muted }: { thread: Pick<ThreadDto, 'kind' | 'counterparty'>; size: number; muted?: boolean }) {
  const kind = plateKindOf(thread)
  return <Plate kind={kind} name={thread.counterparty.name} photoUrl={kind === 'person' ? thread.counterparty.photoUrl : null} size={size} muted={muted} />
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  initials: { fontFamily: FF.bodyBold },
  photo: { backgroundColor: color.surfaceMuted },
  mutedPhoto: { opacity: opacity.disabled },
  personMuted: { backgroundColor: color.border },
  masked: { backgroundColor: color.ink },
  support: { backgroundColor: color.infoSoft },
})
