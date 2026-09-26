import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type TextInput } from 'react-native'
import { color, space, spaceHalf, trackingNative } from '../../theme'
import { OtpInput, text } from '../ui'
import { Icon } from '../ui/Icon'
import { EmBadge, EmCard } from './em'
import { formatCountdown } from '../../lib/employer/state'
import { TextAction } from './parts'

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
      <EmCard>
        <View style={styles.head}>
          <View style={styles.grow}>
            <Text style={text.uiBaseSemi}>{label}</Text>
            <Text style={[text.uiSm, styles.muted]}>{value}</Text>
          </View>
          <EmBadge label="Verified" tone="green" icon="check" small />
        </View>
      </EmCard>
    )
  }

  const secondsLeft = resendAvailableAt == null ? 0 : Math.ceil((resendAvailableAt - now) / 1000)

  return (
    <EmCard tone={error ? 'danger' : undefined}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={text.uiBaseSemi}>{label}</Text>
          <Text style={[text.uiSm, styles.muted]}>{value}</Text>
        </View>
        {!inert && !!onResend && (secondsLeft > 0 ? (
          <Text accessibilityRole="timer" style={[text.metaSm, styles.timer]}>{`RESEND ${formatCountdown(secondsLeft)}`}</Text>
        ) : (
          <TextAction
            label={resending ? 'Sending…' : 'Resend'}
            accessibilityLabel={`Resend the ${label.toLowerCase()} code`}
            underline={false}
            disabled={resending}
            onPress={onResend}
          />
        ))}
      </View>

      <OtpInput
        value={code}
        onChange={onChangeCode}
        invalid={!!error}
        inert={inert}
        label={`${label} code`}
        autoFocus={autoFocus}
        inputRef={inputRef}
      />

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="assertive">
          <Icon name="alert" size={space.lg - 1} tint={color.danger} weight={2} />
          <Text style={[text.uiSm, styles.error]}>{error}</Text>
        </View>
      ) : (note || helper) ? (
        <Text style={[text.uiXs, styles.muted]} accessibilityLiveRegion={note ? 'polite' : 'none'}>{note || helper}</Text>
      ) : null}
      {!!onEdit && (
        <TextAction label="Wrong details? Edit them" underline={false} accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} />
      )}
    </EmCard>
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
  grow: { flex: 1, gap: space['2xs'] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  muted: { color: color.textMuted },
  timer: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  error: { flex: 1, color: color.danger },
})
