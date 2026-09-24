import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { fmtShortDate, fmtTime } from '../../lib/interviews/slots'
import { statusMark } from '../../lib/interviews/status'
import { minutesPhrase, useBookingRules, type BookingRules } from '../../lib/interviews/rules'
import { useCountdown } from '../../lib/interviews/useCountdown'
import { color, space, spaceHalf, radius, trackingNative } from '../../theme'
import { Banner, Button, Card, ErrorState, InkCard, InkPill, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'
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
  const booking = useBookingRules()

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><ScreenHeader title="Interview" onBack={onBack} />{child}</View>
  )
  if (q.isPending || booking.pending) return frame(<View style={styles.loading}><Skeleton lines={4} /></View>)
  if (q.isError || !booking.rules) return frame(
    <View style={styles.centre}>
      <ErrorState
        title={q.isError ? 'This interview could not be found.' : 'Could not load the booking settings.'}
        body={booking.error ?? 'Nothing has changed on your booking.'}
        action={<Button variant="outline" size="sm" label="Try again" onPress={() => { void q.refetch(); booking.retry() }} />}
      />
    </View>,
  )

  const iv = q.data!
  const w = joinWindow(iv, booking.rules)
  const noShow = iv.status === 'STUDENT_NO_SHOW' || iv.status === 'INTERVIEWER_NO_SHOW'
  if (noShow) return frame(<Missed iv={iv} w={w} onSupport={onSupport} onBook={onBook} />)
  if (iv.roomReady) return frame(<JoinOpen iv={iv} w={w} onJoin={onJoin} />)
  if (iv.status === 'BOOKED') return frame(<Booked iv={iv} w={w} onReschedule={() => onReschedule(id)} onCancel={() => onCancel(id)} />)
  return frame(<Terminal iv={iv} onBook={onBook} onFeedback={onFeedback} />)
}

/** When join opens and closes, from the admin's settings. `closeIso` is null when the backend does not say. */
interface JoinWindow { openIso: string; closeIso: string | null; opensBefore: number; closesAfter?: number }
function joinWindow(iv: StudentInterview, rules: BookingRules): JoinWindow {
  const start = new Date(iv.slotStart).getTime()
  return {
    openIso: new Date(start - rules.joinOpensMinutesBefore * 60000).toISOString(),
    closeIso: rules.noShowMinutesAfter == null ? null : new Date(start + rules.noShowMinutesAfter * 60000).toISOString(),
    opensBefore: rules.joinOpensMinutesBefore,
    closesAfter: rules.noShowMinutesAfter,
  }
}

/** The design's ink "upcoming" card (Android M4), carrying this interview's date. */
function WhenCard({ iv, pill, right, children }: { iv: StudentInterview; pill: string; right?: string; children?: React.ReactNode }) {
  return (
    <InkCard>
      <View style={styles.inkTop}>
        <InkPill label={pill} />
        {!!right && <Text style={[text.metaMd, styles.onInkMuted]}>{right.toUpperCase()}</Text>}
      </View>
      <Text style={[text.displaySm, styles.onInk]}>{`${fmtShortDate(iv.slotStart)} · ${fmtTime(iv.slotStart)}`}</Text>
      <Text style={[text.uiSm, styles.onInkMuted]}>{`${iv.durationMin}-minute interview · ${iv.tier} · IST`}</Text>
      {children}
    </InkCard>
  )
}

function Booked({ iv, w, onReschedule, onCancel }: { iv: StudentInterview; w: JoinWindow; onReschedule: () => void; onCancel: () => void }) {
  const { hms } = useCountdown(iv.slotStart)
  const openT = fmtTime(w.openIso)
  const closeT = w.closeIso ? fmtTime(w.closeIso) : null
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill="Booked">
          <View style={styles.clockWell}>
            <Text style={[text.metaSm, styles.onInkMuted]}>STARTS IN</Text>
            <Text style={[text.metaXl, styles.onInk]}>{hms}</Text>
          </View>
        </WhenCard>
        <InterviewerPlate note="Assigned, and kept unnamed until the session starts. Every student gets the same interviewer on the same terms, and nobody can shop for a soft one." />
        <Card style={styles.windowCard}>
          <Text style={[text.metaSm, styles.eyebrow]}>{closeT ? `JOIN WINDOW · ${openT} – ${closeT} IST` : `JOIN OPENS · ${openT} IST`}</Text>
          <Text style={[text.uiMd, styles.muted]}>
            {`Join opens ${minutesPhrase(w.opensBefore)} before the start${closeT ? ` and closes at ${closeT}` : ''}. Run the device check before then.`}
          </Text>
        </Card>
      </ScrollView>
      <StickyFooter inset={false}>
        <Button variant="primary" size="lg" full disabled label="Join interview" />
        <View style={styles.footRow}>
          {/* Always offered: when a move or a cancel is not allowed, those screens say why and route to a person. */}
          <View style={styles.grow}><Button variant="outline" size="md" full label="Reschedule" onPress={onReschedule} /></View>
          <View style={styles.grow}><Button variant="outline" size="md" full label="Cancel" onPress={onCancel} /></View>
        </View>
      </StickyFooter>
    </>
  )
}

function JoinOpen({ iv, w, onJoin }: { iv: StudentInterview; w: JoinWindow; onJoin: () => void }) {
  const toStart = useCountdown(iv.slotStart)
  const toClose = useCountdown(w.closeIso)
  const started = toStart.expired
  const closeT = w.closeIso ? fmtTime(w.closeIso) : null
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill={started ? 'Started' : 'Join open'} right={closeT ? `Closes ${closeT}` : undefined}>
          <View style={styles.clockWell}>
            <Text style={[text.metaSm, styles.onInkMuted]}>{started ? (closeT ? 'UNTIL JOIN CLOSES' : 'STARTED') : 'STARTS IN'}</Text>
            <Text style={[text.metaXl, styles.onInk]}>{started ? (closeT ? toClose.ms : '—') : toStart.ms}</Text>
          </View>
        </WhenCard>
        {started && (
          <Banner tone="warning">
            {closeT
              ? `Your interviewer is in the room, waiting. Join closes at ${closeT} — after that this is a no-show and the interview you paid for is spent.`
              : 'Your interviewer is in the room, waiting. Join now — a missed interview is spent.'}
          </Banner>
        )}
        <InterviewerPlate note="You will see who it is the moment the session starts — that is the first thing that happens in the room." />
      </ScrollView>
      <StickyFooter inset={false}>
        <Button variant="primary" size="lg" full label="Join interview" onPress={onJoin} />
        <Button variant="outline" size="md" full label="Run the device check" onPress={onJoin} />
      </StickyFooter>
    </>
  )
}

function Missed({ iv, w, onSupport, onBook }: { iv: StudentInterview; w: JoinWindow; onSupport: () => void; onBook: () => void }) {
  const closeT = w.closeIso ? fmtTime(w.closeIso) : null
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill="No show" />
        <Card style={styles.dangerCard}>
          <Text style={[text.metaSm, styles.dangerText]}>WHAT HAPPENED</Text>
          <Text style={text.uiMd}>
            {closeT
              ? `Join stayed open until ${closeT} and nobody arrived. Your interviewer waited the full ${minutesPhrase(w.closesAfter!)}.`
              : 'Join stayed open and nobody arrived. Your interviewer waited for you.'}
          </Text>
          <Text style={text.uiMd}>Your interview was spent. Nothing was refunded.</Text>
        </Card>
        <Text style={[text.uiXs, styles.muted]}>If your network or your phone failed you, say so — an admin can return the interview.</Text>
      </ScrollView>
      <StickyFooter inset={false}>
        <Button variant="primary" size="lg" full label="Ask admin to look at this" onPress={onSupport} />
        <Button variant="outline" size="md" full label="Buy another interview" onPress={onBook} />
      </StickyFooter>
    </>
  )
}

function Terminal({ iv, onBook, onFeedback }: { iv: StudentInterview; onBook: () => void; onFeedback: () => void }) {
  const done = iv.status === 'COMPLETED'
  const mark = statusMark(iv.status)
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill={mark.label} />
        {done && (
          <Card style={styles.windowCard}>
            <Text style={text.uiBaseSemi}>Your interview is done.</Text>
            <Text style={[text.uiMd, styles.muted]}>When your film is published it becomes your video resume. Your scorecard arrives separately.</Text>
          </Card>
        )}
      </ScrollView>
      <StickyFooter inset={false}>
        {done && <Button variant="primary" size="lg" full label="See my scorecard" onPress={onFeedback} />}
        <Button variant={done ? 'outline' : 'primary'} size={done ? 'md' : 'lg'} full label="Book another interview" onPress={onBook} />
      </StickyFooter>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  inkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  clockWell: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xs,
    paddingHorizontal: space.md, paddingVertical: spaceHalf['2.5'], borderRadius: radius.tile, backgroundColor: color.onInkGround,
  },
  windowCard: { padding: space.lg, gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  footRow: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  grow: { flex: 1 },
  dangerCard: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder, padding: space.lg, gap: space.sm },
  dangerText: { color: color.danger, letterSpacing: trackingNative.eyebrow },
})
