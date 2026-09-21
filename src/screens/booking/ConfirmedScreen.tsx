import React from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { bookingRef, fmtLongDate, fmtTime } from '../../lib/interviews/slots'
import { color, space, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Meta, StatusPill } from '../../components/ui'

/**
 * "Add to calendar" without a native calendar dep: a Google Calendar template
 * URL opens the user's calendar app (or the web) with the event prefilled.
 * Times are UTC (…Z), which every calendar converts to the viewer's zone. A
 * later native build can swap this for a real .ics via a share sheet.
 */
function calendarUrl(iv: StudentInterview): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Your Apostrophe interview',
    dates: `${stamp(iv.slotStart)}/${stamp(iv.slotEnd)}`,
    details: 'A live 20-minute interview with an Apostrophe interviewer. The join link opens ten minutes before.',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/**
 * ST-24 — the booking is real. A moment, not a receipt: the date and time are
 * content in the serif, with air around them. No ring, no badge, no confetti.
 */
export function ConfirmedScreen({
  id, onDeviceCheck, onDone,
}: { id: string; onDeviceCheck: (id: string) => void; onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => api.get<StudentInterview>(`/interviews/${id}`) })

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Home" onBack={onDone} />
      {q.data ? (
        <View style={styles.body}>
          <View style={{ gap: space.xl }}>
            <StatusPill tone="success" label="Booked" />
            <View style={{ gap: space.xs }}>
              <Display level="lg">{fmtLongDate(q.data.slotStart)}</Display>
              <Display level="md" style={{ fontVariant: ['tabular-nums'] }}>{fmtTime(q.data.slotStart)} IST · {q.data.durationMin} minutes</Display>
            </View>
          </View>

          <View style={{ gap: space.sm, marginTop: space['2xl'] }}>
            <Button variant="outline" size="block" full label="Add to calendar" onPress={() => Linking.openURL(calendarUrl(q.data!))} />
            <Body size="xs" tone="subtle">Google, Apple or Outlook. The invite carries the join link.</Body>
          </View>

          <View style={{ gap: space.md, marginTop: space.lg }}>
            <Button variant="primary" size="lg" full label="Run the device check now" onPress={() => onDeviceCheck(id)} />
            <Body size="sm" tone="muted">Two minutes on this phone — camera, microphone and connection — so nothing is a surprise at {fmtTime(q.data.slotStart)}.</Body>
          </View>

          <View style={styles.footRef}>
            <Meta style={{ color: color.textSubtle }}>Booking #{bookingRef(q.data.id)}</Meta>
          </View>
        </View>
      ) : (
        <View style={styles.centre}><Meta style={{ color: color.textMuted }}>CONFIRMING…</Meta></View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: space.xl },
  footRef: { marginTop: 'auto', borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.md },
})
