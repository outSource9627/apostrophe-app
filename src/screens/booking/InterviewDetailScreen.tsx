import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { fmtLongDate, fmtTime } from '../../lib/interviews/slots'
import { useCountdown } from '../../lib/interviews/useCountdown'
import { color, space, radius, borderWidth, fontFamilyNative } from '../../theme'
import { AppBar, Banner, Body, Button, Display, Eyebrow, Meta, ProgressBar, StatusPill } from '../../components/ui'
import { InterviewerPlate } from './InterviewerPlate'

/**
 * ST-26 / ST-26-join — one booked interview. The reading comes from the server:
 * `roomReady` is the join window, `status` a no-show. The reassignment state is
 * not built — the student DTO never carries a reassignment flag (SC-16 masks the
 * interviewer entirely, so a swap is invisible to the student by design).
 */
export function InterviewDetailScreen({
  id, onBack, onReschedule, onCancel, onSupport, onBook, onJoin, onFeedback,
}: {
  id: string
  onBack: () => void
  onReschedule: (id: string) => void
  onCancel: (id: string) => void
  onSupport: () => void
  onBook: () => void
  onJoin: () => void
  onFeedback: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => api.get<StudentInterview>(`/interviews/${id}`) })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="My interviews" onBack={onBack} />{child}</View>
  )
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">This interview could not be found.</Body></View>)

  const iv = q.data!
  const noShow = iv.status === 'STUDENT_NO_SHOW' || iv.status === 'INTERVIEWER_NO_SHOW'
  if (noShow) return frame(<Missed iv={iv} insets={insets} onSupport={onSupport} onBook={onBook} />)
  if (iv.roomReady) return frame(<JoinOpen iv={iv} onJoin={onJoin} />)
  if (iv.status === 'BOOKED') return frame(<Booked iv={iv} onReschedule={() => onReschedule(id)} onCancel={() => onCancel(id)} />)
  return frame(<Terminal iv={iv} insets={insets} onBook={onBook} onFeedback={onFeedback} />)
}

function When({ iv }: { iv: StudentInterview }) {
  return (
    <View style={{ gap: space.xs }}>
      <Display level="md">{fmtLongDate(iv.slotStart)}</Display>
      <Display level="md" style={{ fontVariant: ['tabular-nums'] }}>{fmtTime(iv.slotStart)} IST</Display>
      <Body size="sm" tone="muted" style={{ marginTop: space.xs }}>{iv.durationMin} minutes · {iv.tier} · Asia/Kolkata</Body>
    </View>
  )
}

function Booked({ iv, onReschedule, onCancel }: { iv: StudentInterview; onReschedule: () => void; onCancel: () => void }) {
  const { hms } = useCountdown(iv.slotStart)
  const openT = fmtTime(new Date(new Date(iv.slotStart).getTime() - 10 * 60000).toISOString())
  const closeT = fmtTime(new Date(new Date(iv.slotStart).getTime() + 15 * 60000).toISOString())
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <StatusPill tone="neutral" label="Booked" />
      <When iv={iv} />
      <View style={styles.well}>
        <Eyebrow>Starts in</Eyebrow>
        <Meta style={styles.clock}>{hms}</Meta>
      </View>
      <InterviewerPlate note="Assigned, and kept unnamed until the session starts. Every student gets the same interviewer on the same terms, and nobody can shop for a soft one." />
      <View style={{ gap: space.md }}>
        <Eyebrow>Join window · {openT} – {closeT} IST</Eyebrow>
        <Button variant="primary" size="lg" full disabled label="Join interview" reason={`Opens at ${openT}, ten minutes before. It closes at ${closeT}.`} />
      </View>
      <View style={styles.subordinate}>
        <Button variant="text" size="md" label="Reschedule" onPress={onReschedule} />
        <View style={styles.vrule} />
        <Button variant="text" size="md" label="Cancel" onPress={onCancel} />
      </View>
    </ScrollView>
  )
}

function JoinOpen({ iv, onJoin }: { iv: StudentInterview; onJoin: () => void }) {
  const closeIso = new Date(new Date(iv.slotStart).getTime() + 15 * 60000).toISOString()
  const toStart = useCountdown(iv.slotStart)
  const toClose = useCountdown(closeIso)
  const started = toStart.expired
  const closeT = fmtTime(closeIso)
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.rowBetween}>
        <StatusPill tone="accent" label="Join open" dot />
        <Meta style={{ color: started ? color.warning : color.textSubtle }}>{started ? 'Closing' : `Closes ${closeT} IST`}</Meta>
      </View>
      <View style={{ gap: space.md }}>
        <Eyebrow tone="muted">{started ? 'Until join closes' : 'Until your interview starts'}</Eyebrow>
        <Meta style={styles.bigClock}>{started ? toClose.ms : toStart.ms}</Meta>
        {started && (
          <ProgressBar pct={Math.round((toClose.msLeft / (15 * 60 * 1000)) * 100)} tone="warning" />
        )}
        <Body size="sm" tone="muted">
          {started
            ? 'Started — your interviewer is in the room, waiting.'
            : `${fmtLongDate(iv.slotStart)} · ${fmtTime(iv.slotStart)} IST · ${iv.durationMin} minutes · ${iv.tier}`}
        </Body>
      </View>
      {started && <Banner tone="warning">{`Join closes at ${closeT}. After that this is a no-show and the interview you paid for is spent.`}</Banner>}
      <InterviewerPlate note="You will see who it is the moment the session starts — that is the first thing that happens in the room." />
      <View style={{ gap: space.md }}>
        <Button variant="primary" size="lg" full label="Join interview" onPress={onJoin} />
        <Button variant="outline" size="block" full label="Run the device check" onPress={onJoin} />
      </View>
    </ScrollView>
  )
}

function Missed({ iv, insets, onSupport, onBook }: { iv: StudentInterview; insets: { bottom: number }; onSupport: () => void; onBook: () => void }) {
  const closeT = fmtTime(new Date(new Date(iv.slotStart).getTime() + 15 * 60000).toISOString())
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <StatusPill tone="danger" label="No show" />
      <When iv={iv} />
      <View style={styles.dangerCard}>
        <Eyebrow tone="danger">What happened</Eyebrow>
        <Body size="sm">Join stayed open until {closeT} and nobody arrived. Your interviewer waited the full fifteen minutes.</Body>
        <Body size="sm">Your interview was spent. Nothing was refunded.</Body>
      </View>
      <View style={{ gap: space.md }}>
        <Button variant="primary" size="lg" full label="Ask admin to look at this" onPress={onSupport} />
        <Body size="xs" tone="subtle">If your network or your phone failed you, say so — an admin can return the interview.</Body>
      </View>
      <View style={{ marginTop: space.lg, paddingBottom: insets.bottom }}>
        <Button variant="outline" size="block" full label="Buy another interview" onPress={onBook} />
      </View>
    </ScrollView>
  )
}

function Terminal({ iv, insets, onBook, onFeedback }: { iv: StudentInterview; insets: { bottom: number }; onBook: () => void; onFeedback: () => void }) {
  const done = iv.status === 'COMPLETED'
  const label = done ? 'Completed' : iv.status === 'CANCELLED' ? 'Cancelled' : iv.status === 'RESCHEDULED' ? 'Rescheduled' : 'Under review'
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <StatusPill tone={done ? 'success' : 'neutral'} label={label} />
      <When iv={iv} />
      {done && <Body tone="muted">Your interview is done. When your film is published it becomes your video resume.</Body>}
      <View style={{ marginTop: space.lg, paddingBottom: insets.bottom, gap: space.sm }}>
        {done && <Button variant="primary" size="block" full label="See my feedback" onPress={onFeedback} />}
        <Button variant="outline" size="block" full label="Book another interview" onPress={onBook} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  well: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.lg, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  clock: { fontFamily: fontFamilyNative.monoMedium, fontSize: 15, letterSpacing: 1, color: color.text },
  bigClock: { fontFamily: fontFamilyNative.monoMedium, fontSize: 56, letterSpacing: 2, color: color.text },
  subordinate: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: 'auto', paddingTop: space.lg, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  vrule: { width: 1, height: 16, backgroundColor: color.border },
  dangerCard: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, backgroundColor: color.dangerSoft, padding: space.lg, gap: space.sm },
})
