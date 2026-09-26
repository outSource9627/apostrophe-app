import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import { EmIconButton, EmRadioRow, EmSheet } from './em'

/**
 * The Employer Android form pieces (`gen/h.js` H.fld, H.inp with a chevron,
 * H.seg), for the job editor and anywhere else a form needs them. Tokens only.
 */

/** H.fld: the 13/600 label, an optional note beside it, the control, and one line under it — the error in red with a mark, or a hint. */
export function EmField({
  label, note, hint, error, children,
}: { label: string; note?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[text.uiSmSemi, styles.secondary]}>{label}</Text>
        {!!note && <Text style={[text.uiXs, styles.subtle]}>{note}</Text>}
      </View>
      {children}
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={space.md + 2} tint={color.danger} weight={2} />
          <Text style={[text.uiXs, styles.danger, styles.grow]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[text.uiXs, styles.muted]}>{hint}</Text>
      ) : null}
    </View>
  )
}

/** A select (H.inp with a chevron): shows the choice, opens a sheet of radio rows. */
export function EmSelect<T extends string>({
  value, options, onChange, placeholder = 'Choose', title, invalid, disabled,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  placeholder?: string
  /** The sheet's title; the field's label. */
  title: string
  invalid?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const chosen = options.find((o) => o.value === value)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${chosen?.label ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, invalid && styles.boxInvalid, disabled && styles.boxOff, pressed && styles.pressed]}
      >
        <Text style={[text.uiBase, styles.grow, !chosen && styles.subtle]} numberOfLines={1}>{chosen?.label ?? placeholder}</Text>
        <Icon name="chevD" size={space.lg} tint={color.textMuted} />
      </Pressable>
      <EmSheet open={open} onClose={() => setOpen(false)} title={title}>
        {options.map((o) => (
          <EmRadioRow
            key={o.value}
            label={o.label}
            on={o.value === value}
            onPress={() => {
              onChange(o.value)
              setOpen(false)
            }}
          />
        ))}
      </EmSheet>
    </>
  )
}

/** H.seg: a muted track with the chosen pane raised in white. A radio group. */
export function EmSeg<T extends string>({
  options, value, onChange, label, compact,
}: { options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void; label: string; compact?: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.seg}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: space.xs, bottom: space.xs }}
            style={({ pressed }) => [styles.segItem, compact && styles.segCompact, on && styles.segOn, pressed && styles.pressed]}
          >
            <Text style={[on ? text.uiSmSemi : text.uiSmMedium, { color: on ? color.text : color.textMuted }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** A calendar day, independent of any time zone. */
export interface Ymd { y: number; m: number; d: number }

export const ymdLabel = (v: Ymd) => `${v.d} ${MON_SHORT[v.m]} ${v.y}`

/** Today in IST. */
export function todayIst(): Ymd {
  const t = new Date(Date.now() + 330 * 60_000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }
}

const cmp = (a: Ymd, b: Ymd) => a.y - b.y || a.m - b.m || a.d - b.d

/**
 * A date field: the chosen day (or the placeholder) opening a month grid in a
 * sheet. Days before `min` cannot be chosen. "Clear" empties it.
 */
export function EmDateField({
  value, onChange, min, max, placeholder = 'No deadline', title, invalid, clearable = true,
}: { value: Ymd | null; onChange: (v: Ymd | null) => void; min: Ymd; max?: Ymd; placeholder?: string; title: string; invalid?: boolean; clearable?: boolean }) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const start = value ?? min
  const [month, setMonth] = useState({ y: start.y, m: start.m })

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay() // 0 = Sunday
    const lead = (first + 6) % 7 // Monday first
    const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate()
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[]
  }, [month])

  const step = (delta: number) => setMonth((cur) => {
    const t = new Date(Date.UTC(cur.y, cur.m + delta, 1))
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() }
  })
  const canBack = month.y > min.y || (month.y === min.y && month.m > min.m)
  const canNext = !max || month.y < max.y || (month.y === max.y && month.m < max.m)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value ? ymdLabel(value) : placeholder}`}
        onPress={() => {
          setMonth({ y: start.y, m: start.m })
          setOpen(true)
        }}
        style={({ pressed }) => [styles.box, invalid && styles.boxInvalid, pressed && styles.pressed]}
      >
        <Icon name="cal" size={space.lg + 2} tint={color.textSubtle} />
        <Text style={[text.uiBase, styles.grow, !value && styles.subtle]} numberOfLines={1}>{value ? ymdLabel(value) : placeholder}</Text>
      </Pressable>
      <EmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        foot={
          clearable ? (
            <View style={[styles.dateFoot, { paddingBottom: space.md + insets.bottom }]}>
              <Pressable accessibilityRole="button" onPress={() => { onChange(null); setOpen(false) }} hitSlop={space.sm}>
                <Text style={[text.uiMdSemi, styles.accent]}>Clear</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      >
        <View style={styles.monthRow}>
          <EmIconButton name="arrowL" label="Previous month" disabled={!canBack} onPress={() => step(-1)} />
          <Text style={[text.uiBaseSemi, styles.grow, styles.center]}>{`${MON[month.m]} ${month.y}`}</Text>
          <EmIconButton name="arrowR" label="Next month" disabled={!canNext} onPress={() => step(1)} />
        </View>
        <View style={styles.grid}>
          {DOW.map((d, i) => <Text key={`${d}${i}`} style={[text.metaSm, styles.dow]}>{d}</Text>)}
          {cells.map((d, i) => {
            if (d === null) return <View key={`e${i}`} style={styles.cell} />
            const day = { y: month.y, m: month.m, d }
            const off = cmp(day, min) < 0 || (!!max && cmp(day, max) > 0)
            const on = !!value && cmp(day, value) === 0
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ disabled: off, selected: on }}
                accessibilityLabel={ymdLabel(day)}
                disabled={off}
                onPress={() => { onChange(day); setOpen(false) }}
                style={styles.cell}
              >
                <View style={[styles.day, on && styles.dayOn]}>
                  <Text style={[text.uiMd, off ? styles.faint : on ? styles.onInk : null]}>{d}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </EmSheet>
    </>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  pressed: { opacity: opacity.pressed },
  secondary: { color: color.textSecondary },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  faint: { color: color.textDisabled },
  danger: { color: color.danger },
  accent: { color: color.accent },
  onInk: { color: color.textInverse },

  field: { gap: spaceHalf['1.5'], minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['1.5'] },

  box: { height: height.control, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, paddingHorizontal: spaceHalf['3.5'], flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  boxInvalid: { borderWidth: borderWidth.medium, borderColor: color.dangerFill },
  boxOff: { backgroundColor: color.surfaceMuted },

  seg: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.tile, backgroundColor: color.surfaceMuted },
  segItem: { flex: 1, height: height.segment, borderRadius: radius.ctl + 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  segCompact: { height: height.segment - 2 },
  segOn: { backgroundColor: color.surface, boxShadow: shadow.raised },

  monthRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', color: color.textSubtle, paddingVertical: space.xs },
  cell: { width: `${100 / 7}%`, height: height.tap, alignItems: 'center', justifyContent: 'center' },
  day: { width: height.avatar - 2, height: height.avatar - 2, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: color.ink },
  dateFoot: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
})
