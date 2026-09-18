import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, space } from '../../theme'
import { Banner, Body, Button, Display, Eyebrow } from '../../components/ui'
import { CodeRow, Glyph, TextAction } from '../../components/employer'
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
}

const FRESH: RowState = { code: '', error: null, note: null, verifying: false, resending: false }

const EXPIRED = 'That code has expired. Send a new one.'

const wrongCode = (left: number) =>
  left === 0
    ? 'That code doesn’t match, and it can’t be tried again. Send a new one.'
    : `That code doesn’t match. ${left} ${left === 1 ? 'try' : 'tries'} left.`

type TextInputRef = React.ComponentRef<typeof TextInput>

/**
 * EM-03 · Confirm your email and mobile.
 *
 * TWO INDEPENDENT VERIFICATIONS, NEVER A STEPPER. Each CodeRow verifies on its
 * sixth digit — typed, pasted or filled by the platform — with POST
 * /employers/register/verify, keeps the proof it earns in the registration
 * progress, and resends only its own channel on its own countdown. A wrong
 * code, an expired code or an hourly limit on one row leaves the other exactly
 * as it was.
 *
 * There is no Continue. When both rows hold a live proof the account is
 * created with those proofs, registerEmployer stores the tokens, and the stack
 * is reset to home — which also drops the route params holding the password.
 *
 * A refusal about the FORM — an address that already has an account, an
 * industry no longer on the list — goes back to EM-02 and lands on that field.
 *
 * The same states, copy and order as the web's /employers/verify.
 */
export function EmployerVerifyScreen({
  registration, sent, sentAt, onEdit, onRegistered,
}: EmployerVerifyScreenProps) {
  const insets = useSafeAreaInsets()
  const now = useClock()
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
      patchRow(channel, FRESH)
      touched()
      const other: CodeChannel = channel === 'EMAIL' ? 'MOBILE' : 'EMAIL'
      if (!progressOf(other).proof) focusRow(other)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === ErrorCode.VALIDATION) {
        if (e.fields?.code) {
          // Wrong and expired are one answer; only a live code has tries to count.
          const left = attemptsLeft(e)
          patchRow(channel, left === null ? { ...FRESH, note: EXPIRED } : { verifying: false, error: wrongCode(left) })
          return
        }
        const field: FieldKey = channel === 'EMAIL' ? 'email' : 'mobile'
        const refusal = e.fields?.[field]
        if (refusal) return backToForm(field, refusal)
      }
      patchRow(channel, { verifying: false, note: messageOf(e) })
    }
  }

  async function resend(channel: CodeChannel) {
    patchRow(channel, { resending: true })
    try {
      const result = await sendRegisterCodes(
        channel === 'EMAIL' ? { email: registration.email.trim() } : { mobile: registration.mobile },
      )
      markCodeSent(channel, valueOf(channel), result)
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

  function row(channel: CodeChannel) {
    const email = channel === 'EMAIL'
    const label = email ? 'Work email' : 'Mobile'
    const value = email ? registration.email.trim() : displayMobile(registration.mobile)

    if (created || confirmed(channel)) {
      return <CodeRow key={channel} label={label} value={value} code="" confirmed />
    }

    const p = progressOf(channel)
    const state = rows[channel]
    const blocked = Boolean(p.blockedUntil && p.blockedUntil > now)
    const resendReady = !(p.resendAt && p.resendAt > now)

    const note = blocked ? (p.limitNote ?? `Ask again after ${formatIstTarget(p.blockedUntil!)}.`) : state.note
    const helper = state.verifying
      ? 'Checking the code…'
      : resendReady && !state.code
        ? email
          ? 'Nothing yet? Check the address, then resend.'
          : 'Nothing yet? Check the number, then resend.'
        : email
          ? 'Check your inbox. You can paste all six digits.'
          : 'Sent by SMS. On most phones it fills in by itself.'

    return (
      <CodeRow
        key={channel}
        label={label}
        value={value}
        code={state.code}
        onChangeCode={
          state.verifying
            ? undefined
            : (next) => {
                patchRow(channel, {
                  code: next,
                  error: next.length < 6 ? null : state.error,
                  note: next ? null : state.note,
                })
                if (next.length === 6 && next !== state.code) verify(channel, next)
              }
        }
        helper={helper}
        note={note}
        error={state.error}
        inert={blocked}
        resendAvailableAt={p.resendAt}
        onResend={() => resend(channel)}
        resending={state.resending}
        onEdit={() => {
          returnToForm({ errors: {}, signIn: null, focus: email ? 'email' : 'mobile' })
          onEdit()
        }}
        autoFocus={firstOpen === channel}
        inputRef={(node) => {
          inputs.current[channel] = node
        }}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to create account"
          onPress={onEdit}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Glyph name="chevronLeft" size={height.glyph} weight={borderWidth.accent} />
        </Pressable>
        <Eyebrow>Create account</Eyebrow>
      </View>

      <ScrollView
        style={styles.grow}
        contentContainerStyle={[styles.body, { paddingBottom: space['2xl'] + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.title}>
          <Display level="lg" accessibilityRole="header">
            Confirm your email and mobile
          </Display>
          <Body tone="muted">We sent a 6-digit code to each. They are separate, so enter them in any order.</Body>
        </View>

        {row('EMAIL')}
        {row('MOBILE')}

        {!both ? (
          <Body size="sm" tone="muted">
            When both are confirmed, we create your account and open your home.
          </Body>
        ) : createError ? (
          <Banner tone="danger">
            <Body size="xs" style={styles.dangerInk}>
              {createError}
            </Body>
            <TextAction label="Try again" onPress={() => setCreateError(null)} style={styles.start} />
          </Banner>
        ) : (
          <View style={styles.handoff} accessibilityLiveRegion="polite">
            <Button variant="primary" size="lg" full busy label="Creating your account…" />
            <Body size="xs" tone="muted">
              Next is your home, where you send two documents to verify the company.
            </Body>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  pressed: { opacity: opacity.pressed },

  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xs'],
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  // Hung over the gutter so the chevron lines up with the content edge.
  back: {
    width: height.tap,
    height: height.tap,
    marginLeft: -space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.xl },
  title: { gap: space.sm },
  handoff: { marginTop: space.sm, gap: space.sm },
  dangerInk: { color: color.danger },
})
