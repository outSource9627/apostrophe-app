import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { minutesPhrase, useBookingRules } from '../../lib/interviews/rules'
import { bookingRef, fmtShortDate, fmtTime } from '../../lib/interviews/slots'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'

/**
 * "Add to calendar" without a native calendar dep: a Google Calendar template
 * URL opens the user's calendar app (or the web) with the event prefilled.
 * Times are UTC (…Z), which every calendar converts to the viewer's zone. A
 * later native build can swap this for a real .ics via a share sheet.
 */
function calendarUrl(iv: StudentInterview, joinOpensMinutesBefore?: number): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Your Apostrophe interview',
    dates: `${stamp(iv.slotStart)}/${stamp(iv.slotEnd)}`,
    details: `A live ${iv.durationMin}-minute interview with an Apostrophe interviewer. The join link opens ${joinOpensMinutesBefore != null ? `${minutesPhrase(joinOpensMinutesBefore)} before` : 'shortly before'}.`,
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
  const { rules } = useBookingRules()
  const [ticked, setTicked] = useState<boolean[]>([false, false, false, false])
  const time = q.data ? fmtTime(q.data.slotStart) : ''
  const prep = prepSteps(time)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader onClose={onDone} />
      {q.data ? (
        <>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.tick}><Text style={styles.tickMark}>✓</Text></View>
            <View style={styles.head}>
              <Text style={[text.metaMd, styles.booked]}>BOOKED · {bookingRef(q.data.id)}</Text>
              <Text style={text.displayLead}>{`${fmtShortDate(q.data.slotStart)} · ${fmtTime(q.data.slotStart)}`}</Text>
              <Text style={[text.uiMd, styles.sub]}>{fmtTime(q.data.slotEnd)} IST · {q.data.durationMin} min · in the app</Text>
            </View>

            <View>
              <View style={styles.prepHead}>
                <Text style={text.uiBaseSemi}>Before your interview</Text>
                <Text style={[text.metaMd, styles.sub]}>{ticked.filter(Boolean).length} / {prep.length}</Text>
              </View>
              {prep.map((p, i) => (
                <Pressable
                  key={p.title}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ticked[i] }}
                  onPress={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
                  style={styles.prepRow}
                >
                  <View style={[styles.box, ticked[i] ? styles.boxOn : styles.boxOff]}>
                    {ticked[i] && <Text style={styles.boxMark}>✓</Text>}
                  </View>
                  <View style={styles.prepText}>
                    <Text style={[text.uiMdMedium, { color: ticked[i] ? color.textSubtle : color.text }]}>{p.title}</Text>
                    <Text style={[text.uiXs, styles.sub]}>{p.sub}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <StickyFooter>
            <Button variant="secondary" size="lg" full label="Run the device check now" onPress={() => onDeviceCheck(id)} />
            <Button variant="outline" size="block" full label="Add to calendar" onPress={() => Linking.openURL(calendarUrl(q.data!, rules?.joinOpensMinutesBefore))} />
          </StickyFooter>
        </>
      ) : (
        <View style={styles.body}><Skeleton lines={3} /></View>
      )}
    </View>
  )
}

/** Four things to do before the room — the same list the web page carries; ticks live in the screen and go with it. */
function prepSteps(time: string): { title: string; sub: string }[] {
  return [
    { title: 'Test your camera and mic', sub: `Two minutes — camera, microphone and connection — so nothing is a surprise at ${time}.` },
    { title: 'Find somewhere quiet', sub: 'Silence your phone.' },
    { title: 'Face a light', sub: 'Avoid a bright window behind you.' },
    { title: 'Look at the camera, not at the screen', sub: 'Keep your head and shoulders inside the guide.' },
  ]
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: spaceHalf['6'], gap: space.xl, paddingBottom: space.xl },
  tick: { width: height['fab'], height: height['fab'], borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  tickMark: { ...text.displayLead, color: color.successFill },
  head: { gap: space.sm },
  booked: { color: color.success, letterSpacing: trackingNative.eyebrow },
  sub: { color: color.textMuted },
  prepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spaceHalf['1.5'] },
  prepRow: { minHeight: height['control-lg'], flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'], paddingVertical: space.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  prepText: { flex: 1, gap: space['2xs'] },
  box: { width: height.radio, height: height.radio, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.accent },
  boxOff: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  boxMark: { ...text.uiXs, color: color.textInverse },
})
