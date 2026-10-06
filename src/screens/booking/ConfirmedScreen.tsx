import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getInterviewIcs, type StudentInterview } from '../../lib/api/interviews'
import { minutesPhrase, useBookingRules } from '../../lib/interviews/rules'
import { bookingRef, fmtShortDate, fmtTime } from '../../lib/interviews/slots'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Icon } from '../../components/ui/Icon'
import { Btn, Skel } from '../../components/tab/kit'
import { Disc, Eyebrow, FlowFooter, FlowHeader, Lead, Sub } from '../../components/tab/flow'

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
 * SC-08 — the server's .ics (UTC times, stable UID, no interviewer identity),
 * handed to the OS share sheet as the event text. The app has no file-system
 * module, so this shares the calendar content rather than a saved .ics file; the
 * booking confirmation EMAIL carries the real .ics attachment, which is the
 * reliable way to import it. Fails quietly — Google Calendar above still works.
 */
async function shareIcs(id: string) {
  try {
    const ics = await getInterviewIcs(id)
    await Share.share({ title: 'apostrophe-interview.ics', message: ics })
  } catch {
    // Nothing to show: the "Add to calendar" button beside it is the primary path.
  }
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
      <FlowHeader onClose={onDone} />
      {q.data ? (
        <>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Disc tone="ok"><Icon name="check" size={26} tint={color.successFill} weight={2.2} /></Disc>
            <View style={styles.head}>
              <Eyebrow tone="ok">Booked · {bookingRef(q.data.id)}</Eyebrow>
              <Lead>{`${fmtShortDate(q.data.slotStart)} · ${fmtTime(q.data.slotStart)}`}</Lead>
              <Sub>{fmtTime(q.data.slotEnd)} IST · {q.data.durationMin} min · in the app</Sub>
            </View>

            <View>
              <View style={styles.prepHead}>
                <Text style={styles.prepHeadText}>Before your interview</Text>
                <Text style={styles.count}>{ticked.filter(Boolean).length} / {prep.length}</Text>
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
                    {ticked[i] && <Icon name="check" size={14} tint={color.textInverse} weight={3} />}
                  </View>
                  <View style={styles.prepText}>
                    <Text style={[styles.prepTitle, { color: ticked[i] ? color.textSubtle : color.text }]}>{p.title}</Text>
                    <Text style={styles.prepSub}>{p.sub}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <FlowFooter>
            <Btn variant="ink" label="Run the device check now" onPress={() => onDeviceCheck(id)} />
            <Btn variant="outline" label="Add to calendar" onPress={() => Linking.openURL(calendarUrl(q.data!, rules?.joinOpensMinutesBefore))} />
            <Btn variant="outline" label="Share calendar file (.ics)" onPress={() => void shareIcs(q.data!.id)} />
          </FlowFooter>
        </>
      ) : (
        <View style={styles.body}><Skel w={56} h={56} round /><Skel w="70%" h={28} /><Skel w="100%" h={120} /></View>
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
  body: { paddingHorizontal: 20, paddingTop: 0, gap: 20, paddingBottom: 20 },
  head: { gap: 6 },
  prepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  prepHeadText: { fontFamily: FF.bodySemiBold, fontSize: 16, color: color.text },
  count: { fontFamily: FF.bodyMedium, fontSize: 12.5, fontVariant: ['tabular-nums'], color: color.textMuted },
  prepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  prepText: { flex: 1, gap: 2 },
  prepTitle: { fontFamily: FF.bodyMedium, fontSize: 15 },
  prepSub: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted },
  box: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: color.accent },
  boxOff: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.borderStrong },
})
