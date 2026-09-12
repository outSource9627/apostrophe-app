import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { color, space, radius, fontSize, fontFamilyNative } from '../theme'

/**
 * The student's card, before the interview exists. Mirrors the web component of
 * the same name — PRD section 7 treats a divergence between the two surfaces as
 * a defect, and this is the object the whole paywall argument rests on.
 *
 * Everything except the film is ALREADY theirs: name, city and qualification,
 * captured at registration, laid out as an employer will eventually see them.
 * Only the video well is empty, drawn as a frame waiting for a portrait rather
 * than a blurred paywall.
 *
 * Nothing here is invented. An unpaid student has no profile (ST-10), so there
 * are no skills, and the card says so instead of filling the space.
 */
export function UnfinishedCard({
  name,
  city,
  qualificationLabel,
}: {
  name: string
  city?: string
  qualificationLabel?: string
}) {
  return (
    <View style={styles.card}>
      <View style={styles.well}>
        <Corner style={{ top: space.md, left: space.md }} sides="tl" />
        <Corner style={{ top: space.md, right: space.md }} sides="tr" />
        <Corner style={{ bottom: space.md, left: space.md }} sides="bl" />
        <Corner style={{ bottom: space.md, right: space.md }} sides="br" />

        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={10.5} width={16} height={10} rx={2} stroke={color.textSubtle} strokeWidth={1.25} />
          <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" stroke={color.textSubtle} strokeWidth={1.25} strokeLinecap="round" />
        </Svg>
        <Text style={styles.wellLabel}>YOUR INTERVIEW GOES HERE</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {!!city && <Text style={styles.city}>{city.toUpperCase()}</Text>}
        </View>
        {!!qualificationLabel && <Text style={styles.qualification}>{qualificationLabel}</Text>}
        <Text style={styles.later}>Skills, experience and links are added after you pay.</Text>
      </View>
    </View>
  )
}

function Corner({ style, sides }: { style: object; sides: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <View
      style={[styles.corner, style, styles[sides]]}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  well: {
    height: height['well-compact'],
    backgroundColor: color.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  corner: { position: 'absolute', width: space['20'], height: space['20'], borderColor: color.borderStrong },
  tl: { borderLeftWidth: borderWidth.thin, borderTopWidth: borderWidth.thin },
  tr: { borderRightWidth: borderWidth.thin, borderTopWidth: borderWidth.thin },
  bl: { borderLeftWidth: borderWidth.thin, borderBottomWidth: borderWidth.thin },
  br: { borderRightWidth: borderWidth.thin, borderBottomWidth: borderWidth.thin },
  wellLabel: {
    fontSize: fontSize.xs,
    letterSpacing: trackingNative.eyebrow,
    color: color.textSubtle,
  },
  body: { paddingHorizontal: space['17'], paddingTop: space['15'], paddingBottom: space['17'] },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  name: { fontFamily: fontFamilyNative.display, fontSize: fontSize['19'], color: color.text, flexShrink: 1 },
  city: { fontSize: fontSize['10-5'], letterSpacing: trackingNative.wide, color: color.textSubtle },
  qualification: { marginTop: space.xs, fontSize: fontSize['12-5'], color: color.textMuted },
  later: { marginTop: space['11'], fontSize: fontSize.sm, color: color.textSubtle },
})
