import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from 'react-native'
import { borderWidth, color, height, radius, space } from '../../theme'
import { Body, Eyebrow } from './Type'
import { text } from './typography'

/**
 * Foundations §06 — fields, and the six states.
 *
 * Two decisions from the spec are enforced here rather than left to each form.
 *
 * The label sits ABOVE the field in mono caps. Not floating inside it: a label
 * that lives in the field disappears the moment there is a value, which is
 * exactly when a long form needs it most, and it has nowhere to go when a
 * translation runs long.
 *
 * The error REPLACES the helper line, never joins it. Two lines of guidance
 * under one input is how a form starts jumping around as someone types.
 */
export function Field({
  label, helper, error, locked, children,
}: {
  label: string
  helper?: string
  /** Replaces `helper` when present, and colours it danger. */
  error?: string
  /** The value is set and cannot be changed here — the label says so. */
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={styles.field}>
      <Eyebrow>
        {label}
        {locked ? <Text style={{ color: color.borderStrong }}> · locked</Text> : null}
      </Eyebrow>
      {children}
      {!!(error || helper) && (
        <Body size="xs" tone={error ? 'danger' : 'subtle'}>
          {error ?? helper}
        </Body>
      )}
    </View>
  )
}

export function Input({
  invalid = false, style, onFocus, onBlur, ...rest
}: { invalid?: boolean } & TextInputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      placeholderTextColor={color.textSubtle}
      style={[
        text.uiBase,
        styles.input,
        invalid ? styles.inputInvalid : rest.editable === false ? styles.inputOff : focused ? styles.inputFocus : styles.inputIdle,
        style,
      ]}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...rest}
    />
  )
}

/**
 * A field whose value is fixed and consequential — the qualification that sets
 * a price tier, the number the account is keyed to. It shows the value and, on
 * the right, what that value decides. Explaining the consequence is the whole
 * reason this is its own component rather than a disabled Input.
 */
export function LockedField({ value, consequence }: { value: string; consequence?: string }) {
  return (
    <View style={[styles.input, styles.inputOff, styles.lockedRow]}>
      <Body tone="subtle" numberOfLines={1} style={styles.grow}>
        {value}
      </Body>
      {!!consequence && <Text style={[text.metaPill, { color: color.textSubtle }]}>{consequence}</Text>}
    </View>
  )
}

/**
 * The OTP field. Digits set in the serif because they are a value being read
 * back, not interface — the same reason a salary is.
 *
 * One real input sits behind the cells and owns the caret, so paste and the
 * platform's one-time-code autofill both work. Per-cell inputs break both,
 * which is the usual way this control goes wrong.
 */
export function OtpInput({
  length = 6, value, onChange, invalid = false, label = 'One-time code',
}: { length?: number; value: string; onChange?: (next: string) => void; invalid?: boolean; label?: string }) {
  const [focused, setFocused] = useState(false)
  const digits = value.slice(0, length).split('')
  const caretAt = Math.min(digits.length, length - 1)

  return (
    <View>
      <View style={styles.otpRow} pointerEvents="none">
        {Array.from({ length }).map((_, i) => {
          const active = focused && i === caretAt
          const filled = i < digits.length
          return (
            <View
              key={i}
              style={[
                styles.otpCell,
                invalid ? styles.inputInvalid : active ? styles.inputFocus : filled ? styles.inputIdle : styles.inputOff,
              ]}
            >
              <Text style={text.displaySm}>{digits[i] ?? ''}</Text>
            </View>
          )
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChange?.(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel={label}
        maxLength={length}
        caretHidden
        style={styles.otpCatcher}
      />
    </View>
  )
}

/**
 * An uploaded document. Dashed while it is a drop target, and the constraints
 * are mono fine print beside the size — a person finds out the limit before
 * they pick a 40 MB scan, not after.
 */
export function FileField({
  filename, detail, state = 'idle', onPress,
}: { filename?: string; detail?: string; state?: 'idle' | 'uploaded' | 'error'; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.file, state === 'error' ? styles.fileError : styles.fileIdle]}
    >
      <View style={styles.fileGlyph} />
      <View style={styles.grow}>
        <Body size="sm" weight="medium" numberOfLines={1}>
          {filename ?? 'Choose a file'}
        </Body>
        {!!detail && <Text style={[text.metaMd, styles.fileDetail]}>{detail}</Text>}
      </View>
    </Pressable>
  )
}

/** A labelled row in a settings or detail list. */
export function ListRow({
  label, value, onPress, style,
}: { label: string; value?: string; onPress?: () => void; style?: ViewProps['style'] }) {
  const Container: React.ElementType = onPress ? Pressable : View
  return (
    <Container accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={[styles.listRow, style]}>
      <Body size="sm" weight="medium" style={styles.grow}>
        {label}
      </Body>
      {!!value && (
        <Body size="sm" tone="muted">
          {value}
        </Body>
      )}
    </Container>
  )
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  grow: { flex: 1 },
  input: {
    height: height.control,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    paddingHorizontal: space.lg,
  },
  inputIdle: { borderColor: color.borderStrong, backgroundColor: color.surface },
  inputFocus: { borderColor: color.ink, backgroundColor: color.surface },
  inputInvalid: { borderColor: color.danger, backgroundColor: color.dangerSoft },
  inputOff: { borderColor: color.border, backgroundColor: color.surfaceMuted },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  otpRow: { flexDirection: 'row', gap: space.sm },
  otpCell: {
    flex: 1,
    height: height.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
  },
  otpCatcher: { position: 'absolute', top: 0, left: 0, right: 0, height: height.control, opacity: 0 },

  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
    padding: space.lg,
  },
  fileIdle: { borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
  fileError: { borderColor: color.danger, backgroundColor: color.dangerSoft },
  fileGlyph: {
    width: height.avatar,
    height: height.avatar,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  fileDetail: { marginTop: space['2xs'] },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
})
