import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { StyleSheet, Text, View, type TextInput } from 'react-native'
import { borderWidth, color, fontFamilyNative, fontSize, leadingNative, radius, space, spaceHalf } from '../../theme'
import { Banner } from '../../components/ui/Banner'
import { Icon } from '../../components/ui/Icon'
import {
  AButton, BrandScreen, Link, Meta, MetaRow, OtpBoxes, Pill, ResendAction, SheetSub, SheetTitle, Tip,
} from '../../components/auth/kit'
import { CONTRACT_CODE_LENGTH, numberWord, useAuthConfig } from '../../components/auth/config'
import { ApiClientError, ErrorCode } from '../../lib/api'
import {
  attemptsLeft, registerEmployer, sendRegisterCodes, verifyRegisterCode,
  type CodeChannel, type EmployerRegistrationDraft, type RegisterOtpResult,
} from '../../lib/api/employer'
import { formatIstTarget } from '../../lib/employer/state'
import {
  FIELD_ORDER, applySendLimit, channelProgress, conflictField, displayMobile, forgetRegistration, formErrorsFrom,
  markCodeSent, messageOf, proofValid, returnToForm, updateChannel, withoutSignInTail, type FieldKey,
} from './EmployerRegisterScreen'

export interface EmployerVerifyScreenProps {
  /** The EM-02 form, held in memory only. Never write it anywhere: it carries the password. */
  registration: EmployerRegistrationDraft
  /** The first send's answer — each row's own resendAfterSeconds. */
  sent?: RegisterOtpResult
  /** Epoch ms of that send, so the countdowns start from when it happened. */
  sentAt?: number
  /** Back to EM-02 with the form as it was, to change the email or the mobile. */
  onEdit: () => void
  /** The account exists and the tokens are stored. */
  onRegistered: () => void
  onSignIn: () => void
}

const CHANNELS: readonly CodeChannel[] = ['EMAIL', 'MOBILE']

/** What one row is doing that the channel's progress does not hold: the digits, and what the last try said. */
interface RowState {
  code: string
  /** A wrong code. Turns the cells danger and replaces the helper. */
  error: string | null
  /** A routine sentence in place of the helper — expired, or a send that did not go. Cells stay calm. */
  note: string | null
  verifying: boolean
  resending: boolean
  /** The code that confirmed this row — drawn green in the confirmed card, gone with any reset. */
  confirmedCode?: string
}

const FRESH: RowState = { code: '', error: null, note: null, verifying: false, resending: false, confirmedCode: undefined }

const EXPIRED = 'That code has expired. Send a new one.'

const NO_MATCH = 'That code doesn’t match or has expired.'

const wrongCode = (left: number) =>
  left === 0
    ? 'That code doesn’t match, and it can’t be tried again. Send a new one.'
    : `That code doesn’t match. ${left} ${left === 1 ? 'try' : 'tries'} left.`

type TextInputRef = React.ComponentRef<typeof TextInput>

/**
 * EM-03 · Confirm your email and mobile.
 *
 * Drawn as direction C (docs/registration-mockups.html?dir=C&flow=employer):
 * the brand band, then two code cards in the sheet.
 *
 * TWO INDEPENDENT VERIFICATIONS, NEVER A STEPPER. Each card verifies on its
 * last digit — typed, pasted or filled by the platform — with POST
 * /employers/register/verify, keeps the proof it earns in the registration
 * progress, and resends only its own channel on its own countdown. A wrong
 * code, an expired code or an hourly limit on one row leaves the other exactly
 * as it was.
 *
 * There is no Continue to press. When both rows hold a live proof the account
 * is created with those proofs, registerEmployer stores the tokens, and the
 * stack is reset to home — which also drops the route params holding the
 * password. The footer appears only then, as the busy "Creating your
 * account…" (or "Try again" if that failed).
 *
 * A refusal about the FORM — an address that already has an account, an
 * industry no longer on the list — goes back to EM-02 and lands on that field.
 *
 * The same states, copy and order as the web's /employers/verify.
 */
export function EmployerVerifyScreen({
  registration, sent, sentAt, onEdit, onRegistered,
}: EmployerVerifyScreenProps) {
  const now = useClock()
  const config = useAuthConfig()
  const codeLength = config.data?.auth?.otpLength ?? CONTRACT_CODE_LENGTH
  const lengthKnown = !!config.data?.auth?.otpLength
  const documentCount = config.data?.employer?.documentRequirements?.length
  // The channel progress is module memory shared with EM-02; this re-renders after changing it.
  const [, touched] = useReducer((n: number) => n + 1, 0)

  const valueOf = (channel: CodeChannel) => (channel === 'EMAIL' ? registration.email : registration.mobile)
  const progressOf = (channel: CodeChannel) => channelProgress(channel, valueOf(channel))

  // Seeds each row's countdown from the send EM-02 made, when nothing is recorded for this address yet,
  // and picks the row that opens with the caret: the first one still open.
  const [firstOpen] = useState<CodeChannel | null>(() => {
    for (const channel of CHANNELS) {
      const s = channel === 'EMAIL' ? sent?.email : sent?.mobile
      if (s && sentAt && progressOf(channel).resendAt === null) {
        updateChannel(channel, valueOf(channel), { resendAt: sentAt + s.resendAfterSeconds * 1000 })
      }
    }
    return CHANNELS.find((channel) => !progressOf(channel).proof) ?? null
  })

  const [rows, setRows] = useState<Record<CodeChannel, RowState>>({ EMAIL: FRESH, MOBILE: FRESH })
  const [created, setCreated] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const creating = useRef(false)
  const inputs = useRef<Record<CodeChannel, TextInputRef | null>>({ EMAIL: null, MOBILE: null })

  const patchRow = useCallback(
    (channel: CodeChannel, patch: Partial<RowState>) =>
      setRows((r) => ({ ...r, [channel]: { ...r[channel], ...patch } })),
    [],
  )

  /** Into the row's one real input, so typing and paste land there. After the render that opened it. */
  const focusRow = useCallback(
    (channel: CodeChannel) => requestAnimationFrame(() => inputs.current[channel]?.focus()),
    [],
  )

  /** A proof with under a minute left is as good as none: register would refuse it. */
  const confirmed = (channel: CodeChannel) => {
    const p = progressOf(channel)
    return Boolean(p.proof) && proofValid(p, now)
  }
  const both = created || (confirmed('EMAIL') && confirmed('MOBILE'))

  /** A refusal about one field of the form: EM-02 opens on that field with the server's sentence under it. */
  const backToForm = (field: FieldKey, message: string, signIn = false) => {
    returnToForm({ errors: { [field]: message }, signIn: signIn ? field : null, focus: field })
    onEdit()
  }

  // Both confirmed: create the account. No button — the screen does it.
  useEffect(() => {
    if (!both || created || createError || creating.current) return
    const email = channelProgress('EMAIL', registration.email)
    const mobile = channelProgress('MOBILE', registration.mobile)
    if (!email.proof || !mobile.proof) return
    creating.current = true

    const create = async () => {
      try {
        await registerEmployer({ ...registration, emailProof: email.proof!, mobileProof: mobile.proof! })
        setCreated(true)
        forgetRegistration()
        onRegistered()
      } catch (e) {
        if (!(e instanceof ApiClientError)) {
          creating.current = false
          setCreateError(messageOf(e))
          return
        }
        const fields = e.fields ?? {}
        // A proof that ran out, or was for another address: that row opens again.
        const stale = CHANNELS.filter((channel) => fields[channel === 'EMAIL' ? 'emailProof' : 'mobileProof'])
        if (stale.length) {
          creating.current = false
          for (const channel of stale) {
            updateChannel(channel, channel === 'EMAIL' ? registration.email : registration.mobile, {
              proof: null,
              expiresAt: null,
            })
            patchRow(channel, { ...FRESH, note: EXPIRED })
          }
          touched()
          focusRow(stale[0])
          return
        }
        // Handing back to EM-02 leaves `creating` set. Both rows are still confirmed while this screen
        // animates out, and the navigator re-renders it with new callbacks: without the guard the effect
        // would register again and go back a second time, off EM-02 as well.
        if (e.code === ErrorCode.CONFLICT) {
          returnToForm({
            errors: { [conflictField(e.message)]: withoutSignInTail(e.message) },
            signIn: conflictField(e.message),
            focus: conflictField(e.message),
          })
          onEdit()
          return
        }
        const onForm = formErrorsFrom(fields)
        const first = FIELD_ORDER.find((k) => onForm[k])
        if (first) {
          returnToForm({ errors: onForm, signIn: null, focus: first })
          onEdit()
          return
        }
        creating.current = false
        setCreateError(e.message)
      }
    }
    create()
  }, [both, created, createError, registration, onRegistered, onEdit, patchRow, focusRow])

  async function verify(channel: CodeChannel, code: string) {
    if (rows[channel].verifying) return
    patchRow(channel, { code, verifying: true, error: null, note: null })
    try {
      const proof = await verifyRegisterCode(
        channel === 'EMAIL'
          ? { channel: 'EMAIL', email: registration.email.trim(), code }
          : { channel: 'MOBILE', mobile: registration.mobile, code },
      )
      updateChannel(channel, valueOf(channel), { proof: proof.proof, expiresAt: proof.expiresAt })
      // The digits stay, drawn green, as the confirmed card shows them.
      patchRow(channel, { ...FRESH, confirmedCode: code })
      touched()
      const other: CodeChannel = channel === 'EMAIL' ? 'MOBILE' : 'EMAIL'
      if (!progressOf(other).proof) focusRow(other)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === ErrorCode.VALIDATION) {
        if (e.fields?.code) {
          // Wrong and expired are one answer on purpose: the server no longer
          // says whether a live code exists, so neither may this row. The cells
          // keep the digits in danger so the employer can see what they sent.
          const left = attemptsLeft(e)
          patchRow(channel, { verifying: false, error: left === null ? NO_MATCH : wrongCode(left) })
          return
        }
        const field: FieldKey = channel === 'EMAIL' ? 'email' : 'mobile'
        const refusal = e.fields?.[field]
        if (refusal) return backToForm(field, refusal)
      }
      // The code was never checked, so the cells empty: the next six digits typed or pasted try again.
      patchRow(channel, { verifying: false, code: '', note: messageOf(e) })
    }
  }

  async function resend(channel: CodeChannel) {
    patchRow(channel, { resending: true })
    try {
      const result = await sendRegisterCodes(
        channel === 'EMAIL' ? { email: registration.email.trim() } : { mobile: registration.mobile },
      )
      markCodeSent(channel, valueOf(channel), result)
      // Only an open row resends, so any proof still held has lapsed; the new code replaces it.
      updateChannel(channel, valueOf(channel), { proof: null, expiresAt: null })
      patchRow(channel, FRESH)
      touched()
      focusRow(channel)
    } catch (e) {
      if (applySendLimit(channel, valueOf(channel), e)) {
        patchRow(channel, FRESH)
        touched()
        return
      }
      const field: FieldKey = channel === 'EMAIL' ? 'email' : 'mobile'
      const refusal = e instanceof ApiClientError && e.code === ErrorCode.VALIDATION ? e.fields?.[field] : undefined
      if (refusal) return backToForm(field, refusal)
      patchRow(channel, { resending: false, note: messageOf(e) })
    }
  }

  function card(channel: CodeChannel) {
    const email = channel === 'EMAIL'
    const label = email ? 'Work email' : 'Mobile number'
    const value = email ? registration.email.trim() : displayMobile(registration.mobile)
    const state = rows[channel]
    const isConfirmed = created || confirmed(channel)

    const head = (
      <View style={styles.cardHead}>
        <Icon name={email ? 'mail' : 'phone'} size={spaceHalf['4.5']} tint={color.textMuted} />
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={[styles.cardValue, !email && styles.figure]} numberOfLines={1}>{value}</Text>
        </View>
        {isConfirmed ? (
          <Pill label="Confirmed" />
        ) : (
          <Link
            onPress={() => {
              returnToForm({ errors: {}, signIn: null, focus: email ? 'email' : 'mobile' })
              onEdit()
            }}
          >
            Edit
          </Link>
        )}
      </View>
    )

    if (isConfirmed) {
      return (
        <View key={channel} style={styles.card}>
          {head}
          {state.confirmedCode?.length === codeLength && (
            <OtpBoxes length={codeLength} value={state.confirmedCode} onChange={() => {}} done />
          )}
        </View>
      )
    }

    const p = progressOf(channel)
    const blocked = Boolean(p.blockedUntil && p.blockedUntil > now)
    const secondsLeft = p.resendAt && p.resendAt > now ? Math.ceil((p.resendAt - now) / 1000) : 0
    /** Confirmed once, but the 30-minute proof ran out while the other row waited. The code is spent, so: send a new one. */
    const lapsed = Boolean(p.proof)

    const note = blocked
      ? (p.limitNote ?? `Ask again after ${formatIstTarget(p.blockedUntil!)}.`)
      : (state.note ?? (lapsed ? EXPIRED : null))
    const digits = lengthKnown ? `all ${numberWord(codeLength)} digits` : 'the whole code'
    const helper = state.verifying
      ? 'Checking the code…'
      : email
        ? `Check your inbox. You can paste ${digits}.`
        : 'Sent by SMS. On most phones it fills in by itself.'

    return (
      <View key={channel} style={styles.card}>
        {head}
        <OtpBoxes
          length={codeLength}
          value={state.code}
          editable={!state.verifying && !blocked}
          invalid={!!state.error}
          autoFocus={firstOpen === channel}
          firstRef={(node) => { inputs.current[channel] = node }}
          onChange={(next) => {
            patchRow(channel, {
              code: next,
              error: next.length < codeLength ? null : state.error,
              note: next ? null : state.note,
            })
            if (next.length === codeLength && next !== state.code) verify(channel, next)
          }}
        />
        <MetaRow>
          <View style={styles.cardText}>
            {state.error ? (
              <Meta tone="danger">{state.error}</Meta>
            ) : note ? (
              <Meta tone="warning">{note}</Meta>
            ) : (
              <Text style={styles.helper}>{helper}</Text>
            )}
          </View>
          {!blocked && (
            <ResendAction
              seconds={secondsLeft}
              busy={state.resending}
              wait="Resend in"
              onResend={() => resend(channel)}
            />
          )}
        </MetaRow>
      </View>
    )
  }

  const sentLine = lengthKnown
    ? `We sent a ${codeLength}-digit code to your work email and another to your mobile. Both need to match.`
    : 'We sent a code to your work email and another to your mobile. Both need to match.'
  const documents = documentCount ? `${numberWord(documentCount)} documents` : 'the documents'

  return (
    <BrandScreen
      onBack={onEdit}
      footer={
        both ? (
          createError ? (
            <AButton label="Try again" onPress={() => setCreateError(null)} />
          ) : (
            <AButton busy label="Creating your account…" />
          )
        ) : undefined
      }
    >
      <SheetTitle>Check two codes</SheetTitle>
      <SheetSub>{sentLine}</SheetSub>

      <View style={styles.cards}>
        {card('EMAIL')}
        {card('MOBILE')}
      </View>

      {!!createError && both && (
        <View style={styles.banner}>
          <Banner tone="danger">{createError}</Banner>
        </View>
      )}

      <Tip title="What happens next?">
        When both are confirmed, we create your account and open your home, where you send {documents} to verify the
        company.
      </Tip>
    </BrandScreen>
  )
}

/** Date.now(), re-read once a second while the screen is up — the rows' limits and proofs run out on it. */
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const styles = StyleSheet.create({
  cards: { marginTop: spaceHalf['3.5'], gap: spaceHalf['3.5'] },
  card: {
    gap: spaceHalf['2.5'], padding: space.lg, backgroundColor: color.surface, borderRadius: radius['card-lg'],
    borderWidth: borderWidth.thin, borderColor: color.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  cardText: { flex: 1, minWidth: 0 },
  cardLabel: { fontFamily: fontFamilyNative.bodyBold, fontSize: fontSize['ui-md'], color: color.text },
  cardValue: { fontFamily: fontFamilyNative.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },
  figure: { fontVariant: ['tabular-nums'] },
  helper: { fontFamily: fontFamilyNative.body, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },
  banner: { marginTop: space.lg },
})
