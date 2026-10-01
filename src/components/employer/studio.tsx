import React from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon, type IconName } from '../ui/Icon'
import { nameInitials } from '../../lib/employer/candidateFormat'

/**
 * The Studio direction's shared pieces (docs/employer-app-studio.html — the
 * employer screens the design chose: Home, Feed, Profile, Shortlist, Interests,
 * Jobs). One card, one count tile, one meter, one film still, one note well,
 * one empty state, so every employer screen draws them the same. Tokens only.
 */

/** The date eyebrow and the big greeting over Home (H1, H3). */
export function StudioGreeting({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={styles.greet} accessibilityRole="header">
      {!!eyebrow && <Text style={[text.metaSm, styles.mono, styles.muted]}>{eyebrow.toUpperCase()}</Text>}
      <Text style={text.displayPage}>{title}</Text>
    </View>
  )
}

/** The Studio card: white, the hairline, an 18 corner. `lift` adds the card shadow. */
export function StudioCard({ children, style, lift, tone }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; lift?: boolean; tone?: 'success' | 'accent' }) {
  return (
    <View style={[styles.card, lift && styles.lift, tone === 'success' && styles.cardSuccess, tone === 'accent' && styles.cardAccent, style]}>
      {children}
    </View>
  )
}

/** A mono caps label with an optional right-hand link (“See all”). */
export function StudioLabel({ children, action, onAction, style }: { children: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[styles.labelRow, style]}>
      <Text style={[text.metaSm, styles.mono, styles.muted]}>{children.toUpperCase()}</Text>
      {!!action && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={space.sm}>
          <Text style={[text.uiSmSemi, styles.accent]}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

/** One of Home's counts: the icon, the number, the mono label and a sub-line. A failed read shows “—”. */
export function CountCard({
  icon, value, label, sub, onPress,
}: { icon: IconName; value: React.ReactNode; label: string; sub?: string | null; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.count, pressed && styles.pressed]}
    >
      <View style={styles.countTop}>
        <Icon name={icon} size={space.lg + 3} tint={color.accent} />
        <Icon name="chevR" size={space.lg - 1} tint={color.textSubtle} />
      </View>
      <View style={styles.countBody}>
        <Text style={[text.displayMd, styles.tnum]}>{value}</Text>
        <Text style={[text.metaXs, styles.mono, styles.muted]} numberOfLines={1}>{label.toUpperCase()}</Text>
        {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
      </View>
    </Pressable>
  )
}

/** “Candidate cards · 28 of 40 left” with a bar that fills as the day is used. */
export function Meter({ label, left, limit, tone = 'accent' }: { label: string; left: number; limit: number; tone?: 'accent' | 'ink' }) {
  const used = limit > 0 ? Math.min(1, Math.max(0, (limit - left) / limit)) : 0
  return (
    <View style={styles.meter} accessibilityLabel={`${label}: ${left} of ${limit} left`}>
      <View style={styles.meterRow}>
        <Text style={[text.uiSm, styles.secondary]}>{label}</Text>
        <Text style={text.uiSmSemi}>
          {left}
          <Text style={[text.uiSm, styles.muted]}>{` of ${limit} left`}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${used * 100}%`, backgroundColor: tone === 'ink' ? color.ink : color.accent }]} />
      </View>
    </View>
  )
}

/**
 * A candidate's still: the poster (or the photo), the ink ground with the
 * initials when there is neither, an optional play disc, anything on top.
 */
export function FilmStill({
  name, poster, width, height: h, corner = radius.tile, play, style, children,
}: {
  name: string
  poster?: string | null
  width?: number | `${number}%`
  height: number
  corner?: number
  play?: 'sm' | 'lg'
  style?: ViewStyle
  children?: React.ReactNode
}) {
  const disc = play === 'lg' ? height['deck-play'] - space.md : height.avatar
  return (
    <View style={[styles.still, { width, height: h, borderRadius: corner }, style]}>
      {poster ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.stillEmpty}><Text style={[h > height['film-card'] / 2 ? text.displayLg : text.uiBaseSemi, styles.stillInitials]}>{nameInitials(name)}</Text></View>
      )}
      {!!play && (
        <View style={styles.playWrap} pointerEvents="none">
          <View style={[styles.playDisc, { width: disc, height: disc }]}>
            <Icon name="tri" size={play === 'lg' ? space.xl : space.md + 1} tint={color.ink} fill={color.ink} weight={1} />
          </View>
        </View>
      )}
      {children}
    </View>
  )
}

/** A glass pill drawn over a still (“VERIFIED · 22 SEP”, “13 / 40”). */
export function GlassPill({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <View style={styles.glass}>
      {!!icon && <Icon name={icon} size={space.md - 1} tint={color.textOnInk} weight={2.4} />}
      <Text style={[text.metaXs, styles.mono, styles.onInk]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  )
}

/** A face: the photo, else the initials on the violet disc. `square` gives the 12-corner tile. */
export function Face({ name, photo, size = height.tap, square }: { name: string; photo?: string | null; size?: number; square?: boolean }) {
  const r = square ? radius.tile : radius.pill
  return photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: r, backgroundColor: color.surfaceSunken }} />
  ) : (
    <View style={[styles.faceMono, { width: size, height: size, borderRadius: r }]}>
      <Text style={[size >= height.control ? text.uiBaseSemi : text.uiSmSemi, styles.onInk]}>{nameInitials(name)}</Text>
    </View>
  )
}

/** Initials only, for a row the API sends no photo for (Interests). */
export function Initials({ name, size = height.slot }: { name: string; size?: number }) {
  return (
    <View style={[styles.initials, { width: size, height: size }]}>
      <Text style={[text.uiSmSemi, styles.secondary]}>{nameInitials(name)}</Text>
    </View>
  )
}

/** The employer's own note, in a soft amber well so it reads as theirs (S1). */
export function NoteWell({ children, lines = 2 }: { children: string; lines?: number }) {
  return (
    <View style={styles.note}>
      <Icon name="edit" size={space.md + 2} tint={color.warning} />
      <Text style={[text.uiSm, styles.secondary, styles.grow]} numberOfLines={lines}>{children}</Text>
    </View>
  )
}

/** A centred state: a 64 disc, the title, a sentence, the actions (F5, F6, S3). */
export function StudioState({
  icon, tone = 'accent', title, body, children,
}: { icon: IconName; tone?: 'accent' | 'success' | 'danger'; title: string; body?: string; children?: React.ReactNode }) {
  const t = {
    accent: { bg: color.accentSoft, fg: color.accentText },
    success: { bg: color.successSoft, fg: color.success },
    danger: { bg: color.dangerSoft, fg: color.danger },
  }[tone]
  return (
    <View style={styles.state}>
      <View style={[styles.stateDisc, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={height.glyph + 4} tint={t.fg} weight={tone === 'success' ? 2.4 : 1.8} />
      </View>
      <Text style={[text.displaySm, styles.center]}>{title}</Text>
      {!!body && <Text style={[text.uiMd, styles.muted, styles.center]}>{body}</Text>}
      {children}
    </View>
  )
}

/** A 40 bordered square icon control (the shortlist card's bin and note). */
export function IconSquare({ name, label, onPress, tone, disabled }: { name: IconName; label: string; onPress?: () => void; tone?: 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [styles.square, tone === 'danger' && styles.squareDanger, pressed && styles.pressed, disabled && styles.off]}
    >
      <Icon name={name} size={space.lg + 2} tint={tone === 'danger' ? color.danger : color.textSecondary} />
    </Pressable>
  )
}

/** A muted fact tile: mono label over the value (“EXPECTED · ₹3.6–4.8 LPA”). */
export function FactTile({ label, value, style }: { label: string; value: string; style?: ViewStyle }) {
  return (
    <View style={[styles.fact, style]}>
      <Text style={[text.metaXs, styles.mono, styles.muted]}>{label.toUpperCase()}</Text>
      <Text style={text.uiBaseSemi} numberOfLines={1}>{value}</Text>
    </View>
  )
}

/** Skill tags: mono caps outlines, then “+N”. */
export function SkillTags({ skills, max = 3, style }: { skills: string[]; max?: number; style?: ViewStyle }) {
  if (!skills.length) return null
  const shown = skills.slice(0, max)
  return (
    <View style={[styles.tags, style]}>
      {shown.map((s) => (
        <View key={s} style={styles.tag}><Text style={[text.metaXs, styles.mono, styles.secondary]} numberOfLines={1}>{s.toUpperCase()}</Text></View>
      ))}
      {skills.length > max && <View style={styles.tag}><Text style={[text.metaXs, styles.mono, styles.subtle]}>{`+${skills.length - max}`}</Text></View>}
    </View>
  )
}

/** A chip: violet when on (a filter, a tag), white when off; an × when it can be removed. */
export function StudioChip({
  label, on, icon, count, onPress, onRemove, dark, dashed, small,
}: {
  label: string; on?: boolean; icon?: IconName; count?: number; onPress?: () => void; onRemove?: () => void; dark?: boolean; dashed?: boolean; small?: boolean
}) {
  const fg = dark ? color.textInverse : on ? color.accentText : color.textSecondary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on || !!dark }}
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      onPress={onRemove ?? onPress}
      hitSlop={{ top: space.xs, bottom: space.xs }}
      style={({ pressed }) => [styles.chip, small && styles.chipSmall, on && styles.chipOn, dark && styles.chipDark, dashed && styles.chipDashed, pressed && styles.pressed]}
    >
      {!!icon && <Icon name={icon} size={space.md} tint={fg} />}
      <Text style={[small ? text.uiXsSemi : text.uiSmMedium, { color: fg }]} numberOfLines={1}>{label}</Text>
      {count !== undefined && <Text style={[text.metaSm, { color: fg }, styles.faint]}>{count}</Text>}
      {!!onRemove && <Icon name="x" size={space.md - 1} tint={fg} weight={2} />}
    </Pressable>
  )
}

/** A horizontal row of chips under a bar. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={[styles.chipRow, style]}>
      {children}
    </ScrollView>
  )
}

/** The segmented tabs with counts (I1): white pill on the muted track. */
export function SegTabs<T extends string>({
  items, value, onChange,
}: { items: { key: T; label: string; count?: number | null }[]; value: T; onChange: (key: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={({ pressed }) => [styles.segItem, on && styles.segOn, pressed && styles.pressed]}
          >
            <Text style={[on ? text.uiSmSemi : text.uiSmMedium, { color: on ? color.text : color.textMuted }]} numberOfLines={1}>{it.label}</Text>
            {it.count !== undefined && it.count !== null && <Text style={[text.metaSm, styles.subtle]}>{it.count}</Text>}
          </Pressable>
        )
      })}
    </View>
  )
}

/** Where now sits between sent and expiry; amber in the last stretch (I1). */
export function ExpiryBar({ fraction, urgent, left, right }: { fraction: number; urgent?: boolean; left: string; right: string }) {
  return (
    <View style={styles.meter}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(1, Math.max(0, fraction)) * 100}%`, backgroundColor: urgent ? color.warningFill : color.accent }]} />
      </View>
      <View style={styles.meterRow}>
        <Text style={[text.metaXs, styles.mono, styles.subtle]}>{left.toUpperCase()}</Text>
        <Text style={[text.metaXs, styles.mono, styles.subtle]}>{right.toUpperCase()}</Text>
      </View>
    </View>
  )
}

/** A profile section: a hairline above, a mono label, the content (P1, P2). */
export function SectionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[text.metaSm, styles.mono, styles.muted]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  )
}

/** The ink toast over the controls: what happened, and one action (Undo, Back). */
export function StudioToast({ message, icon, action, onAction, disabled, style }: { message: string; icon?: IconName; action?: string; onAction?: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <View style={[styles.toast, style]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      {!!icon && <Icon name={icon} size={space.lg - 1} tint={color.accentMuted} />}
      <Text style={[text.uiSm, styles.onInk, styles.grow]} numberOfLines={1}>{message}</Text>
      {!!action && (
        <Pressable accessibilityRole="button" accessibilityLabel={action} disabled={disabled} onPress={onAction} hitSlop={space.sm} style={({ pressed }) => [styles.toastAction, pressed && styles.pressed]}>
          <Text style={[text.uiSmSemi, styles.toastActionText]}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  mono: { letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  accent: { color: color.accent },
  onInk: { color: color.textOnInk },
  tnum: { fontVariant: ['tabular-nums'] },
  faint: { opacity: opacity.disabled + 0.15 },
  pressed: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },

  greet: { gap: space.sm },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius['card-lg'], padding: space.lg, gap: spaceHalf['3.5'] },
  lift: { boxShadow: shadow.card },
  cardSuccess: { backgroundColor: color.successWash, borderColor: color.successEdge },
  cardAccent: { backgroundColor: color.accentWash, borderColor: color.accentEdge },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },

  count: { padding: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  countTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBody: { gap: space.xs },

  meter: { gap: spaceHalf['1.5'] },
  meterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  track: { height: spaceHalf['1.5'] - 1, borderRadius: radius.pill, backgroundColor: color.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },

  still: { overflow: 'hidden', backgroundColor: color.inkRaised },
  stillEmpty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  stillInitials: { color: color.onInkWash },
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playDisc: { borderRadius: radius.pill, backgroundColor: color.onInkDisc, alignItems: 'center', justifyContent: 'center', paddingLeft: space['2xs'] },
  glass: { height: space.xl + space.xs, paddingHorizontal: space.sm + 1, borderRadius: radius.pill, backgroundColor: color.onInkGlass, flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },

  faceMono: { backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },
  initials: { borderRadius: radius.pill, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: spaceHalf['2.5'] - 1, paddingHorizontal: spaceHalf['2.5'] + 1, borderRadius: radius.tile, backgroundColor: color.warningWash, borderWidth: borderWidth.thin, borderColor: color.warningEdge },

  state: { alignItems: 'center', gap: space.md, paddingHorizontal: space['2xl'] },
  stateDisc: { width: height['deck-action'], height: height['deck-action'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },

  square: { width: height['control-xs'], height: height['control-xs'], borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  squareDanger: { borderColor: color.dangerBorder },

  fact: { flex: 1, minWidth: 0, gap: space.xs, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, backgroundColor: color.surfaceMuted },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 1 },
  tag: { height: space.xl + space.xs, paddingHorizontal: space.sm + 1, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, justifyContent: 'center' },

  chipScroll: { flexGrow: 0 },
  chipRow: { gap: spaceHalf['1.5'], paddingHorizontal: space.lg, alignItems: 'center' },
  chip: { height: height['chip-sm'], paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  chipSmall: { height: space.xl + space.xs, paddingHorizontal: space.sm },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accentEdge },
  chipDark: { backgroundColor: color.ink, borderColor: color.ink },
  chipDashed: { borderStyle: 'dashed', borderColor: color.borderStrong },

  seg: { flexDirection: 'row', padding: space['2xs'] + 1, gap: space['2xs'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted },
  segItem: { flex: 1, height: height.segment, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs + 1, paddingHorizontal: space.xs },
  segOn: { backgroundColor: color.surface, boxShadow: shadow.card },

  section: { gap: spaceHalf['2.5'], paddingVertical: space.lg, paddingHorizontal: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },

  toast: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], minHeight: height.control, paddingLeft: spaceHalf['3.5'], paddingRight: space.sm, borderRadius: radius.panel, backgroundColor: color.ink, boxShadow: shadow.toast },
  toastAction: { minHeight: height['control-xs'] - space.sm, paddingHorizontal: space.sm, justifyContent: 'center' },
  toastActionText: { color: color.accentMuted },
})
