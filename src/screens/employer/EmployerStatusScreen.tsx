import React, { useEffect } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useNavigationState, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, leadingNative, radius, space } from '../../theme'
import {
  Body, Button, Card, Display, ErrorState, Eyebrow, Meta, Skeleton, StatusPill, text,
} from '../../components/ui'
import { DocumentStatusRow, EmployerShell, Glyph, VerifiedEmployerBadge } from '../../components/employer'
import { useEmployer } from '../../lib/employer/useEmployer'
import { ApiClientError, ErrorCode } from '../../lib/api'
import type { DocKind, EmployerState, Requirement, RequirementKey } from '../../lib/api/employer'
import {
  DOC_KIND_LABEL, EMPLOYER_ROUTES, REQUIREMENT_TITLE, formatIst, formatIstShort, needsAction, requirementPill,
  requirementTitle, statusRowOrder, type EmployerTone,
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
 * EM-06 · Verification status, and EM-06 · Approved.
 *
 * STATUS IS PER DOCUMENT, never one chip for the account. Each requirement is
 * its own DocumentStatusRow — pill, the document, its Asia/Kolkata stamps in
 * mono, the reviewer's words — and the rows that need the employer come first,
 * each with the one action that answers it. The first of those is the screen's
 * one crimson; any other is outline. The rows that passed stay passed.
 *
 * APPROVAL IS A MOMENT ON THIS SCREEN. The shell keeps reading the state while
 * the employer watches; when it turns verified the page redraws in place — the
 * serif headline, the Verified Employer badge, and Open the candidate feed —
 * with no sign-out and no sign-in wall. The shell's success band is not drawn
 * here: the moment is the news, and the band's absence is the flip.
 *
 * The web screen is apostrophe-user app/employers/verification/status; the
 * helpers exported at the foot of this file are its `_components/parts`, shared
 * by EM-04, EM-05 and EM-06 here as there.
 */
export function EmployerStatusScreen({ onBack, onResubmit, onFeed }: EmployerStatusScreenProps) {
  const { state, error, refresh, justVerified } = useEmployer()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const back = useBack(onBack)

  // Said aloud when it lands while they watch: a redraw alone is silent to a screen reader.
  const company = state?.company.name
  useEffect(() => {
    if (justVerified && company) AccessibilityInfo.announceForAccessibility(`${company} is a Verified Employer.`)
  }, [justVerified, company])

  if (!state) {
    return (
      <EmployerShell back={back}>
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  if (state.verified) {
    return (
      <EmployerShell back={back}>
        <ApprovedMoment state={state} onFeed={onFeed} />
      </EmployerShell>
    )
  }

  const rows = statusRowOrder(state.requirements)
  const actions = requirementActions(rows)

  return (
    <EmployerShell back={back} contentGap="sm">
      <TitleBlock
        title="Verification status"
        sub="Each document is reviewed on its own, so one that fails does not undo the others."
      />
      {/* A request that names no document is the row that needs the employer, so it leads. */}
      {unnamedRequest(state) && (
        <UnnamedRequestRow state={state} onPress={() => navigation.navigate('EmployerDocuments')} />
      )}
      {rows.map((req) => {
        const action = actions.get(req.key)
        return (
          <DocumentStatusRow
            key={req.key}
            requirement={req}
            state={state}
            action={
              action && (
                <RowActionButton
                  action={action}
                  // Nothing sent yet is one submission: the whole of EM-05, not one slot.
                  onPress={() => (action.focus ? onResubmit(action.focus) : navigation.navigate('EmployerDocuments'))}
                />
              )
            }
            after={req.status === 'REJECTED' ? 'Only this document goes back for review.' : undefined}
          />
        )
      })}
    </EmployerShell>
  )
}

/**
 * EM-06 · Approved — the Verified Employer moment. Newsreader carries it: the
 * company's name and what just became true are content. The badge is success
 * on successSoft, a radius-4 tag with a shield, and cannot be read as the
 * crimson Verified Interview mark. The only crimson is the way into the feed.
 */
function ApprovedMoment({ state, onFeed }: { state: EmployerState; onFeed: () => void }) {
  const approvedAt = state.verification.approvedAt ?? state.verification.reviewedAt
  return (
    <>
      <View style={styles.moment} accessibilityLiveRegion="polite">
        <View style={styles.seal} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Glyph name="shieldCheck" size={space['2xl']} tint={color.success} />
        </View>
        {!!approvedAt && <Meta>{`Approved ${formatIst(approvedAt)}`}</Meta>}
        <Display level="lg">{`${state.company.name} is a Verified Employer.`}</Display>
        <VerifiedEmployerBadge />
        <Body tone="muted">
          The candidate feed is open now, here and on any device you are signed in on. You don’t need to sign in again.
        </Body>
      </View>

      <Button variant="primary" size="lg" full label="Open the candidate feed" onPress={onFeed} />

      <View style={styles.approvedList}>
        <Eyebrow>Every document approved</Eyebrow>
        <Card style={styles.listCard}>
          {state.requirements.map((req, i) => {
            const at = decidedAt(req, state)
            return (
              <FactRow
                key={req.key}
                mark="check"
                label={requirementLine(req, { short: true })}
                trailing={at ? <Meta>{formatIstShort(at)}</Meta> : undefined}
                last={i === state.requirements.length - 1}
              />
            )
          })}
        </Card>
      </View>
    </>
  )
}

/** When a requirement was decided: the document's review, the account's approval, or the email's confirmation. */
function decidedAt(req: Requirement, state: EmployerState): string | null {
  if (req.key === 'WORK_EMAIL') return req.confirmedAt ?? null
  return req.document?.reviewedAt ?? state.verification.approvedAt
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
  grow: { flex: 1 },
  titleBlock: { gap: space.sm },
  outlineAction: { alignSelf: 'flex-start' },

  moment: { alignItems: 'flex-start', gap: space.lg, paddingTop: space.sm },
  seal: {
    width: space['4xl'],
    height: space['4xl'],
    borderRadius: radius.pill,
    backgroundColor: color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvedList: { gap: space.sm },
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
