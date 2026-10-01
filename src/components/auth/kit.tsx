import React, { useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Sheet } from '../ui'
import { Icon } from '../ui/Icon'
import { LogoMark } from '../Logo'
import { borderWidth, color, fontFamilyNative, opacity } from '../../theme'

type TI = React.ComponentRef<typeof TextInput>

/**
 * The auth screens' own kit — Login, Create account, OTP and the forms that
 * feed them. Sizes are the signed-off mockup's (docs/landing-home-mockup.html):
 * 14 corners, 50 controls, Geist at 30 / 16 / 14. Colours and faces still come
 * from the theme. Nothing here casts a shadow.
 */

export const A = {
  gutter: 24,
  radius: 14,
  control: 50,
  danger: color.dangerFill,
} as const

const F = {
  regular: fontFamilyNative.body,
  medium: fontFamilyNative.bodyMedium,
  semi: fontFamilyNative.bodySemiBold,
  bold: fontFamilyNative.bodyBold,
  mono: fontFamilyNative.monoMedium,
}

// ── Header ───────────────────────────────────────────────────────────────────

/** Back circle on the left, the mark and wordmark on the right. */
export function AuthTop({ onBack, brand = true }: { onBack?: () => void; brand?: boolean }) {
  return (
    <View style={s.top}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [s.back, pressed && s.pressed]}
        >
          <Icon name="arrowL" size={22} tint={color.text} />
        </Pressable>
      ) : (
        <View style={s.back} />
      )}
      {brand && (
        <View style={s.brand}>
          <View style={s.brandMark}>
            <LogoMark size={16} fill={color.textInverse} />
          </View>
          <Text style={s.brandWord}>apostrophe</Text>
        </View>
      )}
    </View>
  )
}

export const AuthTitle = ({ children }: { children: React.ReactNode }) => <Text style={s.title}>{children}</Text>
export const AuthSub = ({ children }: { children: React.ReactNode }) => <Text style={s.sub}>{children}</Text>

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function AuthSeg<T extends string>({
  options, value, onChange,
}: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o === value
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={[s.segBtn, on && s.segOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{o}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Fields ───────────────────────────────────────────────────────────────────

export function Group({ children }: { children: React.ReactNode }) {
  return <Text style={s.group}>{children}</Text>
}

/** Label, the control, then the error (red) or the helper (grey). */
export function AField({
  label, optional, right, error, helper, onLayoutY, children,
}: {
  label: string
  optional?: boolean
  /** Sits on the label row's right edge — "Forgot?". */
  right?: React.ReactNode
  error?: string | null
  helper?: string
  /** Reports this field's y inside its scroll content, for scroll-to-first-error. */
  onLayoutY?: (y: number) => void
  children: React.ReactNode
}) {
  return (
    <View style={s.field} onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}>
      <View style={s.labelRow}>
        <Text style={s.label}>
          {label}
          {optional ? <Text style={s.optional}>  Optional</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {error ? <Text style={s.msg}>{error}</Text> : helper ? <Text style={s.help}>{helper}</Text> : null}
    </View>
  )
}

type InputProps = Omit<TextInputProps, 'style'> & {
  invalid?: boolean
  inputRef?: React.Ref<TI>
  /** Fixed content before the text — "+91". */
  prefix?: string
  trailing?: React.ReactNode
}

/** The 50-high shell. Focus turns the edge violet, an error turns it red. */
export function AInput({ invalid, inputRef, prefix, trailing, onFocus, onBlur, editable, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[s.box, focused && s.boxFocus, invalid && s.boxInvalid, editable === false && s.boxOff]}>
      {!!prefix && <Text style={s.prefix}>{prefix}</Text>}
      <TextInput
        ref={inputRef}
        placeholderTextColor={color.textSubtle}
        style={s.input}
        editable={editable}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
      {trailing}
    </View>
  )
}

export function APhone(props: Omit<InputProps, 'prefix' | 'keyboardType' | 'maxLength'>) {
  return (
    <AInput
      prefix="+91"
      keyboardType="number-pad"
      maxLength={10}
      placeholder="98765 43210"
      textContentType="telephoneNumber"
      autoComplete="tel"
      {...props}
    />
  )
}

export function APassword({
  shown, onToggle, ...rest
}: { shown: boolean; onToggle: () => void } & Omit<InputProps, 'trailing' | 'secureTextEntry'>) {
  return (
    <AInput
      {...rest}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'}>
          <Text style={s.eye}>{shown ? 'Hide' : 'Show'}</Text>
        </Pressable>
      }
    />
  )
}

/** A select: the shell shows the choice, a bottom sheet lists the options. */
export function ASelect({
  value, placeholder = 'Select', options, title, invalid, onChange, onOpen, empty,
}: {
  value: string
  placeholder?: string
  options: readonly { value: string; label: string; hint?: string }[]
  title: string
  invalid?: boolean
  onChange: (value: string) => void
  /** Called as the sheet opens — a place to refetch a list that has not arrived. */
  onOpen?: () => void
  /** Shown instead of the list when there are no options yet. */
  empty?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${current?.label ?? placeholder}`}
        onPress={() => { onOpen?.(); setOpen(true) }}
        style={({ pressed }) => [s.box, open && s.boxFocus, invalid && s.boxInvalid, pressed && s.pressed]}
      >
        <Text numberOfLines={1} style={[s.selectText, !current && s.placeholder]}>{current?.label ?? placeholder}</Text>
        {!!current?.hint && <Text style={s.selectHint}>{current.hint}</Text>}
        <Icon name="chevD" size={18} tint={color.textSubtle} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {options.length ? (
          <ScrollView style={s.optionList}>
            {options.map((o) => {
              const on = o.value === value
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => { onChange(o.value); setOpen(false) }}
                  style={({ pressed }) => [s.option, pressed && s.pressed]}
                >
                  <Text style={[s.optionText, on && s.optionOn]}>{o.label}</Text>
                  {!!o.hint && <Text style={s.optionHint}>{o.hint}</Text>}
                  {on && <Icon name="check" size={20} tint={color.accent} weight={2.4} />}
                </Pressable>
              )
            })}
          </ScrollView>
        ) : (
          empty ?? null
        )}
      </Sheet>
    </>
  )
}

/** Four bars that fill with the password's strength. Pure feedback: it never blocks. */
export function StrengthMeter({ value }: { value: string }) {
  let n = 0
  if (value.length >= 8) n++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) n++
  if (/\d/.test(value)) n++
  if (/[^A-Za-z0-9]/.test(value)) n++
  const level = value ? Math.max(1, n) : 0
  const fill = [color.dangerFill, color.warningFill, color.successFill, color.successFill][level - 1]
  return (
    <View style={s.meter}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.bar, level >= i && { backgroundColor: fill }]} />
      ))}
    </View>
  )
}

export function PriceBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.price}>
      <Text style={s.priceLabel}>{label}</Text>
      <Text style={s.priceValue}>{value}</Text>
    </View>
  )
}

export function CheckRow({
  on, invalid, onToggle, children,
}: { on: boolean; invalid?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={s.check}
    >
      <View style={[s.checkBox, on && s.checkBoxOn, invalid && !on && s.boxInvalid]}>
        {on && <Icon name="check" size={14} tint={color.textInverse} weight={3} />}
      </View>
      <Text style={s.checkText}>{children}</Text>
    </Pressable>
  )
}

export const Link = ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
  <Text style={s.link} onPress={onPress} suppressHighlighting>{children}</Text>
)

// ── Actions ──────────────────────────────────────────────────────────────────

export function AButton({
  label, variant = 'primary', onPress, busy, disabled, icon, style,
}: {
  label: string
  variant?: 'primary' | 'outline'
  onPress?: () => void
  busy?: boolean
  /** Unavailable — dimmed and inert. Use sparingly: the mockup validates on tap instead. */
  disabled?: boolean
  icon?: React.ReactNode
  style?: ViewStyle
}) {
  const primary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!(busy || disabled) }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnOutline, (pressed || busy) && s.pressed, disabled && s.dim, style]}
    >
      {icon}
      <Text style={[s.btnText, primary && s.btnTextPrimary]}>{label}</Text>
    </Pressable>
  )
}

/** The real four-colour G. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <Path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <Path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.39-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1z" />
      <Path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </Svg>
  )
}

export function GoogleBtn({ label = 'Continue with Google', onPress }: { label?: string; onPress?: () => void }) {
  return <AButton variant="outline" label={label} icon={<GoogleG />} onPress={onPress} style={s.googleGap} />
}

export function OrRow() {
  return (
    <View style={s.or}>
      <View style={s.orRule} />
      <Text style={s.orText}>or</Text>
      <View style={s.orRule} />
    </View>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return <View style={s.note}><Text style={s.noteText}>{children}</Text></View>
}
export const NoteStrong = ({ children }: { children: React.ReactNode }) => <Text style={s.noteStrong}>{children}</Text>

/** The pinned footer — a primary action and, below it, the swap line. */
export function BottomBar({
  insetBottom, children,
}: { insetBottom: number; children: React.ReactNode }) {
  return <View style={[s.barWrap, { paddingBottom: 12 + insetBottom }]}>{children}</View>
}
export function Swap({ lead, action, onPress }: { lead: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={s.swap}>
      <Text style={s.swapText}>{lead} <Text style={s.swapAction}>{action}</Text></Text>
    </Pressable>
  )
}

export function Fine({ children }: { children: React.ReactNode }) {
  return <Text style={s.fine}>{children}</Text>
}

// ── OTP ──────────────────────────────────────────────────────────────────────

/** Six boxes that advance as you type and step back on delete. `value` is the joined code. */
export function OtpBoxes({
  value, onChange, invalid, length = 6, autoFocus, firstRef, editable = true,
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  length?: number
  autoFocus?: boolean
  /** Hands the first box to a parent that needs to move the caret there. */
  firstRef?: (node: TI | null) => void
  editable?: boolean
}) {
  const refs = useRef<(TI | null)[]>([])
  const [focus, setFocus] = useState<number | null>(null)
  const set = (i: number, d: string) => {
    const digits = d.replace(/\D/g, '')
    // A paste (or autofill) of the whole code lands in one box.
    if (digits.length > 1) {
      const full = digits.slice(0, length)
      onChange(full)
      refs.current[Math.min(full.length, length - 1)]?.focus()
      return
    }
    const chars = value.padEnd(length, ' ').split('')
    chars[i] = digits || ' '
    onChange(chars.join('').replace(/ +$/, ''))
    if (digits && i < length - 1) refs.current[i + 1]?.focus()
  }
  return (
    <View style={s.otp}>
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; if (i === 0) firstRef?.(r) }}
          editable={editable}
          value={value[i]?.trim() ?? ''}
          onChangeText={(d) => set(i, d)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !(value[i]?.trim()) && i > 0) refs.current[i - 1]?.focus()
          }}
          onFocus={() => setFocus(i)}
          onBlur={() => setFocus((f) => (f === i ? null : f))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={i === 0 ? length : 1}
          selectTextOnFocus
          autoFocus={autoFocus && i === 0}
          accessibilityLabel={`Digit ${i + 1}`}
          style={[s.otpBox, focus === i && s.boxFocus, invalid && s.boxInvalid]}
        />
      ))}
    </View>
  )
}

export function ResendLine({
  seconds, onResend, blockedNote,
}: { seconds: number; onResend: () => void; blockedNote?: string | null }) {
  if (blockedNote) return <Text style={s.resend}>{blockedNote}</Text>
  return (
    <Text style={s.resend}>
      {seconds > 0 ? (
        <>Resend code in <Text style={s.timer}>0:{String(seconds).padStart(2, '0')}</Text></>
      ) : (
        <>Didn’t get it? <Text style={s.swapAction} onPress={onResend}>Resend code</Text></>
      )}
    </Text>
  )
}

/** A verification row — "Check your email" with a status pill. */
export function VerifyRow({
  icon, title, sub, status, done,
}: { icon: 'mail' | 'phone'; title: string; sub: string; status: string; done?: boolean }) {
  return (
    <View style={s.vrow}>
      <View style={s.vIcon}><Icon name={icon} size={20} tint={color.accent} /></View>
      <View style={s.vText}>
        <Text style={s.vTitle}>{title}</Text>
        <Text style={s.vSub} numberOfLines={2}>{sub}</Text>
      </View>
      <Text style={[s.pill, done && s.pillOk]}>{status}</Text>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingHorizontal: 14 },
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 10 },
  brandMark: { width: 28, height: 28, borderRadius: 9, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  brandWord: { fontFamily: F.bold, fontSize: 17, letterSpacing: -0.34, color: color.text },

  title: { fontFamily: F.bold, fontSize: 30, lineHeight: 33, letterSpacing: -1.05, color: color.text },
  sub: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: color.textMuted, marginTop: 8 },

  seg: { flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: A.radius, padding: 4, marginTop: 16 },
  segBtn: { flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  segText: { fontFamily: F.semi, fontSize: 15, color: color.textMuted },
  segTextOn: { color: color.accent },

  group: {
    fontFamily: F.mono, fontSize: 11, letterSpacing: 1.54, textTransform: 'uppercase',
    color: color.textMuted, marginTop: 24, marginBottom: 2,
  },

  field: { marginTop: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontFamily: F.semi, fontSize: 14, color: color.textSecondary },
  optional: { fontFamily: F.medium, color: color.textSubtle },
  msg: { fontFamily: F.regular, fontSize: 13, color: A.danger, marginTop: 6 },
  help: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: color.textMuted, marginTop: 6 },

  box: {
    height: A.control, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.border, borderRadius: A.radius,
  },
  boxFocus: { borderColor: color.accent },
  boxInvalid: { borderColor: A.danger },
  boxOff: { backgroundColor: color.surfaceMuted },
  input: { flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, paddingHorizontal: 0, fontFamily: F.regular, fontSize: 16, color: color.text },
  placeholder: { color: color.textSubtle },
  selectText: { flex: 1, fontFamily: F.regular, fontSize: 16, lineHeight: 22, color: color.text, textAlignVertical: 'center' },
  selectHint: { fontFamily: F.semi, fontSize: 14, color: color.textMuted },
  prefix: {
    fontFamily: F.semi, fontSize: 16, color: color.textSecondary, paddingRight: 10,
    borderRightWidth: borderWidth.thin, borderRightColor: color.border,
  },
  eye: { fontFamily: F.semi, fontSize: 13.5, color: color.textMuted },

  optionList: { maxHeight: 360 },
  option: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: 16, color: color.text },
  optionHint: { fontFamily: F.semi, fontSize: 14, color: color.textMuted, marginRight: 10 },
  optionOn: { fontFamily: F.semi, color: color.accent },

  meter: { flexDirection: 'row', gap: 4, marginTop: 8 },
  bar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: color.surfaceSunken },

  price: {
    marginTop: 10, backgroundColor: color.accentSoft, borderRadius: A.radius, paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  priceLabel: { fontFamily: F.regular, fontSize: 14, color: color.textSecondary },
  priceValue: { fontFamily: F.bold, fontSize: 16, color: color.accentDeep },

  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  checkBox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: borderWidth.accent, borderColor: color.borderStrong,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkBoxOn: { backgroundColor: color.accent, borderColor: color.accent },
  checkText: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: color.textSecondary },
  link: { fontFamily: F.semi, color: color.accent },

  btn: {
    height: A.control, borderRadius: A.radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimary: { backgroundColor: color.accent },
  btnOutline: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  btnText: { fontFamily: F.bold, fontSize: 16, color: color.text },
  btnTextPrimary: { color: color.textInverse },
  googleGap: { marginTop: 12 },

  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 4 },
  orRule: { flex: 1, height: borderWidth.thin, backgroundColor: color.border },
  orText: { fontFamily: F.regular, fontSize: 14, color: color.textSubtle },

  note: { marginTop: 18, backgroundColor: color.accentSoft, borderRadius: A.radius, padding: 14 },
  noteText: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: color.textSecondary },
  noteStrong: { fontFamily: F.semi, color: color.accentDeep },

  barWrap: {
    paddingTop: 12, paddingHorizontal: A.gutter, gap: 10, backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },
  swap: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  swapText: { fontFamily: F.regular, fontSize: 15, color: color.textMuted, textAlign: 'center' },
  swapAction: { fontFamily: F.bold, color: color.accent },
  fine: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: color.textSubtle, textAlign: 'center', marginTop: 16 },

  otp: { flexDirection: 'row', gap: 8, marginTop: 26 },
  otpBox: {
    flex: 1, height: 56, borderRadius: A.radius, borderWidth: borderWidth.medium, borderColor: color.border,
    backgroundColor: color.surface, textAlign: 'center', fontFamily: F.bold, fontSize: 22, color: color.text,
    paddingVertical: 0, paddingHorizontal: 0,
  },
  resend: { fontFamily: F.regular, fontSize: 15, color: color.textMuted, textAlign: 'center', marginTop: 22 },
  timer: { fontFamily: F.semi, color: color.textSubtle },

  vrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surface, borderWidth: borderWidth.thin,
    borderColor: color.border, borderRadius: A.radius, paddingVertical: 12, paddingHorizontal: 14,
  },
  vIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  vText: { flex: 1 },
  vTitle: { fontFamily: F.semi, fontSize: 15, color: color.text },
  vSub: { fontFamily: F.regular, fontSize: 14, color: color.textMuted },
  pill: {
    fontFamily: F.semi, fontSize: 12.5, color: '#C77D00', backgroundColor: color.warningSoft,
    paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, overflow: 'hidden',
  },
  pillOk: { color: color.success, backgroundColor: color.successSoft },
})

/** Scroll-to-first-error: fields report their y; call `to(key)` with the first failing key. */
export function useFieldScroll() {
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const ys = useRef<Record<string, number>>({})
  return {
    scroller,
    at: (key: string) => (y: number) => { ys.current[key] = y },
    to: (key: string) => scroller.current?.scrollTo({ y: Math.max(0, (ys.current[key] ?? 0) - 24), animated: true }),
  }
}
