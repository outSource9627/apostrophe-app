import React, { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { Skel } from '../../components/tab/kit'
import { SUPPORT_EMAIL, openSupport } from '../../lib/support'

/**
 * The pieces the Account tab and the screens it opens share
 * (docs/interviewer-account-mockup.html). The mockup's compact scale: titles
 * 15/600, meta 12.5–13, labels 13/500, section headings 16/700, buttons 15/600
 * at 46–48. Hairline borders, no shadows; colours and faces from the theme.
 */

/** A pushed page: 40 rounded back button, an 18 title and a 13 line, a scrolling body, an optional pinned foot. */
export function AcPage({ title, sub, onBack, footer, children }: { title: string; sub?: string; onBack: () => void; footer?: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <InterviewerShell bar="none" scroll={false}>
      <View style={k.screenHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [k.back, pressed && k.pressed]}>
          <Icon name="arrowL" size={20} tint={color.text} weight={1.9} />
        </Pressable>
        <View style={k.grow}>
          <Text accessibilityRole="header" style={k.screenTitle} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={k.screenSub} numberOfLines={1}>{sub}</Text>}
        </View>
      </View>
      <ScrollView style={k.grow} contentContainerStyle={[k.pageBody, !footer && { paddingBottom: 22 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {!!footer && <View style={[k.pageFoot, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>{footer}</View>}
    </InterviewerShell>
  )
}

/** The bordered, clipped list card (`.ow`). */
export function AcList({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[k.ow, style]}>{children}</View>
}

/** A padded card (`.card`). */
export function AcCard({ children, style, gap = 10 }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[k.card, { gap }, style]}>{children}</View>
}

/** The 16/700 section heading (`.oh h3`). */
export function AcHeading({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" style={k.h3}>{children}</Text>
}

export type BadgeTone = 'green' | 'red' | 'gray' | 'amber' | 'blue'
const BADGE: Record<BadgeTone, [string, string]> = {
  green: [color.successSoft, color.success],
  red: [color.dangerSoft, color.danger],
  gray: [color.surfaceMuted, color.textMuted],
  amber: [color.warningSoft, color.warning],
  blue: [color.infoSoft, color.info],
}
export function AcBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[k.badge, { backgroundColor: BADGE[tone][0] }]}>
      {tone === 'green' && <View style={k.badgeDot} />}
      <Text style={[k.badgeText, { color: BADGE[tone][1] }]}>{label}</Text>
    </View>
  )
}

/** A circle: the photo when there is one, else the initials, else a person glyph. */
export function AcDisc({ size, initials, uri }: { size: 40 | 52 | 84; initials?: string; uri?: string | null }) {
  const [broken, setBroken] = useState(false)
  const fs = size === 84 ? 26 : size === 52 ? 17 : 13.5
  return (
    <View style={[k.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri && !broken ? (
        <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setBroken(true)} accessibilityIgnoresInvertColors />
      ) : initials ? (
        <Text style={[k.discText, { fontSize: fs }]}>{initials}</Text>
      ) : (
        <Icon name="user" size={size === 84 ? 40 : 22} tint={color.textInverse} weight={1.9} />
      )}
    </View>
  )
}

/** A label-with-icon over a 15/500 value (`.kv`). */
export function AcKV({ icon, label, value, last }: { icon: IconName; label: string; value: string; last?: boolean }) {
  return (
    <View style={[k.kv, !last && k.rule]}>
      <View style={k.fl}><Icon name={icon} size={16} tint={color.textMuted} weight={1.9} /><Text style={k.flText}>{label}</Text></View>
      <Text style={k.kvValue}>{value}</Text>
    </View>
  )
}

/** One row of a list card (`.lk`): icon tile, a 15/600 title, a 12.5 line, a chevron (or the external arrow, or a mono value). */
export function AcRow({
  icon, title, sub, onPress, external, value, right, last,
}: { icon: IconName; title: string; sub?: string; onPress?: () => void; external?: boolean; value?: string; right?: React.ReactNode; last?: boolean }) {
  const body = (
    <>
      <View style={k.li}><Icon name={icon} size={18} tint={color.textSecondary} weight={1.9} /></View>
      <View style={k.grow}>
        <Text style={k.rowTitle}>{title}</Text>
        {!!sub && <Text style={k.rowSub}>{sub}</Text>}
      </View>
      {right}
      {!!value && <Text style={k.rv}>{value}</Text>}
      {!!onPress && !right && <Icon name={external ? 'arrowUR' : 'chevR'} size={17} tint={color.textSubtle} weight={1.9} />}
    </>
  )
  const style = [k.lk, !last && k.rule]
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={sub ? `${title}, ${sub}` : title} onPress={onPress} style={({ pressed }) => [...style, pressed && k.pressed]}>{body}</Pressable>
  ) : (
    <View style={style}>{body}</View>
  )
}

/** The 48 pill that closes a card or a page. */
export function AcPill({
  label, onPress, tone = 'on', icon, busy, busyLabel = 'Saving…', disabled,
}: { label: string; onPress?: () => void; tone?: 'on' | 'off' | 'outline' | 'ok'; icon?: IconName; busy?: boolean; busyLabel?: string; disabled?: boolean }) {
  const bg = { on: color.accent, off: color.surfaceSunken, outline: color.surface, ok: color.successSoft }[tone]
  const fg = { on: color.textInverse, off: color.textMuted, outline: color.text, ok: color.success }[tone]
  const inert = disabled || tone === 'off' || tone === 'ok' || !onPress
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert, busy: !!busy }}
      disabled={inert || busy}
      onPress={onPress}
      style={({ pressed }) => [k.pill, { backgroundColor: bg }, tone === 'outline' && k.pillOutline, (pressed || busy) && k.pressed]}
    >
      {!!icon && <Icon name={icon} size={18} tint={fg} weight={1.9} />}
      <Text style={[k.pillText, { color: fg }]} numberOfLines={1}>{busy ? busyLabel : label}</Text>
    </Pressable>
  )
}

/** A 36 outline button (`.btn.out.sm`). */
export function AcSmallBtn({ label, icon, onPress, disabled }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [k.small, pressed && k.pressed]}>
      {!!icon && <Icon name={icon} size={16} tint={color.text} weight={1.9} />}
      <Text style={k.smallText}>{label}</Text>
    </Pressable>
  )
}

/** A 46 solid or outline button (`.btn`). */
export function AcButton({ label, tone = 'primary', onPress }: { label: string; tone?: 'primary' | 'outline'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [k.btn, tone === 'primary' ? { backgroundColor: color.accent } : k.btnOutline, pressed && k.pressed]}>
      <Text style={[k.btnText, tone === 'primary' && { color: color.textInverse }]}>{label}</Text>
    </Pressable>
  )
}

/** A text link in the page's accent. */
export function AcLink({ label, onPress }: { label: string; onPress: () => void }) {
  return <Text accessibilityRole="link" onPress={onPress} style={k.link}>{label}</Text>
}

/** A label over a field, with the error or a hint under it. */
export function AcField({ label, right, error, hint, children }: { label: string; right?: React.ReactNode; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={k.fld}>
      <View style={k.fldHead}><Text style={k.fldLabel}>{label}</Text>{right}</View>
      {children}
      {error ? <Text accessibilityRole="alert" style={k.fhErr}>{error}</Text> : hint ? <Text style={k.fh}>{hint}</Text> : null}
    </View>
  )
}

/** The text field: 48 high, a strong hairline, a violet focus line, a danger one when bad. */
export function AcInput({ bad, multiline, right, style, ...rest }: { bad?: boolean; right?: React.ReactNode } & TextInputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <View style={[k.inp, multiline && k.inpMulti, focus && !bad && { borderColor: color.accent }, bad && { borderColor: color.dangerFill }]}>
      <TextInput
        placeholderTextColor={color.textSubtle}
        autoCorrect={false}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e) }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e) }}
        style={[k.inpText, multiline && k.inpTextMulti, style]}
      />
      {right}
    </View>
  )
}

/** A read-only field: muted ground, a lock. */
export function AcReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={k.fld}>
      <Text style={k.fldLabel}>{label}</Text>
      <View style={k.ro}>
        <Icon name="lock" size={16} tint={color.textSubtle} weight={1.9} />
        <Text style={k.roText}>{value}</Text>
      </View>
    </View>
  )
}

/** A 38 language/option chip (`.chipsel button`). */
export function AcChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={({ pressed }) => [k.chip, on && k.chipOn, pressed && k.pressed]}>
      {on && <Icon name="check" size={15} tint={color.textInverse} weight={2.2} />}
      <Text style={[k.chipText, on && { color: color.textInverse }]}>{label}</Text>
    </Pressable>
  )
}

/** The 44×26 switch of the notification grid. */
export function AcSwitch({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={6}
      onPress={() => onChange(!on)}
      style={[k.tg, on && { backgroundColor: color.accent }]}
    >
      <View style={[k.knob, on ? { left: 21 } : { left: 3 }]} />
    </Pressable>
  )
}

export type NoticeTone = 'error' | 'ok' | 'info' | 'proposal'
/** The error / success / info boxes (`.errbox`, `.okbox`, `.pnote`). */
export function AcNotice({ tone, children, style }: { tone: NoticeTone; children: React.ReactNode; style?: ViewStyle }) {
  const icon: IconName = tone === 'ok' ? 'checkCircle' : tone === 'info' || tone === 'proposal' ? 'info' : 'alert'
  const tint = tone === 'ok' ? color.success : tone === 'error' ? color.danger : color.accent
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[k.notice, tone === 'error' && k.noticeErr, tone === 'ok' && k.noticeOk, (tone === 'info' || tone === 'proposal') && k.noticeInfo, style]}>
      <Icon name={icon} size={18} tint={tint} weight={1.9} />
      <View style={k.grow}>{children}</View>
    </View>
  )
}
export const noticeText = (tone: NoticeTone) => ({
  fontFamily: tone === 'ok' ? FF.bodySemiBold : FF.body, fontSize: 13, lineHeight: 18,
  color: tone === 'ok' ? color.success : tone === 'error' ? color.danger : color.textSecondary,
})

/** A pulsing block clipped to a radius. */
export function AcSkel({ h, w = '100%', r = 10 }: { h: number; w?: `${number}%` | number; r?: number }) {
  return <View style={{ width: w, height: h, borderRadius: r, overflow: 'hidden' }}><Skel w="100%" h={h} /></View>
}

/** A centred confirm dialog (`.dlg`): a title, a line, optional body, and text actions on the right. */
export function AcDialog({
  open, title, message, children, onClose, actions,
}: { open: boolean; title: string; message: string; children?: React.ReactNode; onClose: () => void; actions: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }[] }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={k.scrim}>
        <View style={k.dlg} accessibilityViewIsModal>
          <Text style={k.dlgTitle}>{title}</Text>
          <Text style={k.dlgMsg}>{message}</Text>
          {children}
          <View style={k.dlgActions}>
            {actions.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" accessibilityState={{ disabled: !!a.disabled }} disabled={a.disabled} onPress={a.onPress} style={({ pressed }) => [k.dlgBtn, pressed && k.pressed]}>
                <Text style={[k.dlgBtnText, a.danger && { color: color.danger }, a.disabled && { color: color.textSubtle }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** The bottom sheet (`.sheet`): grab handle, a 16/700 title, content. */
export function AcSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={k.sheetWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[k.sheet, { paddingBottom: 24 + insets.bottom }]} accessibilityViewIsModal>
          <View style={k.grab} />
          <Text accessibilityRole="header" style={k.sheetTitle}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  )
}

/** "Open your mail app": To and Subject, then the hand-off to the phone's mail app. Every request to support goes through this. */
export function SupportSheet({ subject, onClose }: { subject: string | null; onClose: () => void }) {
  return (
    <AcSheet open={subject != null} title="Open your mail app" onClose={onClose}>
      <View style={k.kvs}>
        <View style={[k.kvsRow, k.rule]}><Text style={k.kvsKey}>To</Text><Text style={k.kvsVal}>{SUPPORT_EMAIL}</Text></View>
        <View style={k.kvsRow}><Text style={k.kvsKey}>Subject</Text><Text style={k.kvsVal}>{subject ?? ''}</Text></View>
      </View>
      <AcPill label="Open mail app" onPress={() => { const s = subject ?? undefined; onClose(); void openSupport(s) }} />
      <AcPill label="Cancel" tone="outline" onPress={onClose} />
    </AcSheet>
  )
}

/** The centred error: icon, title, the line, Try again. */
export function AcErrorBlock({ title, body, onRetry }: { title: string; body?: string; onRetry: () => void }) {
  return (
    <View style={k.center}>
      <View style={k.centerIc}><Icon name="alert" size={28} tint={color.accent} weight={1.9} /></View>
      <Text style={k.centerTitle}>{title}</Text>
      {!!body && <Text style={k.centerBody}>{body}</Text>}
      <AcButton label="Try again" onPress={onRetry} />
    </View>
  )
}

const k = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  grow: { flex: 1, minWidth: 0 },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },

  screenHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  screenTitle: { fontFamily: FF.bodyBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.54, color: color.text },
  screenSub: { fontFamily: FF.body, fontSize: 13, color: color.textMuted },
  pageBody: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 22, gap: 14 },
  pageFoot: { paddingTop: 12, paddingHorizontal: 20, gap: 8, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },

  ow: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, overflow: 'hidden' },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, padding: 14 },
  h3: { fontFamily: FF.bodyBold, fontSize: 16, lineHeight: 21, letterSpacing: -0.32, color: color.text, paddingTop: 8, paddingHorizontal: 2 },

  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingVertical: 2, paddingHorizontal: 9 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: color.successFill },
  badgeText: { fontFamily: FF.bodySemiBold, fontSize: 12.5, lineHeight: 17 },

  disc: { backgroundColor: color.inkRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  discText: { fontFamily: FF.bodySemiBold, color: color.textInverse },

  kv: { paddingTop: 9, paddingBottom: 10, paddingHorizontal: 16 },
  fl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flText: { fontFamily: FF.bodyMedium, fontSize: 13, color: color.textMuted },
  kvValue: { fontFamily: FF.bodyMedium, fontSize: 15, letterSpacing: -0.15, color: color.text, marginTop: 3 },

  lk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 14, minHeight: 58 },
  li: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FF.bodySemiBold, fontSize: 15, lineHeight: 19, letterSpacing: -0.225, color: color.text },
  rowSub: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 16, color: color.textMuted },
  rv: { fontFamily: FF.monoMedium, fontSize: 13, color: color.textMuted },

  pill: { height: 48, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  pillOutline: { borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  pillText: { fontFamily: FF.bodySemiBold, fontSize: 15 },
  small: { height: 36, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  smallText: { fontFamily: FF.bodySemiBold, fontSize: 13.5, color: color.text },
  btn: { height: 46, minWidth: 44, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  btnText: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  link: { fontFamily: FF.bodyBold, fontSize: 12.5, color: color.accent },

  fld: { gap: 6 },
  fldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  fldLabel: { fontFamily: FF.bodyMedium, fontSize: 13, color: color.textSecondary },
  fh: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted },
  fhErr: { fontFamily: FF.bodyMedium, fontSize: 12.5, lineHeight: 17, color: color.danger },
  inp: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong, paddingLeft: 14, paddingRight: 6 },
  inpMulti: { alignItems: 'flex-start' },
  inpText: { flex: 1, minWidth: 0, height: 46, padding: 0, fontFamily: FF.bodyMedium, fontSize: 15, color: color.text },
  inpTextMulti: { height: undefined, minHeight: 92, paddingVertical: 12, lineHeight: 21 },
  ro: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, paddingHorizontal: 14 },
  roText: { flex: 1, minWidth: 0, fontFamily: FF.bodyMedium, fontSize: 15, color: color.textSecondary, paddingVertical: 11 },

  chip: { height: 38, paddingHorizontal: 14, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.textSecondary },

  tg: { width: 44, height: 26, borderRadius: 13, backgroundColor: color.borderStrong },
  knob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: color.surface },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: borderWidth.thin, paddingVertical: 11, paddingHorizontal: 13 },
  noticeErr: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
  noticeOk: { backgroundColor: color.successSoft, borderColor: color.successEdge },
  noticeInfo: { backgroundColor: color.accentWash, borderColor: color.accent, borderStyle: 'dashed' },

  scrim: { flex: 1, backgroundColor: color.scrim, justifyContent: 'center', padding: 24 },
  dlg: { backgroundColor: color.surface, borderRadius: 22, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12 },
  dlgTitle: { fontFamily: FF.bodyBold, fontSize: 17, letterSpacing: -0.43, color: color.text },
  dlgMsg: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textSecondary, marginTop: 8 },
  dlgActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 12 },
  dlgBtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dlgBtnText: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },

  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrim },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 18, gap: 8 },
  grab: { width: 38, height: 4, borderRadius: 4, backgroundColor: color.borderStrong, alignSelf: 'center', marginBottom: 6 },
  sheetTitle: { fontFamily: FF.bodyBold, fontSize: 16, letterSpacing: -0.32, color: color.text },
  kvs: { borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 13, overflow: 'hidden' },
  kvsRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, paddingHorizontal: 12 },
  kvsKey: { width: 56, fontFamily: FF.body, fontSize: 13, color: color.textMuted },
  kvsVal: { flex: 1, minWidth: 0, fontFamily: FF.bodyMedium, fontSize: 13, color: color.text },

  center: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 32 },
  centerIc: { width: 60, height: 60, borderRadius: 20, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  centerTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.48, color: color.text, textAlign: 'center' },
  centerBody: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 18 },
})
