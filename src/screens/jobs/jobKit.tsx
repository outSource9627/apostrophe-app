import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { color, fontFamilyNative as FF } from '../../theme'
import { Icon } from '../../components/ui/Icon'

/** Option A's inline notice (docs/student-job-detail-mockup.html): a 14-radius tinted band with a glyph and one line. */
export function Notice({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  const fg = tone === 'warning' ? color.warning : color.danger
  return (
    <View style={[styles.notice, { backgroundColor: tone === 'warning' ? color.warningSoft : color.dangerSoft }]}>
      <View style={styles.glyph}><Icon name="alert" size={18} tint={fg} /></View>
      <Text style={[styles.text, { color: fg }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  glyph: { marginTop: 1 },
  text: { flex: 1, fontFamily: FF.body, fontSize: 14, lineHeight: 20 },
})
