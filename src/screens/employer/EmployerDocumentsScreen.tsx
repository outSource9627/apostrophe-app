import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, DisabledAction, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import {
  DocumentSlot, EmployerShell,
  type DocumentSlotHandle, type SlotFile, type SlotStatus,
} from '../../components/employer'
import { EmBadge, EmCard, EmWell, type EmTone } from '../../components/employer/em'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { ApiClientError, ErrorCode } from '../../lib/api'
import {
  EMPLOYER_UPLOAD, attachEmployerDocuments, submitEmployerVerification,
  type EmployerState, type EmployerUploadError, type Requirement, type UploadFault,
} from '../../lib/api/employer'
import {
  EMPLOYER_ROUTES, needsAction, requirementFor, requirementKindLine, requirementReason,
  requirementTimes, requirementTitle,
} from '../../lib/employer/state'
import {
  EmployerLoadState, requirementNoun, unnamedRequest, useBack, type DocumentKey,
} from './EmployerStatusScreen'
import type { RootStackParamList } from '../../../App'

export interface EmployerDocumentsScreenProps {
  /** Scroll to, and for a resubmission open, this requirement's slot. */
  focus?: DocumentKey
  onBack: () => void
  /** EM-05b's "Go to home", once the documents are attached and the round started. */
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
  const config = useEmployerConfig()
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
  /** Sent: EM-05b replaces the form until the employer moves on. */
  const [sent, setSent] = useState(false)
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

  const hours = config.verificationTargetHours ?? state?.verification.slaHours
  const maxMb = config.documentMaxMb ?? EMPLOYER_UPLOAD.maxBytes / 1_048_576

  if (sent && state) {
    return <Submitted hours={hours} onHome={onSubmitted} />
  }

  if (!state) {
    return (
      <EmployerShell back={back} title="Verify your company">
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
      setSending(false)
      setSent(true)
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
          : 'Submit for verification'

  // The first submission says only the design's line; every errand adds what it changes.
  const sub =
    mode === 'resubmit'
      ? `${errand!.length > 1 ? 'Only these documents go' : 'Only this document goes'} back for review.${hours ? ` We aim to decide within ${hours} hours.` : ''}`
      : mode === 'add'
        ? 'It joins your submission. Nothing goes back to the start.'
        : mode === 'answer'
          ? 'Replace a document or send it back as it is. Nothing you sent was refused.'
          : null

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
      {!!refusal && (
        <View style={styles.refusal} accessibilityRole="alert">
          <Icon name="alert" size={space.lg - 1} tint={color.danger} weight={2} />
          <Text style={[text.uiSm, styles.danger, styles.grow]}>{refusal}</Text>
        </View>
      )}
      {action}
    </View>
  ) : state.verified ? (
    <Button
      variant="primary"
      size="lg"
      full
      label="Open the candidate feed"
      onPress={() => navigation.reset({ index: 0, routes: [{ name: 'EmployerFeed' }] })}
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
    <EmployerShell back={back} title="Verify your company" sub={mode === 'submit' ? 'STEP 3 OF 3' : undefined} footer={footer}>
      <Text style={[text.uiMd, styles.muted]}>{`PDF, JPG or PNG, up to ${maxMb} MB each. Seen only by the Apostrophe review team.`}</Text>
      {!!sub && <Text style={[text.uiMd, styles.muted]}>{sub}</Text>}

      {!!asked && <EmWell label="From the reviewer" tone="violet">{asked}</EmWell>}

      {shown.map((req, i) => {
        const why = requirementReason(req)
        const refused = reports[req.key as DocumentKey]?.status === 'refused'
        const badge = headBadge(req, isOpen(req))
        return (
          <EmCard key={req.key} tone={refused ? 'danger' : undefined}>
            <View style={styles.head}>
              <Text style={[text.uiBaseSemi, styles.grow]}>{`${i + 1} · ${cardTitle(req, state)}`}</Text>
              {!!badge && <EmBadge label={badge.label} tone={badge.tone} icon={badge.icon} small />}
            </View>
            {req.key === 'WORK_EMAIL' ? (
              <WorkEmail req={req} state={state} />
            ) : isOpen(req) ? (
              <>
                {!!why && <EmWell label={why.tone === 'danger' ? 'Reason' : 'From the reviewer'} tone={why.tone === 'danger' ? 'red' : 'violet'}>{why.text}</EmWell>}
                {slotFor(req)}
              </>
            ) : mode === 'answer' && isReplaceable(req) && replacing.includes(req.key) ? (
              <>
                {slotFor(req)}
                <Button
                  variant="ghost"
                  size="sm"
                  label="Keep the one you sent"
                  disabled={sending}
                  style={styles.keep}
                  onPress={() => {
                    forget(req.key)
                    setReplacing((prev) => prev.filter((k) => k !== req.key))
                  }}
                />
              </>
            ) : (
              <SentDocument
                req={req}
                state={state}
                action={
                  mode === 'answer' && isReplaceable(req) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      label="Replace"
                      accessibilityLabel={`Replace ${requirementNoun(req)}`}
                      disabled={sending}
                      style={styles.slim}
                      onPress={() => {
                        forget(req.key)
                        setReplacing((prev) => [...prev, req.key])
                      }}
                    />
                  ) : undefined
                }
              />
            )}
          </EmCard>
        )
      })}
    </EmployerShell>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

/** The card's heading, in the design's words: "1 · Company document", "2 · Photo ID of Anita Rao", "3 · Work email". */
function cardTitle(req: Requirement, state: EmployerState): string {
  if (req.key === 'COMPANY_PROOF') return 'Company document'
  if (req.key === 'PHOTO_ID') return `Photo ID of ${state.company.authorisedPerson.name}`
  if (req.key === 'WORK_EMAIL') return 'Work email'
  return requirementTitle(req)
}

/**
 * The badge on a card's heading. An open slot carries none unless it was
 * refused — the slot itself says what to do; the rest say where they stand.
 */
function headBadge(req: Requirement, open: boolean): { label: string; tone: EmTone; icon: IconName } | null {
  if (req.status === 'APPROVED') return { label: req.key === 'WORK_EMAIL' ? 'Verified' : 'Approved', tone: 'green', icon: 'check' }
  if (req.status === 'REJECTED') return { label: 'Not accepted', tone: 'red', icon: 'x' }
  if (req.status === 'MORE_INFO') return { label: 'Requested', tone: 'violet', icon: 'file' }
  if (!open && req.status === 'SUBMITTED') return { label: 'In review', tone: 'amber', icon: 'clock' }
  return null
}

/** 'copperleaf.test' from 'https://www.copperleaf.test/about'. */
function websiteHost(url: string | null): string | null {
  if (!url) return null
  const host = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]
  return host || null
}

/**
 * The third requirement, satisfied at sign-up: the address, and — only when a
 * person still has to compare it with the website — why it is not ticked yet.
 */
function WorkEmail({ req, state }: { req: Requirement; state: EmployerState }) {
  const site = websiteHost(state.company.website)
  const done = req.status === 'APPROVED'
  const note = done || req.matchesWebsite
    ? null
    : site
      ? `Does not match ${site}, your website, so a reviewer checks it.`
      : 'A reviewer checks it against your company.'
  return (
    <View style={styles.email}>
      <Text style={[text.uiSm, styles.muted]}>{req.email ?? state.contact.email}</Text>
      {!!note && <Text style={[text.uiXs, styles.subtle]}>{note}</Text>}
    </View>
  )
}

/** A document already sent (approved, or with a reviewer): the file tile, its kind and its latest stamp. */
function SentDocument({ req, state, action }: { req: Requirement; state: EmployerState; action?: React.ReactNode }) {
  const stamp = requirementTimes(req, state).slice(-1)[0]
  return (
    <View style={styles.sent}>
      <View style={styles.tile}><Icon name="file" size={space.lg + 2} tint={color.textMuted} /></View>
      <View style={styles.grow}>
        <Text style={text.uiBaseMedium} numberOfLines={1}>{requirementKindLine(req) ?? requirementTitle(req)}</Text>
        {!!stamp && <Text style={[text.metaMd, styles.stamp, req.status === 'APPROVED' ? styles.ok : styles.muted]}>{stamp.toUpperCase()}</Text>}
      </View>
      {action}
    </View>
  )
}

/** EM-05b · the moment after sending: a green tick, the promise with the server's own hours, and home. */
function Submitted({ hours, onHome }: { hours?: number; onHome: () => void }) {
  return (
    <EmployerShell
      bar={false}
      scroll={false}
      footer={<Button variant="secondary" size="lg" full label="Go to home" onPress={onHome} />}
    >
      <View style={styles.doneWrap}>
        <View style={styles.doneMark}><Icon name="check" size={space['2xl'] + 4} tint={color.success} weight={2.6} /></View>
        <Text style={[text.displayLead, styles.center]}>Documents submitted.</Text>
        <Text style={[text.uiBase, styles.muted, styles.center]}>
          {`${hours ? `A reviewer will look within ${hours} hours.` : 'A reviewer will look at them next.'} We’ll email you and notify you here.`}
        </Text>
      </View>
    </EmployerShell>
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
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  center: { textAlign: 'center' },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  ok: { color: color.success },
  footer: { flex: 1, gap: space.md },
  refusal: { flexDirection: 'row', gap: spaceHalf['1.5'], alignItems: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  keep: { alignSelf: 'flex-start' },
  slim: { paddingHorizontal: spaceHalf['3.5'] },
  email: { gap: space.xs },

  sent: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  tile: { width: height.avatar, height: height.control, borderRadius: radius.ctl, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stamp: { letterSpacing: trackingNative.eyebrow },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spaceHalf['3.5'], padding: space['2xl'] },
  doneMark: { width: height.fab + space.xs, height: height.fab + space.xs, borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
})
