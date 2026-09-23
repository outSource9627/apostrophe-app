import React from 'react'
import { StyleSheet, View } from 'react-native'
import { color, space, radius, borderWidth } from '../../theme'
import { Body, Card } from '../../components/ui'
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
    <Card style={styles.card}>
      <View style={styles.disc}>
        <LogoMark size={24} />
      </View>
      <View style={styles.body}>
        <Body weight="semibold" size="lg">Your interviewer</Body>
        <Body size="sm" tone="muted">{note}</Body>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: space.md, padding: space.lg,
  },
  disc: {
    width: 56, height: 56, borderRadius: radius.pill, borderWidth: borderWidth.thin,
    borderColor: color.border, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: space.xs, justifyContent: 'center' },
})
