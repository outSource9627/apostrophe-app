import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space } from '../../theme'
import { Banner, Body, Button, Card, DisabledAction, Meta } from '../../components/ui'
import {
  DocumentSlot, EmployerShell, Glyph, RequirementHead, TextAction,
  type DocumentSlotHandle, type SlotFile, type SlotStatus,
} from '../../components/employer'
import { useEmployer } from '../../lib/employer/useEmployer'
import { ApiClientError, ErrorCode } from '../../lib/api'
import {
  attachEmployerDocuments, submitEmployerVerification,
  type EmployerState, type EmployerUploadError, type Requirement, type UploadFault,
} from '../../lib/api/employer'
import {
  EMPLOYER_ROUTES, needsAction, requirementFor, requirementKindLine, requirementPill, requirementReason,
  requirementTimes, requirementTitle, type EmployerTone,
} from '../../lib/employer/state'
import {
  EmployerLoadState, TitleBlock, requirementNoun, unnamedRequest, useBack, type DocumentKey,
} from './EmployerStatusScreen'
import type { RootStackParamList } from '../../../App'

export interface EmployerDocumentsScreenProps {
  /** Scroll to, and for a resubmission open, this requirement's slot. */
  focus?: DocumentKey
  onBack: () => void
  /** Documents attached and the round started: on to EM-06. */
  onSubmitted: () => void
}

/**
 * What the screen is for, which decides its slots, its sentence and its one action.
 *
 *   submit    the first submission: something has never been sent
 *   resubmit  a refused document, sent again
 *   add       a document a reviewer asked for
 *   answer    a request that named no document: replace a file, or send it back as it is
 *   ready     everything is on file but no round started (POST /employers/me/submit)
 *   none      nothing to send: waiting on a reviewer, or verified
 */
type Mode = 'submit' | 'resubmit' | 'add' | 'answer' | 'ready' | 'none'
type SlotReport = { status: SlotStatus; fault?: UploadFault }
type OpenRequirement = Requirement & { key: DocumentKey }

/** A requirement EM-05 draws as a slot: something to send, or send again. */
const isOpen = (req: Requirement): req is OpenRequirement => req.key !== 'WORK_EMAIL' && needsAction(req)

/** A document that is with a reviewer and can still be swapped, while answering a request that named none. */
const isReplaceable = (req: Requirement): req is OpenRequirement => req.key !== 'WORK_EMAIL' && req.status === 'SUBMITTED'

/**
 * Whether POST /employers/me/submit would start a round: nothing missing,
 * nothing refused, and either never submitted or sent back by a decision. The
 * server's own rule (roundToStart), read off the state it returned.
 */
function roundReady(s: EmployerState): boolean {
  const v = s.verification
  if (s.verified || s.missingRequirements.length || s.requirements.some((r) => r.status === 'REJECTED')) return false
  return v.status === 'REJECTED' || v.status === 'MORE_INFO' || (v.status === 'PENDING' && !v.submittedAt)
}

/** A slot showing this is not ready to send, even over a file it held before (a Replace in flight or refused). */
const WORKING: ReadonlySet<SlotStatus> = new Set(['uploading', 'refused', 'stopped'])

/**
 * EM-05 · Submit documents, and EM-05 · Upload error.
 *
 * ONE SLOT PER REQUIREMENT, NOT PER KIND. Company proof is one slot with the
 * GST / CIN / company PAN choice inside it; the photo ID is the second; the
 * work email is the third requirement, already satisfied at sign-up, drawn as
 * a card and never as a slot. What is acceptable and the PDF, JPG or PNG up to
 * 10 MB limit are on each slot before its picker opens (DocumentSlot), and the
 * slot owns the determinate upload, Cancel and every named fault.
 *
 * WHAT IS ALREADY DECIDED STAYS DECIDED. An approved document is a done card,
 * a submitted one a waiting card; only a requirement that needs the employer —
 * nothing sent, refused, or asked for — is a slot.
 *
 * THE SLOTS UPLOAD; THIS SCREEN ATTACHES. The one action is sticky, stays shut
 * and says what it is waiting on until every open slot holds an uploaded key;
 * then one POST attaches them all and the server starts the round by itself.
 *
 * ONE ERRAND, HOWEVER IT WAS REACHED. `focus` (a row's Resubmit or Add on
 * EM-04 and EM-06) narrows the screen to that one slot and the action to
 * sending just that document — a two-minute job, not the form again. When that
 * slot has one kind (the photo ID) its picker opens as the screen arrives; a
 * slot with a choice waits for the choice, so a CIN is never filed as a GST
 * certificate. The prompt's own press carries no focus, so when everything
 * open is a refusal or a request the screen narrows to those slots by itself.
 * A focus on something that no longer needs the employer falls back to the
 * whole screen.
 *
 * NO DEAD ENDS. A request that named no document keeps every sent file as a
 * waiting card with Replace, and the action sends the submission back as it
 * is; a complete set whose round never started gets Submit for review. Both go
 * through POST /employers/me/submit, the server's explicit resubmission.
 *
 * The web screen is apostrophe-user app/employers/verification; copy, states
 * and order are its own.
 */
export function EmployerDocumentsScreen(props: EmployerDocumentsScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  // The system picker cannot present over a push still animating in.
  const [arrived, setArrived] = useState(false)
  useEffect(
    () =>
      navigation.addListener('transitionEnd', (e) => {
        if (!e.data.closing) setArrived(true)
      }),
    [navigation],
  )

  // Keyed by the focus, so moving between one slot and the whole screen starts
  // from empty slots rather than carrying an upload across.
  return <Documents key={props.focus ?? 'all'} {...props} arrived={arrived} />
}

function Documents({ focus, onBack, onSubmitted, arrived }: EmployerDocumentsScreenProps & { arrived: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { state: live, error, refresh, apply, justVerified } = useEmployer()
  const [files, setFiles] = useState<Partial<Record<DocumentKey, SlotFile | null>>>({})
  const [reports, setReports] = useState<Partial<Record<DocumentKey, SlotReport>>>({})
  /** The waiting documents turned back into slots, while answering a request that named none. */
  const [replacing, setReplacing] = useState<DocumentKey[]>([])
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  /*
    The state as it was when Submit was pressed. The POST's answer goes to the
    cache straight away, so EM-06 opens on the new round; until the route
    changes, this screen keeps drawing what the employer just sent rather than
    flashing its slots into waiting cards.
  */
  const [frozen, setFrozen] = useState<EmployerState | null>(null)
  const state = frozen ?? live

  // Stable per slot, so an upload in flight never reports to a stale handler.
  const handlers = useMemo(() => {
    const make = (key: DocumentKey) => ({
      change: (file: SlotFile | null) => setFiles((prev) => ({ ...prev, [key]: file })),
      status: (status: SlotStatus, e: EmployerUploadError | null) =>
        setReports((prev) => ({ ...prev, [key]: { status, fault: e?.fault } })),
    })
    return { COMPANY_PROOF: make('COMPANY_PROOF'), PHOTO_ID: make('PHOTO_ID'), REQUESTED: make('REQUESTED') }
  }, [])

  // A verified employer has nothing to send. On the screen that watched the
  // approval land the prompt says so first; anywhere else, go to the moment.
  // Only while in front: leaving that screen clears `justVerified`, and a
  // screen already behind EM-06 must not push a second one. popTo returns to an
  // EM-06 this was opened from, or takes this screen's place.
  const isFocused = useIsFocused()
  const verified = Boolean(live?.verified)
  useEffect(() => {
    if (isFocused && verified && !justVerified) navigation.popTo(EMPLOYER_ROUTES.status)
  }, [isFocused, verified, justVerified, navigation])

  // Resubmit opens the photo ID picker directly, once, when the screen has arrived.
  const slot = useRef<DocumentSlotHandle>(null)
  const picked = useRef(false)
  const single = focus && live ? requirementFor(live, focus) : null
  const opensPicker = !!single && isOpen(single) && (single.key === 'PHOTO_ID' || single.kinds.length === 1)
  useEffect(() => {
    if (!opensPicker || !arrived || picked.current) return
    picked.current = true
    slot.current?.pick()
  }, [opensPicker, arrived])

  const back = useBack(onBack)

  if (!state) {
    return (
      <EmployerShell back={back}>
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  const openAll = state.requirements.filter(isOpen)
  const focused = focus ? openAll.find((r) => r.key === focus) : undefined
  // The prompt's own press carries no focus, so when everything open is a
  // refusal or a request — never a first submission — the screen narrows to
  // those slots by itself: the band and the row's button land on the same errand.
  const errand = focused ? [focused] : openAll.length && openAll.every((r) => r.status !== 'MISSING') ? openAll : null

  const mode: Mode = errand
    ? errand.every((r) => r.status === 'REJECTED')
      ? 'resubmit'
      : 'add'
    : openAll.length
      ? 'submit'
      : unnamedRequest(state)
        ? 'answer'
        : roundReady(state)
          ? 'ready'
          : 'none'

  const shown = errand ?? state.requirements
  /** Every slot on screen: the open ones, and in `answer` the waiting documents being replaced. */
  const slots: OpenRequirement[] =
    mode === 'answer'
      ? state.requirements.filter(isReplaceable).filter((r) => replacing.includes(r.key))
      : shown.filter(isOpen)
  const waiting = slots.filter((r) => !files[r.key] || WORKING.has(reports[r.key]?.status ?? 'empty'))
  // An answer, or a complete set whose round never started, may send nothing new.
  const ready = mode === 'answer' || mode === 'ready' ? waiting.length === 0 : slots.length > 0 && waiting.length === 0

  const submit = async () => {
    const documents = slots.flatMap((r) => {
      const file = files[r.key]
      return file ? [{ kind: file.kind, key: file.key }] : []
    })
    setFrozen(state)
    setSending(true)
    setRefusal(null)
    try {
      let next: EmployerState
      if (documents.length) {
        next = await attachEmployerDocuments(documents)
        // The attach starts the round by itself. /submit is the contract's
        // explicit resubmission, for a set the attach left without a round.
        if (roundReady(next)) next = await submitEmployerVerification().catch(() => next)
      } else {
        next = await submitEmployerVerification()
      }
      apply(next)
      onSubmitted()
    } catch (e) {
      if (e instanceof ApiClientError && e.code === ErrorCode.CONFLICT) {
        // 'This account is already verified.' The status screen says it better.
        await refresh()
        navigation.popTo(EMPLOYER_ROUTES.status)
        return
      }
      setFrozen(null)
      setSending(false)
      setRefusal(
        e instanceof ApiClientError
          ? e.message
          : 'Your documents were not sent. The connection dropped, so try again when you have signal.',
      )
    }
  }

  const errandNouns = errand ? andList(errand.map(requirementNoun)) : ''
  const label =
    mode === 'resubmit'
      ? `Resubmit ${errandNouns}`
      : mode === 'add'
        ? `${errand!.some((r) => r.status === 'REJECTED') ? 'Send' : 'Add'} ${errandNouns}`
        : mode === 'answer'
          ? 'Send back for review'
          : 'Submit for review'

  const emailReq = requirementFor(state, 'WORK_EMAIL')
  const sub =
    mode === 'resubmit'
      ? `${errand!.length > 1 ? 'Only these documents go' : 'Only this document goes'} back for review. We aim to decide within ${state.verification.slaHours} hours.`
      : mode === 'add'
        ? 'It joins your submission. Nothing goes back to the start.'
        : mode === 'answer'
          ? 'Replace a document or send it back as it is. Nothing you sent was refused.'
          : emailReq?.status === 'APPROVED'
            ? 'Three things verify a company. The third is already done.'
            : 'Three things verify a company. A reviewer checks the third.'

  const action =
    mode === 'none' ? null : ready ? (
      <Button variant="primary" size="lg" full busy={sending} label={label} onPress={() => { submit() }} />
    ) : (
      <DisabledAction
        tone="neutral"
        action={<Button variant="primary" size="lg" full disabled label={label} />}
        reason={disabledReason(mode, waiting, reports)}
      />
    )

  const footer = action ? (
    <View style={styles.footer}>
      {!!refusal && <Banner tone="danger">{refusal}</Banner>}
      {action}
    </View>
  ) : state.verified ? (
    <Button
      variant="primary"
      size="lg"
      full
      label="Open the candidate feed"
      // The feed (EM-08) is the next flow; until it exists its door is home, as App's onFeed.
      onPress={() => navigation.reset({ index: 0, routes: [{ name: EMPLOYER_ROUTES.home }] })}
    />
  ) : (
    <Button
      variant="outline"
      size="lg"
      full
      label="See verification status"
      onPress={() => navigation.popTo(EMPLOYER_ROUTES.status)}
    />
  )

  /** Clears what a slot held, so Replace starts from an empty slot and Keep leaves nothing behind. */
  const forget = (key: DocumentKey) => {
    setFiles((prev) => ({ ...prev, [key]: null }))
    setReports((prev) => ({ ...prev, [key]: undefined }))
  }

  const slotFor = (req: OpenRequirement) => (
    <DocumentSlot
      ref={req === focused ? slot : undefined}
      requirement={req.key}
      kinds={req.key === 'REQUESTED' ? req.kinds : undefined}
      value={files[req.key] ?? null}
      onChange={handlers[req.key].change}
      onStatusChange={handlers[req.key].status}
      disabled={sending}
    />
  )

  const asked = mode === 'answer' ? state.verification.reason : null

  return (
    <EmployerShell back={back} footer={footer}>
      <TitleBlock title="Submit documents" sub={sub} />

      {!!asked && <Banner tone="warning" title="What the reviewer asked">{asked}</Banner>}

      {shown.map((req, i) => {
        const why = requirementReason(req)
        return (
          <View key={req.key} style={styles.section}>
            <RequirementHead n={i + 1} title={requirementTitle(req)} pill={headPill(req)} />
            {req.key === 'WORK_EMAIL' ? (
              <WorkEmailCard req={req} state={state} />
            ) : isOpen(req) ? (
              <>
                {!!why && (
                  <Banner tone={why.tone} title={why.label}>
                    {why.text}
                  </Banner>
                )}
                {slotFor(req)}
              </>
            ) : mode === 'answer' && isReplaceable(req) && replacing.includes(req.key) ? (
              <>
                {slotFor(req)}
                <View style={styles.keep}>
                  <TextAction
                    label="Keep the one you sent"
                    tone="muted"
                    underline={false}
                    disabled={sending}
                    onPress={() => {
                      forget(req.key)
                      setReplacing((prev) => prev.filter((k) => k !== req.key))
                    }}
                  />
                </View>
              </>
            ) : (
              <DocumentDoneCard
                req={req}
                state={state}
                action={
                  mode === 'answer' && isReplaceable(req) ? (
                    <TextAction
                      label="Replace"
                      underline={false}
                      accessibilityLabel={`Replace ${requirementNoun(req)}`}
                      disabled={sending}
                      onPress={() => {
                        forget(req.key)
                        setReplacing((prev) => [...prev, req.key])
                      }}
                    />
                  ) : undefined
                }
              />
            )}
          </View>
        )
      })}
    </EmployerShell>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

/**
 * The heading pill, in the slot's reading: Required, Done, Submitted, Rejected.
 * A reviewer's request reads Required here — on the screen where it is being
 * answered it is something to send, and the well under the heading already
 * says who asked.
 */
function headPill(req: Requirement): { label: string; tone: EmployerTone } {
  return req.status === 'MORE_INFO' ? requirementPill({ status: 'MISSING' }, 'slot') : requirementPill(req, 'slot')
}

/** A disc and two lines: what is already done, or already with a reviewer, where a slot would otherwise be. */
function SettledCard({
  done, primary, secondary, action,
}: {
  done: boolean
  primary: string
  secondary: React.ReactNode
  /** Replace, while answering a request that named no document. */
  action?: React.ReactNode
}) {
  return (
    <Card style={styles.settled}>
      <View style={styles.settledLine}>
        <View
          style={[styles.disc, done ? styles.discDone : styles.discWaiting]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Glyph name={done ? 'shieldCheck' : 'clock'} size={space.lg} tint={done ? color.success : color.info} />
        </View>
        <View style={styles.grow}>
          <Body size="sm" weight="medium">{primary}</Body>
          {secondary}
        </View>
        {action}
      </View>
    </Card>
  )
}

/** 'copperleaf.test' from 'https://www.copperleaf.test/about'. */
function websiteHost(url: string | null): string | null {
  if (!url) return null
  const host = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]
  return host || null
}

/**
 * The third requirement, satisfied at sign-up. Done when the address is on the
 * website's domain; otherwise a person compares the two, and the card says so
 * rather than drawing a tick it has not earned.
 */
function WorkEmailCard({ req, state }: { req: Requirement; state: EmployerState }) {
  const site = websiteHost(state.company.website)
  const done = req.status === 'APPROVED'
  const sentence =
    req.matchesWebsite && site
      ? `Matches ${site}, your website. Confirmed when you signed up.`
      : done
        ? 'Confirmed when you signed up.'
        : site
          ? `Does not match ${site}, your website, so a reviewer checks it. Confirmed when you signed up.`
          : 'A reviewer checks it against your company. Confirmed when you signed up.'
  return (
    <SettledCard
      done={done}
      primary={req.email ?? state.contact.email}
      secondary={
        <Body size="xs" tone="muted">
          {sentence}
        </Body>
      }
    />
  )
}

/** A document that is approved, or submitted and waiting: the kind and its latest stamp, not a slot. */
function DocumentDoneCard({ req, state, action }: { req: Requirement; state: EmployerState; action?: React.ReactNode }) {
  const stamp = requirementTimes(req, state).slice(-1)[0]
  return (
    <SettledCard
      done={req.status === 'APPROVED'}
      primary={requirementKindLine(req) ?? requirementTitle(req)}
      secondary={stamp ? <Meta>{stamp}</Meta> : null}
      action={action}
    />
  )
}

// ── The disabled reason ──────────────────────────────────────────────────────

/** 'a and b', 'a, b and c'. */
const andList = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

/** How a slot is named inside the footer's sentence. */
function slotNoun(req: OpenRequirement, article: 'a' | 'the'): string {
  if (req.key === 'COMPANY_PROOF') return 'company proof'
  if (req.key === 'PHOTO_ID') return 'your photo ID'
  return `${article} ${requirementNoun(req)}`
}

/** What one unfinished slot is waiting on, as the tail of 'Submit opens when …'. */
function waitingOn(req: OpenRequirement, report: SlotReport | undefined): string {
  const noun = slotNoun(req, 'the')
  switch (report?.status) {
    case 'uploading':
    case 'stopped':
      return `${noun} finishes uploading`
    case 'refused':
      return report.fault === 'size'
        ? `${noun} is under 10 MB`
        : report.fault === 'type'
          ? `${noun} is a PDF, JPG or PNG`
          : `${noun} is uploaded`
    default:
      return `you add ${slotNoun(req, 'a')}`
  }
}

const VERB: Record<Exclude<Mode, 'none'>, string> = {
  submit: 'Submit',
  ready: 'Submit',
  resubmit: 'Resubmit',
  add: 'Add',
  answer: 'Send',
}

/**
 * Why the action is shut, naming what is outstanding (EM-05 · Upload error):
 * 'Add company proof and your photo ID to submit.' while nothing is chosen;
 * 'Submit opens when company proof finishes uploading and your photo ID is
 * under 10 MB.' once something is moving or was refused.
 */
function disabledReason(
  mode: Exclude<Mode, 'none'>,
  waiting: OpenRequirement[],
  reports: Partial<Record<DocumentKey, SlotReport>>,
) {
  const untouched = waiting.every((r) => !reports[r.key] || reports[r.key]!.status === 'empty')
  if (untouched && mode === 'answer') {
    return `Choose the new file for ${andList(waiting.map((r) => slotNoun(r, 'the')))}, or keep the one you sent.`
  }
  if (untouched) {
    const verb = mode === 'resubmit' ? 'resubmit' : mode === 'add' ? 'send it' : 'submit'
    return `Add ${andList(waiting.map((r) => slotNoun(r, 'a')))} to ${verb}.`
  }
  const sentence = `${VERB[mode]} opens when ${andList(waiting.map((r) => waitingOn(r, reports[r.key])))}.`
  return sentence[0].toUpperCase() + sentence.slice(1)
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  section: { gap: space.sm },
  footer: { gap: space.md },
  keep: { alignSelf: 'flex-start' },

  settled: { paddingVertical: space.md, paddingHorizontal: space.lg },
  settledLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  disc: {
    width: space['2xl'],
    height: space['2xl'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discDone: { backgroundColor: color.successSoft },
  discWaiting: { backgroundColor: color.infoSoft },
})
