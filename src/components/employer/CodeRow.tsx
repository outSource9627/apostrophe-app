import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type TextInput } from 'react-native'
import { color, fontFamilyNative, height, radius, space } from '../../theme'
import { Body, Card, Eyebrow, OtpInput, StatusPill, text } from '../ui'
import { formatCountdown } from '../../lib/employer/state'
import { Glyph, TextAction } from './parts'

/**
 * EM-03 · one channel's code. Two of these sit on the verify screen, one for
 * the work email and one for the mobile, and each is independent: its own
 * cells, its own message, its own resend countdown. They are never a stepper.
 *
 *   open       the address with Edit, six cells, then the helper — or the error
 *              that replaces it — beside the row's own resend
 *   confirmed  collapsed to a tick, the address and a Confirmed pill
 *   inert      the hourly limit: the cells stop taking input and the row says
 *              when to try again; there is no resend to press, Edit still works
 *
 * The six cells are the library OtpInput: one real input behind them owns
 * paste and the platform's one-time-code autofill, so pasting all six digits
 * fills the row. The countdown is mono; crimson never touches a cell, a timer
 * or a resend.
 */
export function CodeRow({
  label, value, code, onChangeCode, confirmed = false, helper, note, error, inert = false,
  resendAvailableAt = null, onResend, resending = false, onEdit, autoFocus = false, inputRef,
}: {
  /** 'Work email' · 'Mobile'. */
  label: string
  /** The address or number the code went to, as it should read. */
  value: string
  code: string
  onChangeCode?: (next: string) => void
  confirmed?: boolean
  /** The quiet line under the cells. */
  helper?: string
  /**
   * A routine sentence in place of the helper — an expired code, the hourly
   * limit, a send that did not go. The board sets it a step up and muted, and
   * the cells stay calm: it is not an error.
   */
  note?: string | null
  /** Replaces the helper, and turns the cells danger. */
  error?: string | null
  /** The hourly limit: cells inert, no resend. Put the "ask again after" sentence in `helper`. */
  inert?: boolean
  /** Epoch ms when this row may resend. Null or past: the resend action shows. */
  resendAvailableAt?: number | null
  onResend?: () => void
  resending?: boolean
  onEdit?: () => void
  autoFocus?: boolean
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>
}) {
  const now = useNow(!confirmed && !inert && resendAvailableAt != null ? resendAvailableAt : null)

  if (confirmed) {
    return (
      <Card style={styles.done} accessible accessibilityLabel={`${label} confirmed: ${value}`}>
        <View style={styles.tick}>
          <Glyph name="check" size={space.lg} tint={color.success} />
        </View>
        <View style={styles.grow}>
          <Body size="md" weight="semibold">
            {label}
          </Body>
          <Body size="sm" tone="muted">
            {value}
          </Body>
        </View>
        <StatusPill tone="success" label="Confirmed" />
      </Card>
    )
  }

  const secondsLeft = resendAvailableAt == null ? 0 : Math.ceil((resendAvailableAt - now) / 1000)

  return (
    <Card style={styles.card}>
      <Eyebrow>{label}</Eyebrow>
      <View style={styles.valueRow}>
        <Text style={[text.uiBase, styles.value]}>{value}</Text>
        {!!onEdit && <TextAction label="Edit" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} />}
      </View>

      <View style={styles.cells}>
        <OtpInput
          value={code}
          onChange={onChangeCode}
          invalid={!!error}
          inert={inert}
          label={`${label} code`}
          autoFocus={autoFocus}
          inputRef={inputRef}
        />
      </View>

      <View style={styles.foot}>
        <Body
          size={error || note ? 'sm' : 'xs'}
          tone={error ? 'danger' : note ? 'muted' : 'subtle'}
          style={styles.grow}
          accessibilityLiveRegion={error ? 'assertive' : note ? 'polite' : 'none'}
        >
          {error || note || helper}
        </Body>
        {!inert &&
          !!onResend &&
          (secondsLeft > 0 ? (
            <Text accessibilityRole="timer" style={[text.metaMd, styles.timer]}>
              {`Resend in ${formatCountdown(secondsLeft)}`}
            </Text>
          ) : (
            <TextAction
              label={resending ? 'Sending…' : 'Resend code'}
              accessibilityLabel={`Resend the ${label.toLowerCase()} code`}
              disabled={resending}
              onPress={onResend}
            />
          ))}
      </View>
    </Card>
  )
}

/** Date.now(), re-read every second until `until` has passed. Idle when null. */
function useNow(until: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until == null) return
    setNow(Date.now())
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= until) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [until])
  return now
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  card: { padding: space.lg },
  valueRow: { marginTop: space['2xs'], flexDirection: 'row', alignItems: 'center', gap: space.md },
  value: { flex: 1, fontFamily: fontFamilyNative.bodyMedium },
  cells: { marginTop: space.xs },
  foot: {
    marginTop: space.sm,
    minHeight: height.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  timer: { color: color.textSubtle },

  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: height.tap,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  tick: {
    width: space['2xl'],
    height: space['2xl'],
    borderRadius: radius.pill,
    backgroundColor: color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
