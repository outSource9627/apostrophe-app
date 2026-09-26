import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon, type IconName } from '../ui/Icon'

/**
 * The Employer Android design's building blocks (`gen/a1.js` A.* and `gen/h.js`
 * H.*), once, so every employer screen draws the same bar, card, badge, sheet
 * and state. Tokens only.
 */

// ── badges (H.b) ─────────────────────────────────────────────────────────────
export type EmTone = 'green' | 'violet' | 'amber' | 'red' | 'gray' | 'dark'
export const EM_TONE: Record<EmTone, { bg: string; fg: string }> = {
  green: { bg: color.successSoft, fg: color.success },
  violet: { bg: color.accentSoft, fg: color.accentText },
  amber: { bg: color.warningSoft, fg: color.warning },
  red: { bg: color.dangerSoft, fg: color.danger },
  gray: { bg: color.surfaceMuted, fg: color.textSecondary },
  dark: { bg: color.ink, fg: color.textInverse },
}

/** A mono status pill with an optional leading icon: `VERIFIED EMPLOYER`, `IN REVIEW`. */
export function EmBadge({ label, tone = 'gray', icon, small }: { label: string; tone?: EmTone; icon?: IconName; small?: boolean }) {
  const t = EM_TONE[tone]
  return (
    <View style={[styles.badge, small && styles.badgeSm, { backgroundColor: t.bg }]}>
      {!!icon && <Icon name={icon} size={small ? space.md - 1 : space.md} tint={t.fg} weight={2.2} />}
      <Text style={[small ? text.metaXs : text.metaSm, styles.badgeText, { color: t.fg }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  )
}

/** Mono caps label (H.mono). */
export function EmMono({ children, tone = 'muted', style }: { children: React.ReactNode; tone?: 'muted' | 'subtle' | 'accent' | 'green' | 'red'; style?: object }) {
  const c = { muted: color.textMuted, subtle: color.textSubtle, accent: color.accentText, green: color.success, red: color.danger }[tone]
  return <Text style={[text.metaSm, styles.mono, { color: c }, style]}>{children}</Text>
}

// ── header (A.bar, A.avBtn, A.bellBtn, H.ibtn) ───────────────────────────────
export function EmIconButton({
  name, onPress, label, size = height.tap, iconSize = space.xl, tint = color.text, bordered, disabled,
}: {
  name: IconName; onPress?: () => void; label: string; size?: number; iconSize?: number; tint?: string; bordered?: 'soft' | 'strong' | 'danger'; disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size < height.tap ? (height.tap - size) / 2 : undefined}
      style={({ pressed }) => [
        styles.ibtn,
        { width: size, height: size },
        bordered === 'soft' && styles.ibtnSoft,
        bordered === 'strong' && styles.ibtnStrong,
        bordered === 'danger' && styles.ibtnDanger,
        pressed && styles.pressed,
        disabled && { opacity: opacity.disabled },
      ]}
    >
      <Icon name={name} size={iconSize} tint={tint} />
    </Pressable>
  )
}

/** The company-initials square that opens Account. */
export function EmAvatarButton({ initials, onPress }: { initials: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={onPress} hitSlop={space.xs} style={({ pressed }) => [styles.avBtn, pressed && styles.pressed]}>
      <Text style={[text.metaMd, styles.avText]}>{initials}</Text>
    </Pressable>
  )
}

/** The bell with an unread dot; opens Notifications. */
export function EmBell({ unread, onPress }: { unread?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unread ? 'Notifications, unread' : 'Notifications'} onPress={onPress} style={({ pressed }) => [styles.ibtn, styles.bell, pressed && styles.pressed]}>
      <Icon name="bell" size={space.xl + 1} tint={color.textSecondary} />
      {unread && <View style={styles.bellDot} />}
    </Pressable>
  )
}

/**
 * The screen bar: a 44 back arrow (drill-ins), the title (26 on a top-level
 * screen, 18 on a drill-in), a mono line under it, and a right slot.
 */
export function EmBar({
  title, sub, big, onBack, right, border,
}: { title?: string; sub?: string; big?: boolean; onBack?: () => void; right?: React.ReactNode; border?: boolean }) {
  return (
    <View style={[styles.bar, { paddingLeft: onBack ? space.xs : spaceHalf['4.5'], paddingRight: right ? space.sm : space.lg }, border && styles.barBorder]}>
      {!!onBack && <EmIconButton name="arrowL" label="Back" iconSize={height.glyph - 2} onPress={onBack} />}
      <View style={styles.barTitle}>
        {!!title && <Text style={big ? text.displayMd : text.displayXs} numberOfLines={1}>{title}</Text>}
        {!!sub && <EmMono>{sub}</EmMono>}
      </View>
      {right}
    </View>
  )
}

/** The auth / section title (a2.js h1): mono eyebrow, 32 title, a muted sentence. */
export function EmTitle({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: string }) {
  return (
    <View style={styles.h1} accessibilityRole="header">
      {!!eyebrow && <Text style={[text.metaMd, styles.mono, styles.muted]}>{eyebrow.toUpperCase()}</Text>}
      <Text style={text.displayPage}>{title}</Text>
      {!!sub && <Text style={[text.uiBase, styles.muted]}>{sub}</Text>}
    </View>
  )
}

// ── surfaces (A.row, A.foot, A.tabsRow) ──────────────────────────────────────
/** The white card with the hairline and the 16 corner (A.row). */
export function EmCard({ style, children, tone, ...rest }: ViewProps & { tone?: 'danger' | 'accent' }) {
  return (
    <View style={[styles.card, tone === 'danger' && styles.cardDanger, tone === 'accent' && styles.cardAccent, style]} {...rest}>
      {children}
    </View>
  )
}

/** The reviewer's words (EM-06b/06c): a tinted well with a mono label over the sentence. */
export function EmWell({ label, tone, children }: { label: string; tone: 'violet' | 'red'; children: React.ReactNode }) {
  return (
    <View style={[styles.well, tone === 'red' ? styles.wellRed : styles.wellViolet]}>
      <EmMono tone={tone === 'red' ? 'red' : 'accent'}>{label.toUpperCase()}</EmMono>
      <Text style={text.uiMd}>{children}</Text>
    </View>
  )
}

/** The sticky action band at the foot of a screen (A.foot). */
export function EmFoot({ children, inset = true, stack }: { children: React.ReactNode; inset?: boolean; stack?: boolean }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.foot, stack && styles.footStack, { paddingBottom: space.md + (inset ? insets.bottom : 0) }]}>{children}</View>
  )
}

/** The pill tabs under a bar (A.tabsRow): ink when on, a mono count after the label. */
export function EmPills<T extends string>({
  items, value, onChange,
}: { items: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pills}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={({ pressed }) => [styles.pill, on ? styles.pillOn : styles.pillOff, pressed && styles.pressed]}
          >
            <Text style={[on ? text.uiSmSemi : text.uiSmMedium, { color: on ? color.textInverse : color.textSecondary }]}>{it.label}</Text>
            {it.count !== undefined && <Text style={[text.metaSm, { color: on ? color.textInverse : color.textSecondary }]}>{it.count}</Text>}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** A choice chip (H.chip): ink when on, sunken when off. */
export function EmChip({ label, on, onPress, compact }: { label: string; on: boolean; onPress?: () => void; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, compact && styles.chipCompact, on ? styles.pillOn : styles.pillOff, pressed && styles.pressed]}
    >
      <Text style={[on ? text.uiSmSemi : text.uiSmMedium, { color: on ? color.textInverse : color.textSecondary }]}>{label}</Text>
    </Pressable>
  )
}

/** A form label (W.lbl): 13/600 with an optional hint on the right. */
export function EmLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.label}>
      <Text style={[text.uiSmSemi, styles.secondary]}>{children}</Text>
      {!!hint && <Text style={[text.uiXs, styles.subtle]}>{hint}</Text>}
    </View>
  )
}

/** One choice of a radio list (W.radioRow): the ring, the label; violet when chosen. */
export function EmRadioRow({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.radio, on ? styles.radioOn : styles.radioOff, pressed && styles.pressed]}
    >
      <View style={[styles.ring, on ? styles.ringOn : styles.ringOff]} />
      <Text style={[text.uiMdMedium, styles.grow]} numberOfLines={2}>{label}</Text>
    </Pressable>
  )
}

// ── states (H.empty, H.err, A.done, H.steps) ─────────────────────────────────
export function EmEmpty({ icon = 'grid', title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}><Icon name={icon} size={height.glyph + 2} tint={color.textSubtle} /></View>
      <Text style={[text.displaySm, styles.center]}>{title}</Text>
      {!!body && <Text style={[text.uiMd, styles.muted, styles.center]}>{body}</Text>}
      {action}
    </View>
  )
}

export function EmError({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.error}>
      <View style={styles.errorMark}><Icon name="alert" size={height.glyph} tint={color.danger} weight={2} /></View>
      <Text style={[text.displaySm, styles.center]}>{title}</Text>
      {!!body && <Text style={[text.uiMd, styles.muted, styles.center]}>{body}</Text>}
      {action}
    </View>
  )
}

/** The outcome panel inside a sheet (A.done): a round mark, a title, a line and the actions. */
export function EmDone({ icon, tone, title, body, actions }: { icon: IconName; tone: EmTone; title: string; body?: string; actions: React.ReactNode }) {
  const t = EM_TONE[tone]
  return (
    <View style={styles.done}>
      <View style={[styles.doneMark, { backgroundColor: t.bg }]}><Icon name={icon} size={height.glyph + 4} tint={t.fg} weight={2.6} /></View>
      <Text style={[text.displaySm, styles.center]}>{title}</Text>
      {!!body && <Text style={[text.uiMd, styles.muted, styles.center]}>{body}</Text>}
      <View style={styles.doneActions}>{actions}</View>
    </View>
  )
}

export type StepState = 'done' | 'now' | 'bad' | 'todo'
/** The vertical timeline (H.steps). */
export function EmSteps({ steps }: { steps: { title: string; sub?: string; state: StepState }[] }) {
  return (
    <View>
      {steps.map((st, i) => (
        <View key={`${st.title}-${i}`} style={styles.step}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, st.state === 'done' && styles.stepDone, st.state === 'now' && styles.stepNow, st.state === 'bad' && styles.stepBad, st.state === 'todo' && styles.stepTodo]}>
              {st.state === 'done' && <Icon name="check" size={space.md + 2} tint={color.textInverse} weight={3} />}
              {st.state === 'now' && <View style={styles.stepNowCore} />}
              {st.state === 'bad' && <Icon name="x" size={space.md + 1} tint={color.textInverse} weight={3} />}
            </View>
            {i < steps.length - 1 && <View style={[styles.stepLine, { backgroundColor: st.state === 'done' ? color.successFill : color.border }]} />}
          </View>
          <View style={[styles.stepText, i < steps.length - 1 && styles.stepGap]}>
            <Text style={[text.uiBaseSemi, st.state === 'todo' && styles.subtle]}>{st.title}</Text>
            {!!st.sub && <Text style={[text.uiSm, styles.muted]}>{st.sub}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

// ── overlays (A.sheet, A.sh, A.dialog) ───────────────────────────────────────
/**
 * The bottom sheet: scrim, 24 top corners, the grab handle, a title row with a
 * close button, a scrolling body and an optional pinned foot.
 */
export function EmSheet({
  open, onClose, title, sub, children, foot, tall, scroll = true,
}: {
  open: boolean; onClose: () => void; title?: string; sub?: string; children: React.ReactNode; foot?: React.ReactNode; tall?: boolean; scroll?: boolean
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, tall && styles.sheetTall]}>
          <Pressable onPress={onClose} style={styles.handleArea}><View style={styles.handle} /></Pressable>
          {!!title && (
            <View style={styles.sheetHead}>
              <View style={styles.grow}>
                <Text style={text.displayCard}>{title}</Text>
                {!!sub && <Text style={[text.uiSm, styles.muted]}>{sub}</Text>}
              </View>
              <EmIconButton name="x" label="Close" size={height.avatar + 4} iconSize={space.lg + 2} onPress={onClose} />
            </View>
          )}
          {scroll ? (
            <ScrollView style={tall ? styles.grow : undefined} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          ) : children}
          {foot ?? <View style={{ height: insets.bottom }} />}
        </View>
      </View>
    </Modal>
  )
}

/** A centred confirmation (A.dialog). */
export function EmDialog({ open, onClose, title, body, children, actions }: { open: boolean; onClose: () => void; title: string; body?: string; children?: React.ReactNode; actions: React.ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.dialogWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrimDark} />
        <View style={styles.dialog}>
          <Text style={text.displayCard}>{title}</Text>
          {!!body && <Text style={[text.uiMd, styles.muted]}>{body}</Text>}
          {children}
          <View style={styles.dialogActions}>{actions}</View>
        </View>
      </View>
    </Modal>
  )
}

/** A person's initials disc (H.av) in the accent gradient's base. */
export function EmPerson({ initials, size = height.tap, muted }: { initials: string; size?: number; muted?: boolean }) {
  return (
    <View style={[styles.person, { width: size, height: size, backgroundColor: muted ? color.border : color.accentBright }]}>
      <Text style={[size >= height.control ? text.uiBaseSemi : text.uiSmSemi, { color: muted ? color.textMuted : color.textInverse }]}>{initials}</Text>
    </View>
  )
}

export const initialsOf = (name?: string | null) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

const styles = StyleSheet.create({
  grow: { flex: 1 },
  h1: { gap: space.sm },
  center: { textAlign: 'center' },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  pressed: { opacity: opacity.pressed },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  radio: { minHeight: height.tap + space.xs, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.tile },
  radioOn: { borderWidth: borderWidth.medium, borderColor: color.accent, backgroundColor: color.accentWash },
  radioOff: { borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface },
  ring: { width: spaceHalf['4.5'], height: spaceHalf['4.5'], borderRadius: radius.pill },
  ringOn: { borderWidth: spaceHalf['1.5'], borderColor: color.accent },
  ringOff: { borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  mono: { letterSpacing: trackingNative.eyebrow },

  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spaceHalf['1.5'], height: space.xl + space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill },
  badgeSm: { height: space.xl + space['2xs'], gap: space.xs, paddingHorizontal: space.sm },
  badgeText: { letterSpacing: trackingNative.meta },

  ibtn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  ibtnSoft: { borderWidth: borderWidth.thin, borderColor: color.border },
  ibtnStrong: { borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  ibtnDanger: { borderWidth: borderWidth.thin, borderColor: color.dangerBorder },
  avBtn: { width: height['header-avatar'], height: height['header-avatar'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
  avText: { color: color.textSecondary },
  bell: { width: height.tap, height: height.tap },
  bellDot: { position: 'absolute', top: spaceHalf['2.5'] + 1, right: space.md, width: space.sm + space['2xs'], height: space.sm + space['2xs'], borderRadius: radius.pill, backgroundColor: color.accent, borderWidth: borderWidth.accent, borderColor: color.background },

  bar: { minHeight: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.xs },
  barBorder: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border, backgroundColor: color.surface },
  barTitle: { flex: 1, minWidth: 0, gap: space['2xs'] },

  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.lg, padding: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  cardDanger: { borderColor: color.dangerBorder },
  cardAccent: { borderColor: color.accentMuted, backgroundColor: color.accentWash },
  well: { borderRadius: radius.panel, borderWidth: borderWidth.thin, padding: spaceHalf['3.5'], gap: spaceHalf['1.5'] },
  wellViolet: { backgroundColor: color.accentWash, borderColor: color.accentEdge },
  wellRed: { backgroundColor: color.dangerGround, borderColor: color.dangerBorder },

  foot: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  footStack: { flexDirection: 'column', alignItems: 'stretch' },

  pillsScroll: { flexGrow: 0 },
  pills: { gap: spaceHalf['1.5'], paddingHorizontal: space.lg, paddingBottom: space.md },
  pill: { height: height['chip-sm'] + spaceHalf['1.5'], paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  pillOn: { backgroundColor: color.ink },
  pillOff: { backgroundColor: color.surfaceMuted },
  chip: { height: height.chip + space['2xs'], paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chipCompact: { height: height.chip },

  empty: { borderRadius: radius.xl, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space['2xl'], paddingHorizontal: spaceHalf['4.5'], alignItems: 'center', gap: spaceHalf['3.5'] },
  emptyMark: { width: height.fab + space.sm, height: height.fab + space.sm, borderRadius: radius.lg, borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  error: { borderRadius: radius.xl, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, paddingVertical: space['3xl'], paddingHorizontal: space.xl, alignItems: 'center', gap: space.md },
  errorMark: { width: height.fab, height: height.fab, borderRadius: radius.pill, backgroundColor: color.dangerSoft, alignItems: 'center', justifyContent: 'center' },

  done: { paddingTop: spaceHalf['4.5'], paddingHorizontal: spaceHalf['6'], paddingBottom: space.xl, alignItems: 'center', gap: space.md },
  doneMark: { width: height.fab + space.xs, height: height.fab + space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  doneActions: { flexDirection: 'row', gap: spaceHalf['2.5'], alignSelf: 'stretch', marginTop: spaceHalf['1.5'] },

  step: { flexDirection: 'row', gap: spaceHalf['3.5'] },
  stepRail: { alignItems: 'center' },
  stepDot: { width: height.radio + 4, height: height.radio + 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: color.successFill },
  stepNow: { backgroundColor: color.surface, borderWidth: borderWidth.accent, borderColor: color.accent },
  stepNowCore: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.accent },
  stepBad: { backgroundColor: color.dangerFill },
  stepTodo: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  stepLine: { width: borderWidth.accent, flex: 1, minHeight: height.radio },
  stepText: { flex: 1, gap: space['2xs'] + 1 },
  stepGap: { paddingBottom: spaceHalf['4.5'] },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  scrimDark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, overflow: 'hidden', maxHeight: '94%' },
  sheetTall: { height: '92%' },
  handleArea: { height: space['2xl'] - 2, alignItems: 'center', justifyContent: 'center' },
  handle: { width: space['3xl'], height: space.xs, borderRadius: radius.pill, backgroundColor: color.borderStrong },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.md },
  sheetBody: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg },

  dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spaceHalf['6'] },
  dialog: { alignSelf: 'stretch', backgroundColor: color.surface, borderRadius: radius.frame, padding: spaceHalf['6'], gap: spaceHalf['3.5'] },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },

  person: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
})
