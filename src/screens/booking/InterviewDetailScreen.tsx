import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { fmtShortDate, fmtTime } from '../../lib/interviews/slots'
import { feedbackNote, statusMark } from '../../lib/interviews/status'
import { minutesPhrase, useBookingRules, type BookingRules } from '../../lib/interviews/rules'
import { useCountdown } from '../../lib/interviews/useCountdown'
import {
  LIVE_POLL_MS, isLate, lateClock, lateClockLabel, lateJoin, studentLateInput, useLateRules, useTicker, type LateJoin,
} from '../../lib/interviews/late'
import { LateBand, LateDrain, LatePill, OtherLine, RedInkFill, lateCard, lateTint } from '../../lib/interviews/LateJoin'
import { color, fontFamilyNative as FF, radius, space } from '../../theme'
import { Btn, DetailHeader, FooterBar, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { InterviewerPlate } from './InterviewerPlate'

/**
 * ST-26 / ST-26-join — one booked interview. The reading comes from the server:
 * `roomReady` is the join window, `status` a no-show. The reassignment state is
 * not built — the student DTO never carries a reassignment flag (SC-16 masks the
 * interviewer entirely, so a swap is invisible to the student by design).
 *
 * While the join window is open the card carries the late-join warning
 * (lib/interviews/late.ts): the clock below zero past the start, amber then the
 * red fill, and whether the interviewer is in the room — the server's yes/no,
 * re-read every few seconds; never a name.
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
  const booking = useBookingRules()
  const lateRules = useLateRules()
  const q = useQuery({
    queryKey: ['interview', id],
    queryFn: () => api.get<StudentInterview>(`/interviews/${id}`),
    // In the join window, presence and the session's start are re-read every few seconds.
    refetchInterval: (query) =>
      query.state.data && lateJoin(studentLateInput(query.state.data), lateRules, Date.now()).phase !== 'off' ? LIVE_POLL_MS : false,
  })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><DetailHeader title="Interview" onBack={onBack} />{child}</View>
  )
  if (q.isPending || booking.pending) {
    return frame(
      <View style={styles.loading}>
        <Skel w="100%" h={190} />
        <Skel w="100%" h={90} />
        <Skel w="100%" h={90} />
      </View>,
    )
  }
  if (q.isError || !booking.rules) {
    return frame(
      <StateBlock
        icon="alert"
        title={q.isError ? 'This interview could not be found.' : 'Could not load the booking settings.'}
        body={booking.error ?? 'Nothing has changed on your booking.'}
        action="Try again"
        onAction={() => { void q.refetch(); booking.retry() }}
      />,
    )
  }

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

/** The ink card carrying this interview's date, with the clock inside it. `late` turns it amber, then red. */
function WhenCard({ iv, pill, right, late, children }: { iv: StudentInterview; pill: string; right?: string; late?: LateJoin; children?: React.ReactNode }) {
  return (
    <View style={[styles.ink, late && lateCard(late, true)]}>
      {late?.phase === 'red' && <RedInkFill />}
      <View style={styles.inkTop}>
        {late && isLate(late) ? <LatePill j={late} onInk /> : <View style={styles.inkPill}><Text style={styles.inkPillText}>{pill}</Text></View>}
        {!!right && <Text style={styles.inkRight}>{right}</Text>}
      </View>
      <Text style={styles.inkTitle}>{`${fmtShortDate(iv.slotStart)} · ${fmtTime(iv.slotStart)}`}</Text>
      <Text style={styles.inkSub}>{`${iv.durationMin}-minute interview · ${iv.tier} · IST`}</Text>
      {children}
    </View>
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
          <Clock label="Starts in" value={hms} />
        </WhenCard>
        <InterviewerPlate note="Assigned, and kept unnamed until the session starts. Every student gets the same interviewer on the same terms, and nobody can shop for a soft one." />
        <Panel>
          <Text style={styles.eyebrow}>{closeT ? `Join window · ${openT} – ${closeT} IST` : `Join opens · ${openT} IST`}</Text>
          <Text style={styles.prose}>
            {`Join opens ${minutesPhrase(w.opensBefore)} before the start${closeT ? ` and closes at ${closeT}` : ''}. Run the device check before then.`}
          </Text>
        </Panel>
      </ScrollView>
      <FooterBar>
        <Btn disabled label="Join interview" />
        <View style={styles.footRow}>
          {/* Always offered: when a move or a cancel is not allowed, those screens say why and route to a person. */}
          <Btn variant="outline" label="Reschedule" onPress={onReschedule} style={styles.grow} />
          <Btn variant="outline" label="Cancel" onPress={onCancel} style={styles.grow} />
        </View>
      </FooterBar>
    </>
  )
}

function JoinOpen({ iv, w, onJoin }: { iv: StudentInterview; w: JoinWindow; onJoin: () => void }) {
  const toStart = useCountdown(iv.slotStart)
  const toClose = useCountdown(w.closeIso)
  const rules = useLateRules()
  const now = useTicker(true) || Date.now()
  const late = lateJoin(studentLateInput(iv), rules, now)
  const started = toStart.expired
  const closeT = w.closeIso ? fmtTime(w.closeIso) : null
  const warn = late.phase !== 'off'
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill={started ? 'Started' : 'Join open'} right={closeT ? `Closes ${closeT}` : undefined} late={late}>
          {warn ? (
            <>
              <Clock label={lateClockLabel(late)} value={lateClock(late)} tint={lateTint(late, true)} />
              <View style={styles.lateStack}>
                <LateDrain j={late} onInk />
                <LateBand j={late} onInk />
                {/* The server's yes/no on the interviewer being in the room — never who it is (SC-16). */}
                <OtherLine j={late} who="Interviewer" onInk />
              </View>
            </>
          ) : (
            <Clock label={started ? (closeT ? 'Until join closes' : 'Started') : 'Starts in'} value={started ? (closeT ? toClose.ms : '—') : toStart.ms} />
          )}
        </WhenCard>
        <InterviewerPlate note="You will see who it is the moment the session starts — that is the first thing that happens in the room." />
      </ScrollView>
      <FooterBar>
        <Btn label="Join interview" variant={late.phase === 'red' ? 'destructive' : 'primary'} onPress={onJoin} />
        <Btn variant="outline" label="Run the device check" onPress={onJoin} />
      </FooterBar>
    </>
  )
}

function Missed({ iv, w, onSupport, onBook }: { iv: StudentInterview; w: JoinWindow; onSupport: () => void; onBook: () => void }) {
  const closeT = w.closeIso ? fmtTime(w.closeIso) : null
  // Who was missing decides what happened and what is owed (PRD 6.5); the two must never share one story.
  const interviewerMissed = iv.status === 'INTERVIEWER_NO_SHOW'
  // A session that STARTED and then ended early, decided by an admin (6.3): nobody "did not join" — the story is different.
  const reviewed = Boolean(iv.reviewedAs)
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill={reviewed ? 'Ended early' : interviewerMissed ? 'Interviewer did not join' : 'No show'} />
        <Panel tone={interviewerMissed || reviewed ? 'plain' : 'danger'}>
          <Text style={[styles.eyebrow, !(interviewerMissed || reviewed) && styles.dangerText]}>What happened</Text>
          {reviewed ? (
            <>
              <Text style={styles.prose}>
                {interviewerMissed
                  ? 'Your session started but ended early. After review, it was recorded as your interviewer leaving or ending it. This is not on you.'
                  : 'Your session started but ended early. After review, it was recorded as you leaving before it could finish.'}
              </Text>
              <Text style={styles.prose}>
                {interviewerMissed
                  ? 'You get a free reschedule, and it is placed ahead of the queue so you are matched sooner.'
                  : 'No refund is due, but you get one free reschedule so you are not out of pocket.'}
              </Text>
            </>
          ) : interviewerMissed ? (
            <>
              <Text style={styles.prose}>{`You were there, but your interviewer did not join${closeT ? ` before ${closeT}` : ''}. This is not on you.`}</Text>
              <Text style={styles.prose}>You get a free reschedule, and it is placed ahead of the queue so you are matched sooner.</Text>
            </>
          ) : (
            <>
              <Text style={styles.prose}>
                {closeT && w.closesAfter != null
                  ? `Join stayed open until ${closeT} and you did not join. The interview was called a no-show after ${minutesPhrase(w.closesAfter)}.`
                  : 'Join stayed open and you did not join, so the interview was called a no-show.'}
              </Text>
              <Text style={styles.prose}>No refund is due, but you get one free reschedule so you are not out of pocket.</Text>
            </>
          )}
        </Panel>
        <Text style={styles.fine}>
          {interviewerMissed ? 'If something here looks wrong, an admin can review it.' : 'If your network or your phone failed you, say so — an admin can review it.'}
        </Text>
      </ScrollView>
      <FooterBar>
        <Btn label="Book your free reschedule" onPress={onBook} />
        <Btn variant="outline" label="Ask admin to look at this" onPress={onSupport} />
      </FooterBar>
    </>
  )
}

function Terminal({ iv, onBook, onFeedback }: { iv: StudentInterview; onBook: () => void; onFeedback: () => void }) {
  const done = iv.status === 'COMPLETED'
  // 6.3 — a session that ended below the completion threshold waits for an admin; the two things an admin can decide
  // that land here are "still waiting" and "it was our platform" (recorded as CANCELLED).
  const underReview = iv.status === 'INCOMPLETE'
  const technical = iv.status === 'CANCELLED' && iv.reviewedAs === 'CANCELLED'
  const mark = statusMark(iv.status)
  // SP-08 — the scorecard is offered only once it exists; while it is expected, or once it never will be, this says so in words.
  const scorecardReady = done && iv.feedback === 'READY'
  const note = done ? feedbackNote(iv.feedback) : null
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <WhenCard iv={iv} pill={technical ? 'Ended early' : mark.label} />
        {done && (
          <Panel>
            <Text style={styles.cardTitle}>Your interview is done.</Text>
            <Text style={styles.prose}>When your film is published it becomes your video resume.</Text>
            {!!note && <Text style={styles.prose}>{note}</Text>}
          </Panel>
        )}
        {underReview && (
          <Panel>
            <Text style={styles.cardTitle}>Under review</Text>
            <Text style={styles.prose}>The session ended before it finished, so it did not become a video resume. Our team is reviewing what happened.</Text>
            <Text style={styles.prose}>If it was not on you, a free re-interview is added to your account and you will be told here and in your notifications.</Text>
          </Panel>
        )}
        {technical && (
          <Panel>
            <Text style={styles.cardTitle}>What happened</Text>
            <Text style={styles.prose}>Our video room or the network dropped your session. That is not on you.</Text>
            <Text style={styles.prose}>We have added a free re-interview to your account at no charge — book it whenever you are ready.</Text>
          </Panel>
        )}
      </ScrollView>
      <FooterBar>
        {scorecardReady && <Btn label="See my scorecard" onPress={onFeedback} />}
        {technical && <Btn label="Book your free re-interview" onPress={onBook} />}
        {!underReview && !technical && (
          <Btn variant={scorecardReady ? 'outline' : 'primary'} label="Book another interview" onPress={onBook} />
        )}
      </FooterBar>
    </>
  )
}

function Clock({ label, value, tint }: { label: string; value: string; tint?: string | null }) {
  return (
    <View style={styles.clockWell}>
      <Text style={styles.clockLabel}>{label}</Text>
      <Text style={[styles.clockValue, !!tint && { color: tint }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  loading: { padding: 20, gap: 14 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14, paddingBottom: 24 },
  grow: { flex: 1 },
  footRow: { flexDirection: 'row', gap: 8 },

  ink: { backgroundColor: color.ink, borderRadius: 18, padding: 18 },
  inkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inkPill: { backgroundColor: color.onInkGround, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  inkPillText: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textInverse },
  inkRight: { fontFamily: FF.bodyMedium, fontSize: 11, color: color.textOnInkMuted },
  inkTitle: { fontFamily: FF.bodyBold, fontSize: 22, letterSpacing: -0.66, color: color.textInverse, marginTop: 12 },
  inkSub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textOnInkBody, marginTop: 4 },
  clockWell: { marginTop: 16 },
  clockLabel: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textOnInkSubtle },
  clockValue: { fontFamily: FF.bodySemiBold, fontSize: 32, letterSpacing: -0.5, color: color.textInverse, marginTop: 2, fontVariant: ['tabular-nums'] },
  lateStack: { gap: space.md, marginTop: space.lg },

  eyebrow: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textMuted },
  dangerText: { color: color.danger },
  cardTitle: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  prose: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.textSecondary },
  fine: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.textMuted },
})
