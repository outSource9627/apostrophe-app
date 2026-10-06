import React, { useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sheet } from '../ui'
import { Icon, type IconName } from '../ui/Icon'
import { LogoMark } from '../Logo'
import { useLightStatusBar } from '../../lib/useLightStatusBar'
import {
  borderWidth, color, fontFamilyNative, fontSize, height, leadingNative, opacity, radius, space, spaceHalf, trackingNative,
} from '../../theme'
import { clock, openLegal } from './config'

type TI = React.ComponentRef<typeof TextInput>
type ViewRef = React.ComponentRef<typeof View>
type ScrollRef = React.ComponentRef<typeof ScrollView>

/**
 * The auth screens' own kit — sign-in, the three registrations, the code
 * screens and the forms that feed them.
 *
 * The registrations are drawn as direction C, "Brand header"
 * (docs/registration-mockups.html?dir=C): a violet band carrying the mark and
 * the title, then a white sheet with a rounded top laid over it, sections
 * split by a hairline, 48 fields with a leading icon, and a sticky footer.
 * Every value comes from the theme. Nothing here casts a shadow, and nothing
 * here is set in capitals.
 */

export const A = {
  /** The older auth screens' gutter (sign-in, forgot password). */
  gutter: spaceHalf['6'],
  /** Inside the C sheet. */
  sheetGutter: spaceHalf['4.5'],
  radius: radius.tile,
  control: height.control,
  danger: color.danger,
} as const

const F = {
  regular: fontFamilyNative.body,
  medium: fontFamilyNative.bodyMedium,
  semi: fontFamilyNative.bodySemiBold,
  bold: fontFamilyNative.bodyBold,
}

/** A glyph inside a field or a card head: 18. */
const GLYPH = space.lg + space['2xs']

// ── Direction C · the brand band and its sheet ───────────────────────────────

/**
 * The C page: the violet band (status bar, mark, title, sub), the white sheet
 * laid over it, and the sticky footer. The band's gradient is fixed behind the
 * top of the page while its words scroll with the form — so once the form is
 * scrolled, the sheet sits right under a violet status bar and the keyboard
 * still leaves the fields room.
 */
export function BrandScreen({
  title, sub, onBack, footer, children, scrollRef, contentRef,
}: {
  /** In the band, in white. Leave it out on a code screen, whose title sits in the sheet. */
  title?: string
  sub?: string
  onBack?: () => void
  footer?: React.ReactNode
  children: React.ReactNode
  scrollRef?: React.Ref<ScrollRef>
  /** Wraps the whole scrolled content (band and sheet), for measuring a field's offset. */
  contentRef?: React.Ref<ViewRef>
}) {
  useLightStatusBar()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [bandH, setBandH] = useState(0)

  return (
    <View style={s.brandPage}>
      <BrandBand width={width} height={insets.top + bandH} />
      <KeyboardAvoidingView
        style={[s.fill, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={s.fill}
          contentContainerStyle={s.brandScroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View ref={contentRef} collapsable={false} style={s.brandContent}>
            <View style={[s.bandBody, !title && s.bandBodyBare]} onLayout={(e) => setBandH(e.nativeEvent.layout.height)}>
              <View style={s.brandRow}>
                {onBack && (
                  <Pressable
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={space.sm}
                    style={({ pressed }) => [s.bandBack, pressed && s.pressed]}
                  >
                    <Icon name="arrowL" size={space.xl} tint={color.textOnInk} />
                  </Pressable>
                )}
                <View style={s.markTile}>
                  <LogoMark size={height['brand-mark'] * 0.6} fill={color.accent} />
                </View>
                <Text style={s.markWord}>apostrophe</Text>
              </View>
              {!!title && (
                <View style={s.bandText}>
                  <Text style={s.bandTitle} accessibilityRole="header">{title}</Text>
                  {!!sub && <Text style={s.bandSub}>{sub}</Text>}
                </View>
              )}
            </View>
            <View style={s.sheet}>{children}</View>
          </View>
        </ScrollView>
        {!!footer && <View style={[s.foot, { paddingBottom: spaceHalf['4.5'] + insets.bottom }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </View>
  )
}

/**
 * The band's ground: accent-bright into accent into accent-deep at 150°, with
 * the faint disc in its top-right corner. Drawn in the band's own pixels so the
 * angle reads the same on every width, the way CSS draws it.
 */
function BrandBand({ width, height: h }: { width: number; height: number }) {
  // CSS 150deg: the line runs toward the bottom, a little right; its length is
  // what makes the corners land on the first and last stops.
  const rad = (150 * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const len = Math.abs(width * dx) + Math.abs(h * dy)
  const cx = width / 2
  const cy = h / 2
  const orb = Math.round(width * 0.8)
  return (
    <View pointerEvents="none" style={[s.band, { height: h }]}>
      <Svg width={width} height={h}>
        <Defs>
          <LinearGradient
            id="brandBand"
            gradientUnits="userSpaceOnUse"
            x1={cx - (dx * len) / 2}
            y1={cy - (dy * len) / 2}
            x2={cx + (dx * len) / 2}
            y2={cy + (dy * len) / 2}
          >
            <Stop offset="0" stopColor={color.accentBright} />
            <Stop offset="0.45" stopColor={color.accent} />
            <Stop offset="1" stopColor={color.accentDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={h} fill="url(#brandBand)" />
      </Svg>
      <View
        style={[
          s.orb,
          { width: orb, height: orb, right: -Math.round(orb * 0.31), top: -Math.round(orb * 0.35) },
        ]}
      />
    </View>
  )
}

/** A code screen's title, inside the sheet. */
export const SheetTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.sheetTitle} accessibilityRole="header">{children}</Text>
)
export const SheetSub = ({ children }: { children: React.ReactNode }) => <Text style={s.sheetSub}>{children}</Text>

/**
 * One block of the form: a hairline over every block but the first, a 16 bold
 * sentence-case title, then its fields 12 apart.
 */
export function Section({
  title, sub, first, children,
}: { title: string; sub?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <View style={!first && s.sectionNext}>
      {!first && <View style={s.rule} />}
      <Text style={[s.sectionTitle, !first && s.sectionTitleNext]} accessibilityRole="header">{title}</Text>
      {!!sub && <Text style={s.sectionSub}>{sub}</Text>}
      {children}
    </View>
  )
}

/** A soft violet box with a bold lead-in — "Tip", "What happens next?". */
export function Tip({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={s.tip}>
      <Text style={s.tipText}>
        {!!title && <Text style={s.tipStrong}>{title} </Text>}
        {children}
      </Text>
    </View>
  )
}

/** The green "Confirmed" pill. */
export function Pill({ label, icon = 'check' }: { label: string; icon?: IconName }) {
  return (
    <View style={s.pillOk}>
      <Icon name={icon} size={space.md} tint={color.success} weight={2.4} />
      <Text style={s.pillOkText}>{label}</Text>
    </View>
  )
}

/** The 12.5 medium line under a code row — "Resend code in 0:24", "4 of 5 sends left this hour". */
export const Meta = ({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'warning' }) => (
  <Text style={[s.meta, tone === 'danger' && s.metaDanger, tone === 'warning' && s.metaWarning]}>{children}</Text>
)
export const MetaRow = ({ children }: { children: React.ReactNode }) => <View style={s.metaRow}>{children}</View>

/** "Resend code in 0:24", then a "Resend code" action once the wait is over. */
export function ResendAction({
  seconds, onResend, busy, wait = 'Resend code in', action = 'Resend code',
}: { seconds: number; onResend: () => void; busy?: boolean; wait?: string; action?: string }) {
  if (busy) return <Meta>Sending…</Meta>
  if (seconds > 0) return <Meta>{wait} {clock(seconds)}</Meta>
  return (
    <Text style={[s.meta, s.metaAction]} onPress={onResend} suppressHighlighting accessibilityRole="button">
      {action}
    </Text>
  )
}

// ── Header (the older auth screens) ──────────────────────────────────────────

/** Back circle on the left, the mark and wordmark on the right. */
export function AuthTop({ onBack, brand = true }: { onBack?: () => void; brand?: boolean }) {
  return (
    <View style={s.top}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={space.sm}
          style={({ pressed }) => [s.back, pressed && s.pressed]}
        >
          <Icon name="arrowL" size={spaceHalf['4.5'] + space.xs} tint={color.text} />
        </Pressable>
      ) : (
        <View style={s.back} />
      )}
      {brand && (
        <View style={s.brand}>
          <View style={s.brandMark}>
            <LogoMark size={space.lg} fill={color.textInverse} />
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

/** Label (with "Optional" or a hint on its right), the control, then the error (red) or the helper (grey). */
export function AField({
  label, optional, hint, right, error, helper, anchorRef, style, children,
}: {
  label: string
  optional?: boolean
  /** Muted words on the label row's right — "People on the payroll", "142 / 2000". */
  hint?: string
  /** Sits on the label row's right edge — "Forgot?". */
  right?: React.ReactNode
  error?: string | null
  helper?: string | null
  /** The field's block, for scroll-to-first-error (useFieldFocus().anchor). */
  anchorRef?: React.Ref<ViewRef>
  style?: ViewStyle
  children: React.ReactNode
}) {
  const side = optional ? 'Optional' : hint
  return (
    <View ref={anchorRef} collapsable={false} style={[s.field, style]}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {!!side && <Text style={s.labelHint}>{side}</Text>}
        {right}
      </View>
      {children}
      {error ? <Text style={s.err}>{error}</Text> : helper ? <Text style={s.help}>{helper}</Text> : null}
    </View>
  )
}

/** Two fields on one line — "Your name" beside "Designation", "Years" beside "LinkedIn". */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={s.fieldRow}>{children}</View>
}

type InputProps = Omit<TextInputProps, 'style'> & {
  invalid?: boolean
  inputRef?: React.Ref<TI>
  /** The leading glyph — user, mail, pin, building, link, brief, lock. */
  icon?: IconName
  /** Fixed content before the text — "+91". */
  prefix?: string
  trailing?: React.ReactNode
  /** A multi-line box, 96 tall. */
  area?: boolean
}

/** The 48-high shell. Focus turns the edge violet, an error turns it red. */
export function AInput({
  invalid, inputRef, icon, prefix, trailing, area, onFocus, onBlur, editable, ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View
      style={[
        s.box,
        area && s.boxArea,
        focused && s.boxFocus,
        invalid && s.boxInvalid,
        editable === false && s.boxOff,
      ]}
    >
      {!!icon && <Icon name={icon} size={GLYPH} tint={color.textSubtle} />}
      {!!prefix && <Text style={s.prefix}>{prefix}</Text>}
      <TextInput
        ref={inputRef}
        placeholderTextColor={color.textSubtle}
        style={[s.input, area && s.inputArea]}
        editable={editable}
        multiline={area}
        textAlignVertical={area ? 'top' : 'center'}
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
        <Pressable onPress={onToggle} hitSlop={space.sm} accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'}>
          <Text style={s.eye}>{shown ? 'Hide' : 'Show'}</Text>
        </Pressable>
      }
    />
  )
}

/** A select: the shell shows the choice, a bottom sheet lists the options. */
export function ASelect({
  value, placeholder = 'Select', options, title, icon, invalid, onChange, onOpen, empty,
}: {
  value: string
  placeholder?: string
  options: readonly { value: string; label: string; hint?: string }[]
  title: string
  icon?: IconName
  invalid?: boolean
  onChange: (value: string) => void
  /** Called as the sheet opens — a place to refetch a list that has not arrived. */
  onOpen?: () => void
  /** Shown instead of the list when there are no options yet. */
  empty?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { height: screenH } = useWindowDimensions()
  const current = options.find((o) => o.value === value)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${current?.label ?? placeholder}`}
        onPress={() => { onOpen?.(); setOpen(true) }}
        style={({ pressed }) => [s.box, open && s.boxFocus, invalid && s.boxInvalid, pressed && s.pressed]}
      >
        {!!icon && <Icon name={icon} size={GLYPH} tint={color.textSubtle} />}
        <Text numberOfLines={1} style={[s.selectText, !current && s.placeholder]}>{current?.label ?? placeholder}</Text>
        {!!current?.hint && <Text style={s.selectHint}>{current.hint}</Text>}
        <Icon name="chevD" size={GLYPH} tint={color.textSubtle} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {options.length ? (
          <ScrollView style={{ maxHeight: Math.round(screenH * 0.5) }}>
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
                  {on && <Icon name="check" size={space.xl} tint={color.accent} weight={2.4} />}
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

/** Two-up selectable tiles — the highest qualification, each with its price and length when known. */
export function ATiles({
  options, value, onChange, invalid,
}: {
  options: readonly { value: string; title: string; sub?: string }[]
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const rows: (typeof options[number])[][] = []
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2))
  return (
    <View style={s.tiles}>
      {rows.map((row) => (
        <View key={row.map((o) => o.value).join('|')} style={s.tileRow}>
          {row.map((o) => {
            const on = o.value === value
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={o.sub ? `${o.title}, ${o.sub}` : o.title}
                onPress={() => onChange(o.value)}
                style={({ pressed }) => [s.tile, on && s.tileOn, invalid && !on && s.boxInvalid, pressed && s.pressed]}
              >
                <Text style={s.tileTitle} numberOfLines={1}>{o.title}</Text>
                {!!o.sub && <Text style={s.tileSub}>{o.sub}</Text>}
              </Pressable>
            )
          })}
          {row.length === 1 && <View style={s.tileGhost} />}
        </View>
      ))}
    </View>
  )
}

/** Pill chips that toggle. A chosen one is violet with a tick. */
export function AChips({
  options, selected, onToggle, invalid, single,
}: {
  options: readonly { value: string; label: string }[]
  selected: readonly string[]
  onToggle: (value: string) => void
  invalid?: boolean
  /** One choice only — read as radios. */
  single?: boolean
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <Pressable
            key={o.value}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(o.value)}
            style={({ pressed }) => [s.chip, on && s.chipOn, invalid && !on && s.chipInvalid, pressed && s.pressed]}
          >
            {on && <Icon name="check" size={space.md + space['2xs']} tint={color.accentText} weight={2.4} />}
            <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * How strong a password reads — pure feedback, it never blocks. Under the
 * minimum it is "Too short" whatever it contains.
 */
export function strengthOf(value: string, min: number): { level: 0 | 1 | 2 | 3 | 4; word: string | null } {
  if (!value) return { level: 0, word: null }
  if (value.length < min) return { level: 1, word: 'Too short' }
  let n = 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) n++
  if (/\d/.test(value)) n++
  if (/[^A-Za-z0-9]/.test(value)) n++
  const level = Math.min(4, n) as 1 | 2 | 3 | 4
  return { level, word: ['Weak', 'Fair', 'Good', 'Strong'][level - 1] }
}

/** "Good — at least 8 characters", or the rule alone before anything is typed. */
export function strengthHelper(value: string, min: number) {
  const { word } = strengthOf(value, min)
  return word ? `${word} — at least ${min} characters` : `At least ${min} characters`
}

/** Four bars that fill with the password's strength. */
export function StrengthMeter({ value, min }: { value: string; min: number }) {
  const { level } = strengthOf(value, min)
  const fill = [color.dangerFill, color.warningFill, color.successFill, color.successFill][Math.max(0, level - 1)]
  return (
    <View style={s.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.bar, level >= i && { backgroundColor: fill }]} />
      ))}
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
        {on && <Icon name="check" size={space.md + space['2xs']} tint={color.textInverse} weight={3} />}
      </View>
      <Text style={s.checkText}>{children}</Text>
    </Pressable>
  )
}

/** The terms line, with the Terms of Service and the Privacy Policy opening the public pages. */
export function TermsCheck({
  on, error, onToggle, anchorRef,
}: { on: boolean; error?: string | null; onToggle: () => void; anchorRef?: React.Ref<ViewRef> }) {
  return (
    <View ref={anchorRef} collapsable={false}>
      <CheckRow on={on} invalid={!!error} onToggle={onToggle}>
        I agree to the <Link onPress={() => openLegal('terms')}>Terms of Service</Link> and{' '}
        <Link onPress={() => openLegal('privacy')}>Privacy Policy</Link>
      </CheckRow>
      {!!error && <Text style={s.err}>{error}</Text>}
    </View>
  )
}

export const Link = ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
  <Text style={s.link} onPress={onPress} suppressHighlighting>{children}</Text>
)

/** The CV tile — dashed, an upload glyph, what to choose and what is accepted. */
export function DropTile({
  title, sub, onPress, disabled, glyph = 'upload', trailing,
}: {
  title: string
  sub?: string
  onPress?: () => void
  disabled?: boolean
  glyph?: IconName
  trailing?: React.ReactNode
}) {
  const body = (
    <>
      <Icon name={glyph} size={spaceHalf['4.5'] + space.xs} tint={color.accent} />
      <View style={s.grow}>
        <Text style={s.dropTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={s.help}>{sub}</Text>}
      </View>
      {trailing}
    </>
  )
  if (!onPress) return <View style={[s.drop, s.dropFilled]}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.drop, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  )
}

// ── Actions ──────────────────────────────────────────────────────────────────

export function AButton({
  label, variant = 'primary', onPress, busy, disabled, icon, style,
}: {
  label: string
  variant?: 'primary' | 'outline'
  onPress?: () => void
  busy?: boolean
  /** Unavailable — dimmed and inert. Use sparingly: the forms validate on tap instead. */
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

/** The real four-colour G — Google's own brand colours, which no theme token carries. */
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

/** The older screens' pinned footer — a primary action and, below it, the swap line. */
export function BottomBar({
  insetBottom, children,
}: { insetBottom: number; children: React.ReactNode }) {
  return <View style={[s.barWrap, { paddingBottom: space.md + insetBottom }]}>{children}</View>
}
export function Swap({ lead, action, onPress }: { lead: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={space.sm} accessibilityRole="button" style={s.swap}>
      <Text style={s.swapText}>{lead} <Text style={s.swapAction}>{action}</Text></Text>
    </Pressable>
  )
}

export function Fine({ children }: { children: React.ReactNode }) {
  return <Text style={s.fine}>{children}</Text>
}

// ── OTP ──────────────────────────────────────────────────────────────────────

/** One box per digit; they advance as you type and step back on delete. `value` is the joined code. */
export function OtpBoxes({
  value, onChange, invalid, done, length, autoFocus, firstRef, editable = true,
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  /** Confirmed — the cells turn green and stop taking input. */
  done?: boolean
  length: number
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
          editable={editable && !done}
          value={value[i]?.trim() ?? ''}
          onChangeText={(d) => set(i, d)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !(value[i]?.trim()) && i > 0) refs.current[i - 1]?.focus()
          }}
          onFocus={() => setFocus(i)}
          onBlur={() => setFocus((f) => (f === i ? null : f))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          maxLength={i === 0 ? length : 1}
          selectTextOnFocus
          autoFocus={autoFocus && i === 0}
          accessibilityLabel={`Digit ${i + 1} of ${length}`}
          style={[
            s.otpBox,
            focus === i && !done && s.boxFocus,
            invalid && s.otpInvalid,
            done && s.otpDone,
          ]}
        />
      ))}
    </View>
  )
}

// ── Scroll to the first error ────────────────────────────────────────────────

/**
 * Scroll-to-first-error for a form whose fields sit inside sections: each
 * field's block registers with `anchor(key)` (and its input with `input(key)`),
 * and `to(key)` measures the block against the scrolled content, scrolls it
 * into view and gives the input the caret. With `keepInView`, a block above
 * (the error summary) stays on screen too when the field is near enough to it.
 */
export function useFieldFocus<K extends string>() {
  const scroller = useRef<ScrollRef>(null)
  const content = useRef<ViewRef>(null)
  const anchors = useRef<Partial<Record<K, ViewRef | null>>>({})
  const inputs = useRef<Partial<Record<K, TI | null>>>({})
  const { height: screenH } = useWindowDimensions()
  const viewport = useRef(screenH)
  viewport.current = screenH

  return useMemo(() => {
    const scrollTo = (y: number) => scroller.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true })
    return {
      scroller,
      content,
      anchor: (key: K) => (node: ViewRef | null) => { anchors.current[key] = node },
      input: (key: K) => (node: TI | null) => { inputs.current[key] = node },
      focusInput: (key: K) => inputs.current[key]?.focus(),
      to: (key: K, keepInView?: ViewRef | null) => {
        const block = anchors.current[key]
        const root = content.current
        if (block && root) {
          block.measureLayout(root, (_x, fieldY) => {
            if (!keepInView) return scrollTo(fieldY)
            keepInView.measureLayout(
              root,
              (_sx, aboveY) => scrollTo(fieldY - aboveY < viewport.current / 2 ? aboveY : fieldY),
              () => scrollTo(fieldY),
            )
          })
        }
        inputs.current[key]?.focus()
      },
      toEnd: () => scroller.current?.scrollToEnd({ animated: true }),
    }
  }, [])
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },
  fill: { flex: 1 },
  grow: { flexGrow: 1, flexShrink: 1, minWidth: 0 },

  // C · the band and the sheet
  // The page is violet so the band never flashes white before it is measured; the sheet and the foot are white.
  brandPage: { flex: 1, backgroundColor: color.accent },
  band: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: color.accent },
  orb: { position: 'absolute', borderRadius: radius.pill, backgroundColor: color.onInkWash },
  brandScroll: { flexGrow: 1 },
  brandContent: { flexGrow: 1 },
  bandBody: { paddingTop: spaceHalf['1.5'], paddingHorizontal: space.xl, paddingBottom: space['2xl'] + space['2xs'] },
  bandBodyBare: { paddingBottom: space['2xl'] - space['2xs'] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  bandBack: {
    width: height['header-avatar'], height: height['header-avatar'], borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.onInkGround, marginRight: space.xs,
  },
  markTile: {
    width: height['brand-mark'], height: height['brand-mark'], borderRadius: radius.ctl,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  markWord: { fontFamily: F.bold, fontSize: fontSize['ui-lg'], letterSpacing: trackingNative['snug-sm'], color: color.textOnInk },
  bandText: { marginTop: spaceHalf['3.5'] },
  bandTitle: {
    fontFamily: F.bold, fontSize: fontSize['display-lead'], lineHeight: leadingNative['display-lead'],
    letterSpacing: trackingNative.tight, color: color.textOnInk,
  },
  bandSub: {
    fontFamily: F.regular, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'],
    color: color.textOnInkSoft, marginTop: spaceHalf['1.5'],
  },
  sheet: {
    flexGrow: 1, marginTop: -spaceHalf['4.5'], backgroundColor: color.surface,
    borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
    paddingTop: space.xl, paddingHorizontal: A.sheetGutter, paddingBottom: spaceHalf['6'],
  },
  sheetTitle: {
    fontFamily: F.bold, fontSize: fontSize['display-lead'], lineHeight: leadingNative['display-lead'],
    letterSpacing: trackingNative.tight, color: color.text,
  },
  sheetSub: {
    fontFamily: F.regular, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'],
    color: color.textMuted, marginTop: spaceHalf['1.5'],
  },
  foot: {
    paddingTop: space.md, paddingHorizontal: A.sheetGutter, gap: spaceHalf['2.5'], backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },

  sectionNext: { marginTop: spaceHalf['3.5'] },
  rule: { height: borderWidth.thin, backgroundColor: color.border },
  sectionTitle: {
    fontFamily: F.bold, fontSize: fontSize['ui-lead'], lineHeight: leadingNative['ui-md'],
    letterSpacing: trackingNative['snug-sm'], color: color.text,
  },
  sectionTitleNext: { marginTop: space.md },
  sectionSub: {
    fontFamily: F.regular, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-xs'],
    color: color.textMuted, marginTop: space['2xs'],
  },

  tip: {
    marginTop: space.lg, backgroundColor: color.accentWash, borderWidth: borderWidth.thin, borderColor: color.accentMuted,
    borderRadius: radius.panel, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'],
  },
  tipText: { fontFamily: F.regular, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textSecondary },
  tipStrong: { fontFamily: F.bold, color: color.text },

  pillOk: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], borderRadius: radius.pill,
    paddingVertical: space.xs, paddingHorizontal: spaceHalf['2.5'], backgroundColor: color.successSoft,
  },
  pillOkText: { fontFamily: F.semi, fontSize: fontSize['meta-md'], color: color.success, fontVariant: ['tabular-nums'] },

  meta: {
    fontFamily: F.medium, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'],
    color: color.textMuted, fontVariant: ['tabular-nums'],
  },
  metaAction: { fontFamily: F.bold, color: color.accentText },
  metaDanger: { color: color.danger },
  metaWarning: { color: color.warning },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, marginTop: space.md },

  // the older header
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm, paddingHorizontal: spaceHalf['3.5'] },
  back: {
    width: height.tap, height: height.tap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: spaceHalf['2.5'] },
  brandMark: {
    width: height['brand-mark'], height: height['brand-mark'], borderRadius: radius.ctl,
    backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center',
  },
  brandWord: { fontFamily: F.bold, fontSize: fontSize['ui-lg'], letterSpacing: trackingNative.snug, color: color.text },

  title: {
    fontFamily: F.bold, fontSize: fontSize['display-form'], lineHeight: leadingNative['display-lead'],
    letterSpacing: trackingNative.tight, color: color.text,
  },
  sub: { fontFamily: F.regular, fontSize: fontSize['ui-lead'], lineHeight: leadingNative['ui-lead'], color: color.textMuted, marginTop: space.sm },

  seg: { flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: radius.panel, padding: space.xs, marginTop: space.lg },
  segBtn: { flex: 1, height: height['control-compact'], borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  segText: { fontFamily: F.semi, fontSize: fontSize['ui-base'], color: color.textMuted },
  segTextOn: { color: color.accent },

  // fields
  field: { marginTop: space.md, gap: spaceHalf['1.5'] },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  label: { flexShrink: 1, fontFamily: F.semi, fontSize: fontSize['ui-md'], color: color.textSecondary },
  labelHint: { fontFamily: F.medium, fontSize: fontSize['ui-sm'], color: color.textSubtle, fontVariant: ['tabular-nums'] },
  err: { fontFamily: F.regular, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.danger },
  help: { fontFamily: F.regular, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },

  box: {
    height: A.control, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: spaceHalf['3.5'],
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.border, borderRadius: A.radius,
  },
  boxArea: { height: height['note-field'] + spaceHalf['6'], alignItems: 'flex-start', paddingTop: space.md },
  boxFocus: { borderColor: color.accent },
  boxInvalid: { borderColor: color.dangerFill },
  boxOff: { backgroundColor: color.surfaceMuted },
  input: {
    flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, paddingHorizontal: 0,
    fontFamily: F.regular, fontSize: fontSize['ui-base'], color: color.text,
  },
  inputArea: { lineHeight: leadingNative['ui-md'], paddingBottom: space.md },
  placeholder: { color: color.textSubtle },
  selectText: { flex: 1, fontFamily: F.regular, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-md'], color: color.text },
  selectHint: { fontFamily: F.semi, fontSize: fontSize['ui-md'], color: color.textMuted },
  prefix: {
    fontFamily: F.semi, fontSize: fontSize['ui-base'], color: color.text, paddingRight: space.sm,
    borderRightWidth: borderWidth.thin, borderRightColor: color.border,
  },
  eye: { fontFamily: F.semi, fontSize: fontSize['ui-sm'], color: color.textSubtle },

  option: {
    minHeight: height['control-lg'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: fontSize['ui-lead'], color: color.text },
  optionHint: { fontFamily: F.semi, fontSize: fontSize['ui-md'], color: color.textMuted, marginRight: spaceHalf['2.5'] },
  optionOn: { fontFamily: F.semi, color: color.accent },

  tiles: { gap: space.sm },
  tileRow: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1, minWidth: 0, gap: space['2xs'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.border, borderRadius: radius.panel,
  },
  tileOn: { borderColor: color.accent, backgroundColor: color.accentWash },
  tileGhost: { flex: 1 },
  tileTitle: { fontFamily: F.semi, fontSize: fontSize['ui-md'], color: color.text },
  tileSub: { fontFamily: F.medium, fontSize: fontSize['meta-md'], color: color.textMuted, fontVariant: ['tabular-nums'] },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  chip: {
    height: height.chip, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface,
  },
  chipOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
  chipInvalid: { borderColor: color.dangerBorder },
  chipText: { fontFamily: F.semi, fontSize: fontSize['ui-sm'], color: color.textSecondary, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: color.accentText },

  meter: { flexDirection: 'row', gap: space.xs, marginTop: space['2xs'] },
  bar: { flex: 1, height: height['step-bar'], borderRadius: radius.pill, backgroundColor: color.surfaceSunken },

  check: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'], marginTop: space.md },
  checkBox: {
    width: height.radio, height: height.radio, borderRadius: radius.sm, borderWidth: borderWidth.accent, borderColor: color.borderStrong,
    backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: color.accent, borderColor: color.accent },
  checkText: { flex: 1, fontFamily: F.regular, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textSecondary },
  link: { fontFamily: F.semi, color: color.accentText },

  drop: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: spaceHalf['3.5'], backgroundColor: color.surface,
    borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.panel,
  },
  dropFilled: { borderStyle: 'solid', borderColor: color.border },
  dropTitle: { fontFamily: F.semi, fontSize: fontSize['ui-md'], color: color.text },

  btn: {
    height: height['control-cta'], borderRadius: radius.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.sm,
  },
  btnPrimary: { backgroundColor: color.accent },
  btnOutline: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  btnText: { fontFamily: F.bold, fontSize: fontSize['ui-lead'], color: color.text },
  btnTextPrimary: { color: color.textInverse },
  googleGap: { marginTop: space.md },

  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl, marginBottom: space.xs },
  orRule: { flex: 1, height: borderWidth.thin, backgroundColor: color.border },
  orText: { fontFamily: F.regular, fontSize: fontSize['ui-md'], color: color.textSubtle },

  note: { marginTop: spaceHalf['4.5'], backgroundColor: color.accentSoft, borderRadius: radius.panel, padding: spaceHalf['3.5'] },
  noteText: { fontFamily: F.regular, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textSecondary },
  noteStrong: { fontFamily: F.semi, color: color.accentDeep },

  barWrap: {
    paddingTop: space.md, paddingHorizontal: A.gutter, gap: spaceHalf['2.5'], backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },
  swap: { alignItems: 'center', justifyContent: 'center', minHeight: height.chip },
  swapText: { fontFamily: F.regular, fontSize: fontSize['ui-md'], color: color.textMuted, textAlign: 'center' },
  swapAction: { fontFamily: F.bold, color: color.accentText },
  fine: {
    fontFamily: F.regular, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textSubtle,
    textAlign: 'center', marginTop: space.lg,
  },

  otp: { flexDirection: 'row', gap: space.sm },
  otpBox: {
    flex: 1, minWidth: 0, height: height['otp-cell-mobile'], borderRadius: radius.tile, borderWidth: borderWidth.medium,
    borderColor: color.borderStrong, backgroundColor: color.surface, textAlign: 'center',
    fontFamily: fontFamilyNative.monoSemiBold, fontSize: fontSize['meta-otp'], fontVariant: ['tabular-nums'], color: color.text,
    paddingVertical: 0, paddingHorizontal: 0,
  },
  otpInvalid: { borderColor: color.dangerFill, backgroundColor: color.dangerGround },
  otpDone: { borderColor: color.successFill, backgroundColor: color.successSoft, color: color.success },
})
