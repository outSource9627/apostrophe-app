import React from 'react'
import { Text, View, StyleSheet, Platform } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { color, fontSize } from '../theme'

/**
 * The Apostrophe mark, same path as the web build so the two cannot drift.
 * Drawn rather than shipped as a PNG because it appears from 18px to 120px.
 */
export function LogoMark({ size = 24, fill = color.ink }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M62.5 8C42.8 8 28 21.6 28 39.2c0 15.4 11.4 26.6 26.4 26.6 4.6 0 8.6-1 11.9-2.9 1.7-1 3.3.9 2.3 2.7C62.2 76.4 51.6 85.6 38.4 92.4l4.9 8.6C67.4 89.4 84 68.6 84 43.5 84 22.6 75.4 8 62.5 8Z"
        fill={fill}
      />
    </Svg>
  )
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
      <LogoMark size={size} fill={tint} />
      <Text style={[styles.word, { fontSize: size * 1.15, color: tint }]}>Apostrophe</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space['6'] },
  word: {
    fontFamily: Platform.select(fontFamilyNativeWordmark),
    letterSpacing: trackingNative.snug,
    lineHeight: fontSize['2xl'],
  },
})
