import React, { useEffect } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useNavigationState, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, leadingNative, radius, space, spaceHalf, trackingNative } from '../../theme'
import {
  Body, Button, Card, Display, ErrorState, Eyebrow, Skeleton, StatusPill, text,
} from '../../components/ui'
import type { IconName } from '../../components/ui/Icon'
import { DocumentStatusRow, DropZone, EmployerShell, Glyph } from '../../components/employer'
import { EmBadge, EmCard, EmMono, EmSteps, EmWell, type EmTone } from '../../components/employer/em'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { ApiClientError, ErrorCode } from '../../lib/api'
import type { DocKind, EmployerState, Requirement, RequirementKey } from '../../lib/api/employer'
import {
  DOC_KIND_LABEL, EMPLOYER_ROUTES, REQUIREMENT_TITLE, formatIst, formatIstStep, needsAction, requirementKindLine, requirementPill,
  requirementTimes, requirementTitle, statusRowOrder, type EmployerTone,
} from '../../lib/employer/state'
import type { RootStackParamList } from '../../../App'

export type DocumentKey = Exclude<RequirementKey, 'WORK_EMAIL'>

export interface EmployerStatusScreenProps {
  onBack: () => void
  /** A row's Resubmit or Add: EM-05 at that requirement, picker open. */
  onResubmit: (focus: DocumentKey) => void
  /** "Open the candidate feed" on the approved moment. */
  onFeed: () => void
}

/**
 * EM-06 · Verification status: in review (06), more documents (06b), not
 * approved (06c) and approved (06d), plus the one the design leaves out —
 * nothing submitted yet.
 *
 * Each draws the design's badge, a 24 title and its body (the timeline, or the
 * reviewer's words), with the one action in the foot. Under it, every document
 * keeps its own row and badge: a refusal names the document, and what passed
 * stays passed (the web's per-document rule).
 *
 * APPROVAL LANDS HERE. The shell keeps reading while the employer watches; when
 * it turns verified the page redraws as 06d and says so aloud.
 */
export function EmployerStatusScreen({ onBack, onResubmit, onFeed }: EmployerStatusScreenProps) {
  const { state, error, refresh, justVerified } = useEmployer()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const back = useBack(onBack)
  const targetHours = useEmployerConfig().verificationTargetHours

  // Said aloud when it lands while they watch: a redraw alone is silent to a screen reader.
  const company = state?.company.name
  useEffect(() => {
    if (justVerified && company) AccessibilityInfo.announceForAccessibility(`${company} is a Verified Employer.`)
  }, [justVerified, company])

  if (!state) {
    return (
      <EmployerShell back={back} title="Verification status">
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  const v = state.verification
  // The admin's target when the config carries it, else the state's own (the web's rule).
  const hours = targetHours ?? v.slaHours
  const target = v.submittedAt && targetHours ? new Date(Date.parse(v.submittedAt) + targetHours * 3_600_000).toISOString() : v.decisionTargetAt
  if (state.verified) {
    const approvedAt = v.approvedAt ?? v.reviewedAt
    return (
      <EmployerShell
        back={back}
        title="Verification status"
        footer={<Button variant="primary" size="lg" full label="Open the candidate feed" onPress={onFeed} />}
      >
        <View accessibilityLiveRegion="polite" style={styles.lead}>
          <EmBadge label="Verified employer" tone="green" icon="shield" />
          <Text style={text.displayHeading}>{`${state.company.name} is verified.`}</Text>
          <Text style={[text.uiMd, styles.muted]}>
            {`${approvedAt ? `Approved ${formatIstDate(approvedAt)}. ` : ''}Candidates see the badge on every Interest and in chat.`}
          </Text>
        </View>
        <DocumentList state={state} />
      </EmployerShell>
    )
  }

  const rows = statusRowOrder(state.requirements)
  const actions = requirementActions(rows)
  const first = [...actions.values()][0]
  const openDocuments = (focus: DocumentKey | null) => (focus ? onResubmit(focus) : navigation.navigate('EmployerDocuments'))
  const unnamed = unnamedRequest(state)
  const nothingSent = !v.submittedAt && rows.some((r) => r.status === 'MISSING')
  const refused = v.status === 'REJECTED' || rows.some((r) => r.status === 'REJECTED')
  const asked = !refused && (v.status === 'MORE_INFO' || rows.some((r) => r.status === 'MORE_INFO'))
  const acting = rows.find((r) => r.key !== 'WORK_EMAIL' && needsAction(r) && r.reason)
  const words = v.reason ?? acting?.reason ?? null

  let body: React.ReactNode
  let foot: React.ReactNode = null
  if (nothingSent) {
    body = (
      <>
        <Head badge={{ label: 'Pending verification', tone: 'amber', icon: 'clock' }} title="Submit your documents." />
        <EmCard style={styles.steps}>
          <EmSteps
            steps={[
              { title: 'Email and mobile verified', state: 'done' },
              { title: 'Documents to submit', sub: 'Company document and a photo ID', state: 'now' },
              { title: 'Reviewer decision', sub: hours ? `Usually within ${hours} hours` : undefined, state: 'todo' },
            ]}
          />
        </EmCard>
      </>
    )
    foot = <Button variant="primary" size="lg" full label="Submit documents" onPress={() => navigation.navigate('EmployerDocuments')} />
  } else if (refused) {
    body = (
      <>
        <Head badge={{ label: 'Not approved', tone: 'red', icon: 'x' }} title="We couldn’t verify the company." />
        {!!words && <EmWell label="Reason" tone="red">{words}</EmWell>}
        <Text style={[text.uiMd, styles.muted]}>Fix it and resubmit. There’s no limit.</Text>
      </>
    )
    foot = first && <Button variant="primary" size="lg" full label="Update and resubmit" onPress={() => openDocuments(first.focus)} />
  } else if (asked || unnamed) {
    const errand = first ?? (unnamed ? { focus: null } : undefined)
    body = (
      <>
        <Head badge={{ label: 'More documents', tone: 'violet', icon: 'file' }} title="One more document, please." />
        {!!words && <EmWell label="From the reviewer" tone="violet">{words}</EmWell>}
        {!!errand && <DropZone title="Upload document" compact onPress={() => openDocuments(errand.focus)} />}
      </>
    )
    foot = errand && <Button variant="primary" size="lg" full label="Resubmit" onPress={() => openDocuments(errand.focus)} />
  } else {
    body = (
      <>
        <Head badge={{ label: 'In review', tone: 'amber', icon: 'clock' }} title="A reviewer is checking your documents." />
        <EmCard style={styles.steps}>
          <EmSteps
            steps={[
              { title: 'Submitted', sub: v.submittedAt ? formatIstStep(v.submittedAt) : undefined, state: 'done' },
              { title: 'In review', sub: target ? `Target by ${formatIstStep(target)}` : undefined, state: 'now' },
              { title: 'Decision', sub: 'Email and in-app', state: 'todo' },
            ]}
          />
        </EmCard>
      </>
    )
  }

  return (
    <EmployerShell back={back} title="Verification status" footer={foot || undefined}>
      {body}
      <DocumentList state={state} actions={actions} primary={first} onAction={openDocuments} />
    </EmployerShell>
  )
}

/** The badge and the 24 title that open every status. */
function Head({ badge, title }: { badge: { label: string; tone: EmTone; icon: IconName }; title: string }) {
  return (
    <View style={styles.lead}>
      <EmBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
      <Text style={text.displayHeading} accessibilityRole="header">{title}</Text>
    </View>
  )
}

/** '16 Sep 2026' — the approval date in a sentence. */
const formatIstDate = (at: string) => formatIst(at).split(' · ')[0]

const REQ_BADGE: Record<Requirement['status'], { label: string; tone: EmTone }> = {
  MISSING: { label: 'To submit', tone: 'gray' },
  SUBMITTED: { label: 'In review', tone: 'amber' },
  MORE_INFO: { label: 'Requested', tone: 'violet' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Not accepted', tone: 'red' },
}

/**
 * Every requirement on its own row: the name, the kind sent and its last stamp,
 * its badge, and the reviewer's words on a refused or requested one. A second
 * action (a second refusal) sits on its row; the first is the foot's.
 */
function DocumentList({
  state, actions, primary, onAction,
}: {
  state: EmployerState
  actions?: Map<RequirementKey, RowAction>
  primary?: RowAction
  onAction?: (focus: DocumentKey | null) => void
}) {
  const rows = statusRowOrder(state.requirements)
  return (
    <EmCard style={styles.list}>
      <EmMono>DOCUMENTS</EmMono>
      {rows.map((req, i) => {
        const badge = REQ_BADGE[req.status]
        const kind = req.key === 'WORK_EMAIL' ? req.email ?? state.contact.email : requirementKindLine(req)
        const stamp = requirementTimes(req, state).slice(-1)[0]
        const action = actions?.get(req.key)
        const showReason = !!req.reason && (req.status === 'REJECTED' || req.status === 'MORE_INFO') && req.reason !== state.verification.reason
        return (
          <View key={req.key} style={[styles.row, i > 0 && styles.rowRule]}>
            <View style={styles.rowHead}>
              <View style={styles.grow}>
                <Text style={text.uiBaseSemi}>{req.key === 'WORK_EMAIL' ? 'Work email' : requirementLine(req, { short: true })}</Text>
                {!!kind && kind !== requirementLine(req, { short: true }) && <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{kind}</Text>}
                {!!stamp && <Text style={[text.metaMd, styles.stamp]}>{stamp.toUpperCase()}</Text>}
              </View>
              <EmBadge label={req.key === 'WORK_EMAIL' && req.status === 'APPROVED' ? 'Verified' : badge.label} tone={badge.tone} small />
            </View>
            {showReason && <Text style={[text.uiSm, req.status === 'REJECTED' ? styles.danger : styles.secondary]}>{req.reason}</Text>}
            {!!action && action !== primary && !!onAction && (
              <Button variant="outline" size="sm" label={action.label} style={styles.rowAction} onPress={() => onAction(action.focus)} />
            )}
          </View>
        )
      })}
    </EmCard>
  )
}

// ── Shared by EM-04, EM-05 and EM-06 (the web's verification/_components/parts) ──

const KIND_NOUN: Record<DocKind, string> = {
  GST: 'GST certificate',
  CIN: 'CIN',
  PAN: 'company PAN',
  PHOTO_ID: 'photo ID',
}

/**
 * The document an action sends, as the words after 'Resubmit' or 'Add':
 * 'photo ID', 'company proof', 'GST certificate or CIN'. A refused requested
 * document is named by what was actually sent.
 */
export function requirementNoun(req: Requirement): string {
  switch (req.key) {
    case 'COMPANY_PROOF':
      return 'company proof'
    case 'PHOTO_ID':
      return 'photo ID'
    case 'WORK_EMAIL':
      return 'work email'
    case 'REQUESTED':
      if (req.status === 'REJECTED' && req.document) return KIND_NOUN[req.document.kind]
      return req.kinds.map((k) => KIND_NOUN[k]).join(' or ') || 'document'
  }
}

export interface RowAction {
  label: string
  /** The one slot EM-05 narrows to, or null for the whole screen. */
  focus: DocumentKey | null
  /** The screen's one crimson. Every other row's action is outline. */
  primary: boolean
}

/**
 * The action on each row that needs the employer, in the order given.
 *
 *   A refusal is 'Resubmit <document>' and opens that slot alone on EM-05.
 *   A request is 'Add <document>', the same way, and never says Resubmit:
 *     nothing was refused.
 *   A requirement with nothing sent yet goes to the whole of EM-05, once. Two
 *     missing documents are one submission, not two buttons.
 *
 * Only the first action is primary: two refusals on one screen are two
 * Resubmits under one crimson, never two crimsons.
 */
export function requirementActions(rows: Requirement[]): Map<RequirementKey, RowAction> {
  const out = new Map<RequirementKey, RowAction>()
  let missingDone = false
  for (const req of rows) {
    if (req.key === 'WORK_EMAIL' || !needsAction(req)) continue
    const primary = out.size === 0
    if (req.status === 'MISSING') {
      if (missingDone) continue
      missingDone = true
      out.set(req.key, { label: 'Submit documents', focus: null, primary })
      continue
    }
    const verb = req.status === 'REJECTED' ? 'Resubmit' : 'Add'
    out.set(req.key, { label: `${verb} ${requirementNoun(req)}`, focus: req.key, primary })
  }
  return out
}

/** A row's action as the boards draw it: lg and full width when primary, md outline otherwise. */
export function RowActionButton({ action, onPress }: { action: RowAction; onPress: () => void }) {
  return action.primary ? (
    <Button variant="primary" size="lg" full label={action.label} onPress={onPress} />
  ) : (
    <View style={styles.outlineAction}>
      <Button variant="outline" size="md" label={action.label} onPress={onPress} />
    </View>
  )
}

/** The screen's title in the serif, the mono line over it (a time) and the sentence under it. */
export function TitleBlock({ over, title, sub }: { over?: string | null; title: string; sub?: string | null }) {
  return (
    <View style={styles.titleBlock}>
      {!!over && <Eyebrow>{over}</Eyebrow>}
      <Display level="lg">{title}</Display>
      {!!sub && <Body tone="muted">{sub}</Body>}
    </View>
  )
}

/** 'Company proof · GST certificate' — one line per requirement in the kept and approved lists. */
export function requirementLine(req: Requirement, { short = false } = {}): string {
  switch (req.key) {
    case 'WORK_EMAIL':
      return short ? 'Work email' : REQUIREMENT_TITLE.WORK_EMAIL
    case 'PHOTO_ID':
      return REQUIREMENT_TITLE.PHOTO_ID
    case 'COMPANY_PROOF':
      return req.document ? `Company proof · ${DOC_KIND_LABEL[req.document.kind]}` : REQUIREMENT_TITLE.COMPANY_PROOF
    case 'REQUESTED':
      return req.document ? DOC_KIND_LABEL[req.document.kind] : requirementTitle(req)
  }
}

/** The latest review time a decision carries: the round's, else the newest document decision. */
export function reviewedAt(state: EmployerState): string | null {
  if (state.verification.reviewedAt) return state.verification.reviewedAt
  const times = state.documents.map((d) => d.reviewedAt).filter((t): t is string => Boolean(t))
  return times.sort()[times.length - 1] ?? null
}

/**
 * A request for more that names no document. The reviewer may do that (the
 * kinds are optional), and then there is no REQUESTED row to carry the
 * question — so without this every row reads passed or waiting, and the
 * employer has nothing to press. The answer is to replace a document, or send
 * the submission back as it is (POST /employers/me/submit), on EM-05.
 */
export const unnamedRequest = (state: Pick<EmployerState, 'verification' | 'requirements'>) =>
  state.verification.status === 'MORE_INFO' && !state.requirements.some((r) => r.key === 'REQUESTED')

/**
 * The row an unnamed request is drawn as, on home and on EM-06: the same
 * anatomy as a requested document (warning pill, the reviewer's words in the
 * warning well, one action), pointed at EM-05 where it is answered.
 */
export function UnnamedRequestRow({ state, onPress }: { state: EmployerState; onPress: () => void }) {
  const at = reviewedAt(state)
  // A request with no kinds, read by the same functions as a named one: the
  // warning pill, 'Asked for by the reviewer', and the reviewer's words.
  const request: Requirement = {
    key: 'REQUESTED',
    kinds: [],
    status: 'MORE_INFO',
    document: null,
    reason: state.verification.reason,
  }
  return (
    <DocumentStatusRow
      requirement={request}
      state={state}
      title="Your submission"
      times={at ? [`Requested ${formatIst(at)}`] : []}
      action={<Button variant="primary" size="lg" full label="Update your documents" onPress={onPress} />}
      after="Replace a document or send it back as it is. Nothing you sent was refused."
    />
  )
}

/**
 * One line of a FactList: a tick (success) or a ring, the sentence — at 15
 * medium with a gloss under it, or 13 alone — and a trailing pill or stamp.
 */
export function FactRow({
  mark, label, sub, trailing, last,
}: {
  mark: 'check' | 'ring'
  label: string
  sub?: string | null
  trailing?: React.ReactNode
  last: boolean
}) {
  return (
    <View style={[styles.fact, !last && styles.factRule]}>
      <View
        style={[styles.mark, sub ? styles.markTall : null]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {mark === 'check' ? <Glyph name="check" tint={color.success} /> : <View style={styles.ring} />}
      </View>
      <View style={styles.grow}>
        <Text style={sub ? [text.uiBase, styles.factLead] : text.uiSm}>{label}</Text>
        {!!sub && (
          <Body size="sm" tone="muted">
            {sub}
          </Body>
        )}
      </View>
      {trailing}
    </View>
  )
}

/** A requirement's own pill, as a FactRow's trailing. */
export function RequirementPill({ requirement }: { requirement: Requirement }) {
  const pill: { label: string; tone: EmployerTone } = requirementPill(requirement)
  return <StatusPill tone={pill.tone} label={pill.label} />
}

/**
 * What passed, or is still with a reviewer, under a decision on home (EM-04 ·
 * Rejected): a tick for approved, a ring for anything not yet decided, and the
 * row's own pill. What is kept is shown kept, so a refusal never reads as the
 * whole account going back to the start.
 */
export function KeptList({ requirements }: { requirements: Requirement[] }) {
  return (
    <Card style={styles.listCard}>
      {requirements.map((req, i) => (
        <FactRow
          key={req.key}
          mark={req.status === 'APPROVED' ? 'check' : 'ring'}
          label={requirementLine(req)}
          trailing={<RequirementPill requirement={req} />}
          last={i === requirements.length - 1}
        />
      ))}
    </Card>
  )
}

/**
 * Before the first read: the rows arriving, not a spinner. After a failed
 * first read with nothing to keep on screen: the network, or a suspension
 * whose message the server wrote. (A student is sent home by useEmployer.)
 *
 * A session that could not be refreshed is not a failure to retry: the web
 * client sends that employer to sign in, and here the one way on is Sign in,
 * opened over the app's landing so its back has somewhere to go.
 */
export function EmployerLoadState({ error, onRetry }: { error: Error | null; onRetry: () => unknown }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  if (!error) return <Skeleton lines={3} />
  const signedOut = error instanceof ApiClientError && error.code === ErrorCode.UNAUTHENTICATED
  return (
    <ErrorState
      title="We could not load your company."
      body={error.message}
      action={
        <Button
          variant="outline"
          size="sm"
          label={signedOut ? 'Sign in' : 'Try again'}
          // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
          hitSlop={(height.tap - height['control-xs']) / 2}
          onPress={() => {
            if (!signedOut) onRetry()
            else navigation.reset({ index: 1, routes: [{ name: EMPLOYER_ROUTES.landing }, { name: EMPLOYER_ROUTES.signin }] })
          }}
        />
      }
    />
  )
}

/** Each employer screen's title, as a back eyebrow names the screen it returns to. */
const BACK_LABEL: Partial<Record<string, string>> = {
  [EMPLOYER_ROUTES.home]: 'Home',
  [EMPLOYER_ROUTES.documents]: 'Submit documents',
  [EMPLOYER_ROUTES.status]: 'Verification status',
  [EMPLOYER_ROUTES.company]: 'Company profile',
}

/**
 * The app bar's back, named for where it really goes. The boards draw 'Home'
 * because each screen is drawn opened from home — and from home it still reads
 * Home. But a Resubmit on EM-06 opens EM-05 over EM-06, and a back that says
 * Home and lands on the status screen is a label (and a screen reader) lying.
 */
export function useBack(onPress: () => void): { label: string; onPress: () => void } {
  const route = useRoute()
  const label = useNavigationState((s) => {
    const i = s.routes.findIndex((r) => r.key === route.key)
    return (i > 0 && BACK_LABEL[s.routes[i - 1].name]) || 'Home'
  })
  return { label, onPress }
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  titleBlock: { gap: space.sm },
  outlineAction: { alignSelf: 'flex-start' },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },

  lead: { gap: space.md },
  steps: { padding: spaceHalf['4.5'] },
  list: { gap: 0 },
  row: { paddingVertical: space.md, gap: space.sm },
  rowRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  rowAction: { alignSelf: 'flex-start', paddingHorizontal: spaceHalf['3.5'] },
  stamp: { color: color.textSubtle, letterSpacing: trackingNative.eyebrow, marginTop: space['2xs'] },
  listCard: { paddingHorizontal: space.lg, paddingVertical: space.xs },

  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  factRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  factLead: { fontFamily: fontFamilyNative.bodyMedium },
  // The mark sits on the first line of its sentence.
  mark: { width: space.lg, height: leadingNative['ui-sm'], alignItems: 'center', justifyContent: 'center' },
  markTall: { height: leadingNative['ui-base'] },
  ring: {
    width: space.md + space['2xs'],
    height: space.md + space['2xs'],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
  },
})
