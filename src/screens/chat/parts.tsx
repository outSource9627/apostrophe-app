import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { color, space, spaceHalf, radius, borderWidth, height, fontSize, fontFamilyNative as FF } from '../../theme'
import { text } from '../../components/ui/typography'
import { Meta } from '../../components/ui/Type'
import { Chip, Sheet } from '../../components/ui'
import { Btn } from '../../components/tab/kit'
import type { ReportReason } from '../../lib/api/chat'
import { interestClock, type ClockReading } from '../../lib/chat/format'

/**
 * The student chat flow's sheets — the thread menu, Report and Block — and the
 * Interest clock. The conversation's own pieces (plate, row, bubble, composer,
 * header, read-only foot) are shared by all three apps and live in
 * components/chat.
 */

function Stroke({ size = 16, stroke, children }: { size?: number; stroke: string; children: React.ReactNode }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
}
const ClockGlyph = ({ stroke }: { stroke: string }) => <Stroke size={12} stroke={stroke}><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></Stroke>

// ── the block confirmation sheet (CN-05) ─────────────────────────────────────
export function BlockSheet({ open, name, busy, onConfirm, onClose }: { open: boolean; name: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Block ${name}?`}>
      <View style={styles.consequences}>
        <Consequence label="Right away" body="This chat stays archived, and closed to both of you for good." />
        <Consequence label="Permanently" body={`${name} never sees your profile in the feed again, and cannot send you an Interest.`} />
        <Consequence label="Not undoable" body="Not from here. Support can, and will ask why." />
      </View>
      <Text style={styles.blockNote}>{name} is not told. A block and a withdrawal look the same from the other side.</Text>
      <View style={styles.sheetButtons}>
        <Btn variant="destructive" busy={busy} label={`Block ${name}`} onPress={onConfirm} />
        <Btn variant="quiet" label="Keep the connection" onPress={onClose} />
      </View>
    </Sheet>
  )
}
function Consequence({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.consequence}>
      <Text style={styles.consLabel}>{label}</Text>
      <Text style={styles.consBody}>{body}</Text>
    </View>
  )
}

// ── the header menu ─────────────────────────────────────────────────────────
export function MenuSheet({ open, name, canBlock, isInterviewer, onClose, onReport, onBlock, onSupport }: {
  open: boolean; name: string; canBlock: boolean; isInterviewer: boolean
  onClose: () => void; onReport: () => void; onBlock: () => void; onSupport: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.menuCard}>
        <MenuItem onPress={onReport} label="Report this chat" tint={color.textSecondary} bg={color.surfaceMuted} last={!isInterviewer && !canBlock}>
          <Stroke size={18} stroke={color.textSecondary}><Path d="M5 21V4" /><Path d="M5 5h11l-2 3.5L16 12H5" /></Stroke>
        </MenuItem>
        {isInterviewer && (
          <MenuItem onPress={onSupport} label="Message support" tint={color.textSecondary} bg={color.surfaceMuted} last={!canBlock}>
            <Stroke size={18} stroke={color.textSecondary}><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={3.6} /></Stroke>
          </MenuItem>
        )}
        {canBlock && (
          <MenuItem onPress={onBlock} label={`Block ${name}`} tint={color.danger} bg={color.dangerSoft} last>
            <Stroke size={18} stroke={color.danger}><Circle cx={12} cy={12} r={9} /><Path d="m5.6 5.6 12.8 12.8" /></Stroke>
          </MenuItem>
        )}
      </View>
    </Sheet>
  )
}
function MenuItem({ label, tint, bg, last, onPress, children }: { label: string; tint: string; bg: string; last?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuItem, !last && styles.menuRule, pressed && { backgroundColor: color.surfaceMuted }]}>
      <View style={[styles.menuIcon, { backgroundColor: bg }]}>{children}</View>
      <Text style={[styles.menuLabel, { color: tint === color.danger ? color.danger : color.text }]}>{label}</Text>
    </Pressable>
  )
}

// ── the report sheet ──────────────────────────────────────────────────────
const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'OFF_PLATFORM_PAYMENT', label: 'Off-platform payment' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Something else' },
]
export function ReportSheet({ open, name, onClose, onSubmit }: {
  open: boolean; name: string; onClose: () => void; onSubmit: (reason: ReportReason, note: string) => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${name}`}>
      <Text style={styles.reportNote}>The conversation is frozen as evidence. {name} is not told you reported it.</Text>
      <View style={styles.reasonWrap}>
        {REPORT_REASONS.map((r) => <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder="Anything you want to add (optional)" placeholderTextColor={color.textSubtle} multiline style={styles.noteInput} />
      <View style={styles.sheetButtons}>
        <Btn disabled={!reason} label="Send report" onPress={() => reason && onSubmit(reason, note)} />
        <Btn variant="quiet" label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  )
}

const CLOCK: Record<Exclude<ClockReading, 'spent'>, { bg: string; fg: string; fill: string; abs: string }> = {
  fresh: { bg: color.surfaceSunken, fg: color.textMuted, fill: color.borderStrong, abs: color.textSubtle },
  soon: { bg: color.warningSoft, fg: color.warning, fill: color.warning, abs: color.warning },
  urgent: { bg: color.warning, fg: color.textInverse, fill: color.warning, abs: color.warning },
}

/** "under an hour left" → "Under an hour left": the pill reads as its own sentence. */
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** The fourteen-day Interest clock — one component, four readings; the rule fills as time is used. */
export function InterestClock({ sentAt, expiresAt, now }: { sentAt: string; expiresAt: string; now: number }) {
  const c = interestClock(sentAt, expiresAt, now)
  const t = CLOCK[c.reading === 'spent' ? 'urgent' : c.reading]
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.clockRow}>
        <View style={[styles.clockPill, { backgroundColor: t.bg }]}>
          <ClockGlyph stroke={t.fg} />
          <Text style={[styles.clockPillText, { color: t.fg }]}>{sentence(c.relative)}</Text>
        </View>
        <Meta style={{ color: t.abs }}>{c.absolute}</Meta>
      </View>
      <View style={styles.clockTrack}>
        <View style={{ height: height['step-bar'] - 1, width: `${c.pct}%`, borderRadius: radius.pill, backgroundColor: t.fill }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  clockPill: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], borderRadius: radius.pill, paddingHorizontal: spaceHalf['2.5'], paddingVertical: space.xs },
  clockPillText: { ...text.metaMd, fontFamily: FF.bodyMedium },
  clockTrack: { height: height['step-bar'] - 1, borderRadius: radius.pill, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  consequences: { marginTop: 14, gap: 8 },
  consequence: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  consLabel: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textMuted },
  consBody: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
  blockNote: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted, marginTop: 12 },
  sheetButtons: { marginTop: 16, gap: 8 },
  reportNote: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.textMuted, marginTop: 8 },
  menuCard: { marginTop: 8, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 14, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16 },
  menuRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontFamily: FF.bodySemiBold, fontSize: 15.5 },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  noteInput: { marginTop: 12, minHeight: 80, borderRadius: 14, borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FF.body, fontSize: 15, color: color.text, textAlignVertical: 'top' },
})
