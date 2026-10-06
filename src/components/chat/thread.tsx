import React, { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf, trackingNative,
} from '../../theme'
import { text } from '../ui/typography'
import { Icon } from '../ui/Icon'
import { PopoverMenu, measureAnchor, type MenuAnchor } from '../ui/overlay'
import { fmtBytes } from '../../lib/chat/format'
import { BackButton } from './controls'

/**
 * The conversation's chrome (docs/chat-redesign-mockups.html, A), the same in
 * all three apps: the header, the notes under it, and the foot — the composer,
 * or what stands in its place when the chat is read-only.
 */

/** Back (40), the plate (40), the name and a sentence-case line; on the right whatever the thread needs (CV, Recording, ⋯). */
export function ChatHeader({ onBack, plate, title, subtitle, right }: {
  onBack: () => void; plate?: React.ReactNode; title: string; subtitle?: string | null; right?: React.ReactNode
}) {
  return (
    <View style={s.head}>
      <BackButton onPress={onBack} />
      {plate}
      <View style={s.titles}>
        <Text accessibilityRole="header" style={s.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[text.metaSm, s.sub]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {!!right && <View style={s.right}>{right}</View>}
    </View>
  )
}

/** The session is being recorded — beside the ⋯, never instead of it (Report stays reachable). */
export function RecordingPill() {
  return (
    <View accessibilityLabel="Recording" style={s.rec}>
      <View style={s.recDot} />
      <Text style={s.recText}>Recording</Text>
    </View>
  )
}

/** The info card under the header — the masked interviewer, said positively. */
export function MaskInfo({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.mask}>
      <Text style={s.maskTitle}>{title}</Text>
      <Text style={s.maskBody}>{body}</Text>
    </View>
  )
}

/** A quiet centred line above the composer — "Closes Sun 11 Oct, 9:20 AM IST · 48 hours after your interview". */
export function ClosesLine({ text: line }: { text: string }) {
  return <Text style={s.closes}>{line}</Text>
}

/** What stands where the composer was on a read-only, archived or not-yet-open chat: a lock, the reason, what it means. */
export function ReadOnlyFoot({ title, body, bottomInset = 0 }: { title: string; body?: string | null; bottomInset?: number }) {
  return (
    <View style={[s.foot, { paddingBottom: spaceHalf['4.5'] + bottomInset }]}>
      <View style={s.footRow}>
        <View style={s.footLock}><Icon name="lock" size={space.lg} tint={color.text} weight={2} /></View>
        <Text style={s.footTitle}>{title}</Text>
      </View>
      {!!body && <Text style={s.footBody}>{body}</Text>}
    </View>
  )
}

export type AttachKind = 'image' | 'document'

/**
 * The composer: a round "+" (a photo or a document, the admin's size limits in
 * its menu) where the thread takes files, a pill field, and the round accent
 * send — dimmed while there is nothing to send. No microphone and no call:
 * the product has neither.
 */
export function Composer({
  value, onChange, onSend, busy, placeholder, error, uploading, attach, bottomInset = 0,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  busy: boolean
  placeholder: string
  error?: string | null
  /** 0–100 while a file uploads. */
  uploading?: number | null
  /** Absent where the thread takes text only (the interviewer's). */
  attach?: { onPick: (kind: AttachKind) => void; imageMaxBytes: number | null; documentMaxBytes: number | null }
  bottomInset?: number
}) {
  const plusRef = useRef<React.ComponentRef<typeof View>>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const canSend = value.trim().length > 0 && !busy
  const limit = (n: number | null) => (n ? ` · up to ${fmtBytes(n)}` : '')

  return (
    <View style={[s.composer, { paddingBottom: space.md + bottomInset }]}>
      {!!error && <Text accessibilityRole="alert" style={[text.uiSm, s.error]}>{error}</Text>}
      {uploading != null && <Text accessibilityLiveRegion="polite" style={[text.metaSm, s.uploading]}>{`Uploading · ${uploading}%`}</Text>}
      <View style={s.composerRow}>
        {!!attach && (
          <Pressable
            ref={plusRef}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo or a document"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => { measureAnchor(plusRef.current).then((a) => a && setMenu(a)) }}
            style={({ pressed }) => [s.roundBtn, s.attach, (pressed || busy) && s.pressed]}
          >
            <Icon name="plus" size={height.glyph - 4} tint={color.textMuted} weight={2} />
          </Pressable>
        )}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.textSubtle}
          accessibilityLabel={placeholder}
          multiline
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [s.roundBtn, s.send, !canSend && s.sendOff, pressed && s.pressed]}
        >
          <Icon name="arrowR" size={height.glyph - 4} tint={color.textInverse} weight={2} />
        </Pressable>
      </View>
      {!!attach && (
        <PopoverMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          items={[
            { key: 'image', icon: 'image', label: `Photo${limit(attach.imageMaxBytes)}`, onPress: () => attach.onPick('image') },
            { key: 'document', icon: 'file', label: `Document${limit(attach.documentMaxBytes)}`, onPress: () => attach.onPick('document') },
          ]}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },

  head: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'],
    paddingTop: space.sm, paddingBottom: spaceHalf['2.5'], paddingLeft: space.sm, paddingRight: spaceHalf['2.5'],
    backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  titles: { flex: 1, minWidth: 0, gap: space['2xs'] },
  title: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-lead'], letterSpacing: trackingNative['snug-sm'], color: color.text },
  sub: { color: color.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },

  rec: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], backgroundColor: color.dangerSoft, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: spaceHalf['2.5'] },
  recDot: { width: spaceHalf['1.5'], height: spaceHalf['1.5'], borderRadius: radius.pill, backgroundColor: color.dangerFill },
  recText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-sm'], color: color.danger },

  mask: { marginTop: spaceHalf['2.5'], marginHorizontal: spaceHalf['3.5'], backgroundColor: color.infoSoft, borderRadius: radius.panel, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md },
  maskTitle: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.info, marginBottom: space['2xs'] },
  maskBody: { fontFamily: FF.body, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.info },

  closes: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], lineHeight: leadingNative['meta-sm'], fontVariant: ['tabular-nums'], color: color.textSubtle, textAlign: 'center', paddingTop: spaceHalf['1.5'], paddingBottom: space.xs, paddingHorizontal: space.xl },

  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingTop: spaceHalf['3.5'], paddingHorizontal: spaceHalf['4.5'] },
  footRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  footLock: { paddingTop: space['2xs'] },
  footTitle: { flex: 1, fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-md'], color: color.text },
  footBody: { fontFamily: FF.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textMuted, marginTop: space.xs },

  composer: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingTop: spaceHalf['2.5'], paddingHorizontal: space.md },
  error: { color: color.danger, marginBottom: space.sm },
  uploading: { color: color.textMuted, marginBottom: space.sm },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1, minHeight: height['control-sm'], maxHeight: height['composer-max'], borderRadius: height['control-sm'] / 2,
    borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface,
    paddingHorizontal: spaceHalf['3.5'], paddingVertical: spaceHalf['2.5'],
    fontFamily: FF.body, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-md'], color: color.text,
  },
  roundBtn: { width: height['control-sm'], height: height['control-sm'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  attach: { borderWidth: borderWidth.medium, borderColor: color.border },
  send: { backgroundColor: color.accent },
  sendOff: { opacity: opacity.disabled },
})
