import React from 'react'
import { Text, View } from 'react-native'
import { color, fontFamilyNative as FF, radius } from '../../theme'

// Same six colours as SavedJobsScreen's PALETTE; the tile is picked from the company name so it never changes between renders.
const PALETTE = [color.accent, color.successFill, '#E0366B', '#2F6BFF', '#C77D00', color.accentDeep]
const initialsOf = (name?: string | null) => (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'
const tileColor = (name?: string | null) => {
  const n = name ?? '?'
  let sum = 0
  for (const ch of n) sum += ch.charCodeAt(0)
  return PALETTE[sum % PALETTE.length]
}

/** A solid-colour company tile with white initials. Tolerates a missing name. */
export function LogoTile({ name, size = 44 }: { name?: string | null; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: tileColor(name), borderRadius: size < 40 ? 12 : radius.md }}>
      <Text style={{ fontFamily: FF.bodyBold, fontSize: size < 40 ? 10 : 11, letterSpacing: 0.66, color: color.textInverse }}>{initialsOf(name)}</Text>
    </View>
  )
}
