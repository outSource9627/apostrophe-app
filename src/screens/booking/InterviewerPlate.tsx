import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { LogoMark } from '../../components/Logo'

/**
 * SC-16 — the generic interviewer plate, and it is the FINISHED design. The
 * name, photo and background are never sent to the student before the session
 * starts, so there is nothing here to reveal: the Apostrophe mark on a muted
 * disc says exactly what is true — an interviewer is assigned — and the note
 * says why the name is held.
 *
 * The disc has no shared Avatar primitive to move to yet — `components/ui`
 * does not export one — so it stays hand-built here, on tokens, the same way
 * every other avatar-shaped disc in the app (chat, wallet, dashboard) still
 * does until that component exists.
 */
export function InterviewerPlate({ note }: { note: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.disc}>
        <LogoMark size={24} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Your interviewer</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 14, padding: 16, borderRadius: 18,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  disc: {
    width: 52, height: 52, borderRadius: 26, borderWidth: borderWidth.thin,
    borderColor: color.border, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  title: { fontFamily: FF.bodySemiBold, fontSize: 16, color: color.text },
  note: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
})
