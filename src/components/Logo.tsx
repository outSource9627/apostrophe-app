import React from 'react'
import { Image, Text, View, StyleSheet, Platform } from 'react-native'
import { brand, color, fontSize, space, fontFamilyNativeWordmark, trackingNative } from '../theme'

// The brand's own artwork, cut from the supplied icon (the same files the web build ships).
const MARK = require('../assets/brand/lenient-mark.png')
const ICON = require('../assets/brand/lenient-icon.png')
/** The cut L's width over its height (244 × 256), so the box can stay square. */
const MARK_ASPECT = 244 / 256

/**
 * The Lenient mark: the lacquered red italic L on its own, in a square box of
 * `size`. Its colour is fixed — it reads on white and on ink, never on the brand
 * red — so a place that used to tint the glyph now just places it.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Image source={MARK} style={{ width: Math.round(size * MARK_ASPECT), height: size }} resizeMode="contain" />
    </View>
  )
}

/** The app icon itself — the white tile with the red L — rounded the way the launcher icon is. */
export function LogoTile({ size = 30 }: { size?: number }) {
  return <Image source={ICON} style={{ width: size, height: size, borderRadius: Math.round(size * brand.markRadiusRatio) }} />
}

/**
 * The wordmark uses the platform serif rather than a bundled font file. Adding
 * Playfair to the app means shipping four weights through both native build
 * systems for one word — the platform serif carries the same intent at a
 * fraction of the cost, and this is the only serif in the app.
 */
export function Logo({ size = 20, tint = color.ink }: { size?: number; tint?: string }) {
  return (
    <View style={styles.row}>
      <LogoTile size={size} />
      <Text style={[styles.word, { fontSize: size * 1.15, color: tint }]}>Lenient</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  word: {
    fontFamily: Platform.select(fontFamilyNativeWordmark),
    letterSpacing: trackingNative['snug-sm'],
    lineHeight: fontSize['display-md'],
  },
})
