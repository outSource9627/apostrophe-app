import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { Skel } from '../../components/tab/kit'
import { formatPaise } from '../../lib/format/money'
import { LEDGER_KIND_LABELS, type LedgerRowDto } from '../../lib/api/interviewer'
import { istStamp } from '../../lib/interviewer/state'

/**
 * The pieces the Wallet tab and the four screens it opens share
 * (docs/interviewer-wallet-mockup.html). Sizes are the mockup's; colours and
 * faces come from the theme. Hairline borders, no shadows.
 */

/** A pushed page: the 44 back circle, a 22 title and a 14 line, a scrolling body and an optional pinned foot. */
export function PageFrame({ title, sub, onBack, footer, children }: { title: string; sub?: string; onBack: () => void; footer?: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <InterviewerShell bar="none" scroll={false}>
      <View style={k.pageHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [k.back, pressed && k.pressed]}>
          <Icon name="arrowL" size={22} tint={color.text} weight={1.9} />
        </Pressable>
        <View style={k.grow}>
          <Text accessibilityRole="header" style={k.pageTitle} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={k.pageSub} numberOfLines={1}>{sub}</Text>}
        </View>
      </View>
      <ScrollView style={k.grow} contentContainerStyle={[k.pageBody, !footer && { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {!!footer && <View style={[k.pageFoot, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>{footer}</View>}
    </InterviewerShell>
  )
}

export function WCard({ tone = 'plain', gap = 10, padding = 16, style, children }: { tone?: 'plain' | 'danger'; gap?: number; padding?: number; style?: ViewStyle; children: React.ReactNode }) {
  return <View style={[k.card, { gap, padding }, tone === 'danger' && k.cardDanger, style]}>{children}</View>
}

export type BadgeTone = 'green' | 'violet' | 'red' | 'gray' | 'amber'
const BADGE: Record<BadgeTone, [string, string]> = {
  green: [color.successSoft, color.success],
  violet: [color.accentSoft, color.accentHover],
  red: [color.dangerSoft, color.danger],
  gray: [color.surfaceMuted, color.textMuted],
  amber: [color.warningSoft, color.warning],
}
export function WBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[k.badge, { backgroundColor: BADGE[tone][0] }]}>
      <Text style={[k.badgeText, { color: BADGE[tone][1] }]}>{label}</Text>
    </View>
  )
}

/** The 50 pill that closes a page: accent when live, the sunken fill when not. */
export function PBtn({ label, onPress, on, icon }: { label: string; onPress?: () => void; on: boolean; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !on }}
      disabled={!on || !onPress}
      onPress={onPress}
      style={({ pressed }) => [k.pbtn, { backgroundColor: on ? color.accent : color.surfaceSunken }, pressed && k.pressed]}
    >
      {!!icon && <Icon name={icon} size={20} tint={color.textInverse} weight={1.9} />}
      <Text style={[k.pbtnText, { color: on ? color.textInverse : color.textMuted }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** The 46 outline button; `sm` is the 38 one. */
export function OutBtn({ label, onPress, sm, icon, disabled, style }: { label: string; onPress?: () => void; sm?: boolean; icon?: IconName; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [k.out, sm && k.outSm, pressed && k.pressed, style]}
    >
      {!!icon && <Icon name={icon} size={18} tint={color.text} weight={1.9} />}
      <Text style={[k.outText, sm && { fontSize: 14 }]}>{label}</Text>
    </Pressable>
  )
}

/** A label over a 52 field, with the error (14, red) or a hint (13.5) under it. */
export function WField({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={k.fld}>
      <Text style={k.fldLabel}>{label}</Text>
      {children}
      {error ? <Text accessibilityRole="alert" style={k.fldErr}>{error}</Text> : hint ? <Text style={k.fldHint}>{hint}</Text> : null}
    </View>
  )
}

/** The text field: 52 high, 1.5 border, 17 type; an optional leading "₹". */
export function WInput({ lead, bad, dis, style, ...rest }: { lead?: string; bad?: boolean; dis?: boolean } & TextInputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <View style={[k.inp, focus && !bad && { borderColor: color.accent }, bad && { borderColor: color.dangerFill }, dis && { backgroundColor: color.surfaceMuted }]}>
      {!!lead && <Text style={k.inpLead}>{lead}</Text>}
      <TextInput
        placeholderTextColor={color.textSubtle}
        autoCorrect={false}
        {...rest}
        editable={rest.editable !== false && !dis}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e) }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e) }}
        style={[k.inpText, style]}
      />
    </View>
  )
}

/** A filter or amount chip: 40 (or 36) high pill, accent when on. */
export function WChip({ label, on, onPress, sm }: { label: string; on: boolean; onPress: () => void; sm?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [k.chip, sm && k.chipSm, on && k.chipOn, pressed && k.pressed]}
    >
      <Text style={[k.chipText, sm && { fontSize: 14 }, on && { color: color.textInverse }]}>{label}</Text>
    </Pressable>
  )
}

/** A rounded pulsing block (the kit's Skel, clipped to the radius). */
export function SkelBox({ h, r = 10, w = '100%' }: { h: number; r?: number; w?: `${number}%` | number }) {
  return <View style={{ width: w, height: h, borderRadius: r, overflow: 'hidden' }}><Skel w="100%" h={h} /></View>
}

/** A skeleton line pair + amount, in a bordered list. */
export function SkelRows({ count, pad = 16 }: { count: number; pad?: number }) {
  return (
    <View style={k.ow}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[k.ir, { paddingHorizontal: pad }, i < count - 1 && k.rule]}>
          <View style={[k.grow, { gap: 8 }]}><SkelBox h={16} w="50%" /><SkelBox h={13} w="75%" /></View>
          <SkelBox h={14} w={54} />
        </View>
      ))}
    </View>
  )
}

/** The centred error: icon, title, the server's line, Try again. */
export function ErrBlock({ title, body, onRetry }: { title: string; body?: string; onRetry: () => void }) {
  return (
    <View style={k.center}>
      <View style={k.centerIc}><Icon name="alert" size={32} tint={color.accent} weight={1.9} /></View>
      <Text style={k.centerTitle}>{title}</Text>
      {!!body && <Text style={k.centerBody}>{body}</Text>}
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [k.centerBtn, pressed && k.pressed]}>
        <Icon name="refresh" size={18} tint={color.text} weight={1.9} />
        <Text style={k.centerBtnText}>Try again</Text>
      </Pressable>
    </View>
  )
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={k.center}>
      <View style={k.centerIc}><Icon name="file" size={32} tint={color.accent} weight={1.9} /></View>
      <Text style={k.centerTitle}>{title}</Text>
      <Text style={k.centerBody}>{body}</Text>
    </View>
  )
}

/** The line under a ledger row's kind: who it was for, the note, when. */
export const ledgerMeta = (r: LedgerRowDto) =>
  [r.interview ? `${r.interview.studentName} · ${r.interview.tier}` : null, r.note, istStamp(r.at)].filter(Boolean).join(' · ')

/** One full-ledger row: kind, meta, signed amount, and the balance after it when the API carries it. */
export function LedgerRow({ r, last }: { r: LedgerRowDto; last?: boolean }) {
  const credit = r.sign > 0
  return (
    <View style={[k.lr, !last && k.rule]}>
      <View style={k.grow}>
        <Text style={k.nmx}>{LEDGER_KIND_LABELS[r.kind] ?? r.kind}</Text>
        <Text style={k.sub} numberOfLines={2}>{ledgerMeta(r)}</Text>
      </View>
      <View style={k.rt}>
        <Text style={[k.amt, credit && { color: color.success }]}>{`${credit ? '+' : '−'}${formatPaise(r.amountPaise)}`}</Text>
        {typeof r.balanceAfterPaise === 'number' && <Text style={k.bal}>{`Bal ${formatPaise(r.balanceAfterPaise)}`}</Text>}
      </View>
    </View>
  )
}

export const k = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  grow: { flex: 1, minWidth: 0 },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },

  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  pageTitle: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 25, letterSpacing: -0.66, color: color.text },
  pageSub: { fontFamily: FF.body, fontSize: 14, color: color.textMuted },
  pageBody: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  pageFoot: { paddingTop: 12, paddingHorizontal: 20, gap: 8, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },

  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20 },
  cardDanger: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
  badge: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { fontFamily: FF.bodySemiBold, fontSize: 13, lineHeight: 17, letterSpacing: -0.065 },

  pbtn: { height: 50, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pbtnText: { fontFamily: FF.bodyBold, fontSize: 15.5 },
  out: { height: 46, minWidth: 44, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  outSm: { height: 38, borderRadius: 12, paddingHorizontal: 14, alignSelf: 'flex-start' },
  outText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.text },

  fld: { gap: 6 },
  fldLabel: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.textSecondary },
  fldErr: { fontFamily: FF.body, fontSize: 14, color: color.danger },
  fldHint: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  inp: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  inpLead: { fontFamily: FF.bodySemiBold, fontSize: 17, color: color.textMuted },
  inpText: { flex: 1, minWidth: 0, height: '100%', padding: 0, fontFamily: FF.bodyMedium, fontSize: 17, color: color.text },

  chip: { height: 40, paddingHorizontal: 14, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  chipSm: { height: 36 },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textSecondary },

  ow: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, overflow: 'hidden' },
  ir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, minHeight: 60 },
  lr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 64 },
  rt: { alignItems: 'flex-end', gap: 2 },
  nmx: { fontFamily: FF.bodySemiBold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.33, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted },
  amt: { fontFamily: FF.monoMedium, fontSize: 14, color: color.text },
  bal: { fontFamily: FF.monoMedium, fontSize: 12.5, color: color.textMuted },

  center: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 32 },
  centerIc: { width: 72, height: 72, borderRadius: 24, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  centerTitle: { fontFamily: FF.bodyBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.72, color: color.text, textAlign: 'center' },
  centerBody: { fontFamily: FF.body, fontSize: 16, lineHeight: 24, color: color.textMuted, textAlign: 'center', marginTop: 10, marginBottom: 22 },
  centerBtn: { height: 52, paddingHorizontal: 26, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  centerBtnText: { fontFamily: FF.bodyBold, fontSize: 16, color: color.text },
})
