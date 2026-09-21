import React, { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { space } from '../../theme'
import { Body, Button, Card, Display, Eyebrow, Meta, text } from '../../components/ui'
import { DocumentStatusRow, EmployerShell, FeedExplainer, VerifiedEmployerBadge } from '../../components/employer'
import { useEmployer } from '../../lib/employer/useEmployer'
import { EMPLOYER_UPLOAD, type EmployerState } from '../../lib/api/employer'
import {
  REQUIREMENT_SUMMARY, REQUIREMENT_TITLE, formatIst, needsAction, promptState, requirementKindLine,
  requirementTimes, requirementTitle, requirementsProgress,
} from '../../lib/employer/state'
import {
  EmployerLoadState, FactRow, KeptList, RequirementPill, RowActionButton, TitleBlock, UnnamedRequestRow,
  requirementActions, requirementNoun, reviewedAt, unnamedRequest, type DocumentKey,
} from './EmployerStatusScreen'

export interface EmployerHomeScreenProps {
  /** EM-05, optionally scrolled to one requirement. */
  onDocuments: (focus?: DocumentKey) => void
  /** EM-06. */
  onStatus: () => void
  /** EM-07, from the company monogram in the app bar. */
  onCompany: () => void
  /**
   * EM-08, the candidate feed, from a verified employer's home. The feed is
   * the next flow and has no screen yet; until App passes this, home is the
   * feed's stand-in and draws no button that would open itself.
   */
  onFeed?: () => void
}

/**
 * EM-04 · Home, pending verification — and EM-04 · Rejected beside it.
 *
 * While pending it is the shell's prompt (EmployerShell draws it; this screen
 * never does), a title that says where they stand, the one thing to do about
 * it, and a drawing of the feed they are working towards — FeedExplainer,
 * never the feed and never a blurred card. Which variant draws is the prompt's
 * own state, read from the same cache, so the band and the page under it
 * cannot disagree:
 *
 *   todo       Welcome, the checklist, and Submit documents (the one crimson).
 *   review     Welcome back, each document's own pill, and no primary: there
 *              is nothing to push while a reviewer decides.
 *   rejected   The decision: the failed document's row with the reviewer's
 *   moreInfo   sentences and Resubmit (or Add) one tap away, what passed kept
 *              as passed. A request is amber and adds; a refusal is danger and
 *              replaces. Neither is crimson.
 *
 * When a read sees approval land while home is open, home hands over to EM-06,
 * where the Verified Employer moment is drawn — no reload and no sign-in.
 *
 * Copy is the board's (docs/design/canvas/employer-onboarding/boards/home.mjs)
 * and the web's (apostrophe-user app/employers/home), filled from the state;
 * the 24 hours is `verification.slaHours`.
 */
export function EmployerHomeScreen({ onDocuments, onStatus, onCompany, onFeed }: EmployerHomeScreenProps) {
  const { state, error, refresh, justVerified } = useEmployer()

  const handedOver = useRef(false)
  useEffect(() => {
    if (!justVerified || handedOver.current) return
    handedOver.current = true
    onStatus()
  }, [justVerified, onStatus])

  if (!state) {
    return (
      <EmployerShell onAccount={onCompany}>
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  const first = state.company.authorisedPerson.name.trim().split(/\s+/)[0] ?? ''

  let body: React.ReactNode
  switch (promptState(state, { justVerified })) {
    case null:
    case 'verified':
      body = <Verified state={state} first={first} onFeed={onFeed} />
      break
    case 'todo':
      body = (
        <>
          <TitleBlock
            title={`Welcome, ${first}.`}
            sub="Your account is ready. Candidates open once a reviewer confirms your company is real, and it stays free after that."
          />
          <TodoChecklist state={state} onDocuments={onDocuments} />
          <FeedExplainer />
        </>
      )
      break
    case 'review':
      body = (
        <>
          <TitleBlock
            title={`Welcome back, ${first}.`}
            sub="Nothing to do while we review. This page updates the moment there is a decision, and we email you too."
          />
          <ReviewChecklist state={state} onStatus={onStatus} />
          <FeedExplainer />
        </>
      )
      break
    case 'rejected':
      body = (
        <>
          <Decision state={state} prompt="rejected" onDocuments={onDocuments} />
          <FeedExplainer />
        </>
      )
      break
    case 'moreInfo':
      body = (
        <>
          <Decision state={state} prompt="moreInfo" onDocuments={onDocuments} />
          <FeedExplainer />
        </>
      )
      break
  }

  return <EmployerShell onAccount={onCompany}>{body}</EmployerShell>
}

const COUNT_WORD = ['No', 'One', 'Two', 'Three', 'Four']
const countWord = (n: number) => COUNT_WORD[n] ?? String(n)

/** The card's heading: the job in the sans (it is interface), and where it stands in mono. */
function ChecklistHead({ status }: { status: string }) {
  return (
    <View style={styles.cardHead}>
      <Text style={[text.uiLgSemi, styles.grow]}>Verify your company</Text>
      <Meta>{status}</Meta>
    </View>
  )
}

/**
 * 01 · Documents not submitted. What verification takes, as three rows: a ring
 * for what is still to send, a tick for what is done. The limit is said under
 * the list, before the screen that opens the picker; the one crimson is Submit
 * documents.
 */
function TodoChecklist({ state, onDocuments }: { state: EmployerState; onDocuments: () => void }) {
  const { done, total } = requirementsProgress(state)
  const base = state.requirements.filter((r) => r.key !== 'REQUESTED')
  const missing = base.filter((r) => r.status === 'MISSING').length

  return (
    <Card style={styles.card}>
      <ChecklistHead status={`${done} of ${total} done`} />
      <View style={styles.list}>
        {base.map((req, i) => {
          const last = i === base.length - 1
          // Sent is not passed: the tick is for a decision, as it is on the in-review card.
          const mark = req.status === 'APPROVED' ? 'check' : 'ring'
          if (req.key === 'WORK_EMAIL') {
            return (
              <FactRow
                key={req.key}
                mark={mark}
                label={REQUIREMENT_TITLE.WORK_EMAIL}
                sub={REQUIREMENT_SUMMARY.WORK_EMAIL}
                // An address off the website's domain waits on a reviewer, and says so.
                trailing={req.status === 'APPROVED' ? undefined : <RequirementPill requirement={req} />}
                last={last}
              />
            )
          }
          const key = req.key as 'COMPANY_PROOF' | 'PHOTO_ID'
          return req.status === 'MISSING' ? (
            <FactRow key={key} mark="ring" label={REQUIREMENT_TITLE[key]} sub={REQUIREMENT_SUMMARY[key]} last={last} />
          ) : (
            <FactRow
              key={key}
              mark={mark}
              label={REQUIREMENT_TITLE[key]}
              sub={requirementKindLine(req)}
              trailing={<RequirementPill requirement={req} />}
              last={last}
            />
          )
        })}
      </View>
      {missing > 0 && (
        <Eyebrow tone="muted" style={styles.constraint}>
          {`${EMPLOYER_UPLOAD.constraint}${missing > 1 ? ' each' : ''}`}
        </Eyebrow>
      )}
      <Button variant="primary" size="lg" full label="Submit documents" onPress={() => onDocuments()} style={styles.primary} />
      {missing > 0 && (
        <Body size="xs" tone="muted" style={styles.helper}>
          {missing > 1 ? 'Have both files on your phone before you start.' : 'Have the file on your phone before you start.'}
        </Body>
      )}
    </Card>
  )
}

/**
 * 02 · Submitted, waiting. The same card with each row's own pill — there is
 * no one chip for the account — and when it went in. No primary: there is
 * nothing to push, so the way to the detail is outlined.
 */
function ReviewChecklist({ state, onStatus }: { state: EmployerState; onStatus: () => void }) {
  return (
    <Card style={styles.card}>
      <ChecklistHead status="In review" />
      <View style={styles.list}>
        {state.requirements.map((req, i) => (
          <FactRow
            key={req.key}
            mark={req.status === 'APPROVED' ? 'check' : 'ring'}
            label={req.key === 'WORK_EMAIL' ? 'Work email' : requirementTitle(req)}
            sub={
              req.key === 'WORK_EMAIL'
                ? // 'On your company domain' only when it is; otherwise the address a reviewer is checking.
                  req.status === 'APPROVED' || req.matchesWebsite
                  ? 'On your company domain'
                  : requirementKindLine(req)
                : requirementKindLine(req)
            }
            trailing={<RequirementPill requirement={req} />}
            last={i === state.requirements.length - 1}
          />
        ))}
      </View>
      {!!state.verification.submittedAt && (
        <Meta style={styles.submitted}>{`Submitted ${formatIst(state.verification.submittedAt)}`}</Meta>
      )}
      <View style={styles.statusAction}>
        <Button variant="outline" size="md" label="See verification status" onPress={onStatus} />
      </View>
    </Card>
  )
}

/**
 * EM-04 · Rejected, and more information requested beside it, drawn so the two
 * cannot be confused: a refusal names the document and the reviewer's reason
 * on a danger well with Resubmit; a request is a warning well with Add, and
 * nothing on the screen reads refused.
 */
function Decision({
  state, prompt, onDocuments,
}: {
  state: EmployerState
  prompt: 'rejected' | 'moreInfo'
  onDocuments: (focus?: DocumentKey) => void
}) {
  const acting = state.requirements.filter((r) => r.key !== 'WORK_EMAIL' && needsAction(r))
  const kept = state.requirements.filter((r) => !acting.includes(r))
  const refused = acting.filter((r) => r.status === 'REJECTED')
  const actions = requirementActions(acting)
  const at = reviewedAt(state)
  const over = at ? `Reviewed ${formatIst(at)}` : null

  const unnamed = prompt === 'moreInfo' && unnamedRequest(state)
  const everythingElsePassed = acting.length === refused.length && kept.every((r) => r.status === 'APPROVED')
  const title =
    prompt === 'moreInfo'
      ? unnamed
        ? 'One more thing, please.'
        : 'One more document, please.'
      : refused.length
        ? `${countWord(refused.length)} ${refused.length === 1 ? 'document' : 'documents'} to fix.`
        : 'Verification not accepted.'
  const sub =
    prompt === 'moreInfo'
      ? 'This is a request, not a refusal. Your account and what you sent stay as they are.'
      : refused.length
        ? `A reviewer could not accept ${refused.map((r) => `your ${requirementNoun(r)}`).join(' and ')}.${
            everythingElsePassed ? ' Everything else passed.' : ''
          }`
        : state.verification.reason

  return (
    <>
      <TitleBlock over={over} title={title} sub={sub} />
      {unnamed && <UnnamedRequestRow state={state} onPress={() => onDocuments()} />}
      {acting.map((req) => {
        const action = actions.get(req.key)
        const refusedRow = req.status === 'REJECTED'
        return (
          <DocumentStatusRow
            key={req.key}
            requirement={req}
            state={state}
            // Home keeps only the decision's stamp; EM-06 carries the full history.
            times={refusedRow ? requirementTimes(req, state).slice(-1) : []}
            action={
              action && (
                <RowActionButton action={action} onPress={() => onDocuments(action.focus ?? undefined)} />
              )
            }
            after={
              refusedRow
                ? `Only the ${requirementNoun(req)} goes back to a reviewer. We aim to decide within ${state.verification.slaHours} hours.`
                : req.status === 'MORE_INFO'
                  ? 'It joins your submission. Nothing goes back to the start.'
                  : undefined
            }
          />
        )
      })}
      {kept.length > 0 && <KeptList requirements={kept} />}
    </>
  )
}

/**
 * A verified employer who opened home rather than watching approval land (that
 * one is handed to EM-06). The badge, and what is true, in the serif; and, once
 * the feed exists, the one way into it.
 */
function Verified({ state, first, onFeed }: { state: EmployerState; first: string; onFeed?: () => void }) {
  const approvedAt = state.verification.approvedAt ?? state.verification.reviewedAt
  return (
    <>
      <TitleBlock title={`Welcome back, ${first}.`} />
      <Card style={styles.verifiedCard}>
        <VerifiedEmployerBadge />
        <Display level="md">{`${state.company.name} is a Verified Employer.`}</Display>
        {!!approvedAt && <Meta>{`Approved ${formatIst(approvedAt)}`}</Meta>}
        {!!onFeed && (
          <Button variant="primary" size="lg" full label="Open the candidate feed" onPress={onFeed} style={styles.feed} />
        )}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  card: { padding: space.lg },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  list: { marginTop: space.xs },
  constraint: { marginTop: space.sm },
  primary: { marginTop: space.lg },
  helper: { marginTop: space.sm },
  submitted: { marginTop: space.sm },
  statusAction: { marginTop: space.md, alignSelf: 'flex-start' },
  verifiedCard: { padding: space.xl, gap: space.md, alignItems: 'flex-start' },
  // 20 over the action, as the web card sets it: the card's 12 gap and 8 more.
  feed: { marginTop: space.sm },
})
