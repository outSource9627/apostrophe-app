import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { color, space, spaceHalf, radius, borderWidth, height, trackingNative } from '../../theme'
import { text } from '../../components/ui/typography'
import { Body, Eyebrow, Meta } from '../../components/ui/Type'
import { Button, Chip, Divider, IconButton, Sheet, StatusPill } from '../../components/ui'
import { LogoMark } from '../../components/Logo'
import type { MessageDto, ReportReason, ThreadDto } from '../../lib/api/chat'
import { attachmentMeta, fmtClock, fmtReceipt, interestClock, monogram, type ClockReading } from '../../lib/chat/format'

/**
 * The shared visual atoms of the interests / connections / chat flow (F08), the
 * app twin of apostrophe-user's components/chat/parts.tsx. One copy of each, so
 * the thread list and the four thread boards draw the same bubble, plate and
 * delivery mark.
 *
 * SC-16 lives in `CounterpartyPlate`: a masked interviewer is the Apostrophe mark
 * and never a face; a company is a rounded SQUARE monogram; a person is a CIRCLE.
 * Shape is the semantic.
 */

// ── icons ─────────────────────────────────────────────────────────────────
function Stroke({ size = 16, stroke, children }: { size?: number; stroke: string; children: React.ReactNode }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
}
const Check = ({ size = 12, stroke }: { size?: number; stroke: string }) => <Stroke size={size} stroke={stroke}><Path d="M20 6 9 17l-5-5" /></Stroke>
const CloudDown = ({ stroke }: { stroke: string }) => <Stroke size={12} stroke={stroke}><Path d="M12 13v8" /><Path d="m8 17 4 4 4-4" /><Path d="M20 16.6A5 5 0 0 0 17 8h-1.3A8 8 0 1 0 4 15.9" /></Stroke>
const ClockGlyph = ({ stroke }: { stroke: string }) => <Stroke size={12} stroke={stroke}><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></Stroke>
const DocGlyph = ({ stroke }: { stroke: string }) => <Stroke size={20} stroke={stroke}><Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><Path d="M14 3v5h5" /></Stroke>
const ImageGlyph = ({ stroke }: { stroke: string }) => <Stroke size={24} stroke={stroke}><Rect x={3} y={4} width={18} height={16} rx={2} /><Circle cx={9} cy={10} r={1.6} /><Path d="m4 17 5-4 4 3 3-2 4 3" /></Stroke>
export const OfflineWifi = ({ stroke = color.warning }: { stroke?: string }) => <Stroke size={14} stroke={stroke}><Path d="M3 3 21 21" /><Path d="M8.5 16.5a5 5 0 0 1 7 0" /><Path d="M5 13a10 10 0 0 1 3.2-2.1M19 13a10 10 0 0 0-7.6-2.9" /><Path d="M2 8.8A15 15 0 0 1 7 6M22 8.8a15 15 0 0 0-8.6-2.7" /><Path d="M12 20h.01" /></Stroke>
function Lifebuoy({ stroke }: { stroke: string }) {
  return <Stroke size={20} stroke={stroke}><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={3.6} /><Path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></Stroke>
}
/** The photo that was never sent — a drawn head and shoulders in the hairline grey. */
function PersonFigure({ size }: { size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 64 64" fill={color.textSubtle}><Circle cx={32} cy={24.5} r={11} /><Path d="M11 64c0-12.7 9.4-21 21-21s21 8.3 21 21z" /></Svg>
}

/** A company mark — a rounded SQUARE monogram (a company is never a circle). */
export function CompanyMark({ name, size = 44 }: { name: string | null | undefined; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted, borderRadius: radius.md }}>
      <Text style={[size >= 44 ? text.metaLg : text.metaMd, styles.monogram]}>{monogram(name)}</Text>
    </View>
  )
}

// ── the counterparty plate (SC-16) ───────────────────────────────────────────
export function CounterpartyPlate({ thread, size = 44 }: { thread: Pick<ThreadDto, 'kind' | 'counterparty'>; size?: number }) {
  const { kind, counterparty } = thread
  const base = { width: size, height: size, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: borderWidth.thin }
  if (kind === 'USER_ADMIN') {
    return <View style={[base, { borderRadius: radius.pill, backgroundColor: color.infoSoft, borderColor: color.infoSoft }]}><Lifebuoy stroke={color.info} /></View>
  }
  if (kind === 'STUDENT_INTERVIEWER') {
    if (counterparty.masked) {
      return <View style={[base, { borderRadius: radius.pill, backgroundColor: color.surfaceMuted, borderColor: color.border }]}><LogoMark size={Math.round(size * 0.45)} fill={color.ink} /></View>
    }
    return <View style={[base, { borderRadius: radius.pill, backgroundColor: color.surfaceMuted, borderColor: color.border, overflow: 'hidden' }]}><PersonFigure size={size} /></View>
  }
  return (
    <View style={[base, { borderRadius: radius.md, backgroundColor: color.surfaceMuted, borderColor: color.border }]}>
      <Text style={[size >= 44 ? text.metaLg : text.metaMd, styles.monogram]}>{monogram(counterparty.name)}</Text>
    </View>
  )
}

// ── transcript pieces ────────────────────────────────────────────────────────
export function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <Divider style={styles.rule} />
      <Meta style={{ color: color.textSubtle }}>{label}</Meta>
      <Divider style={styles.rule} />
    </View>
  )
}

export function SystemLine({ text, time, media }: { text: string; time?: string; media?: React.ReactNode }) {
  return (
    <View style={styles.systemLine}>
      {media}
      <Meta style={{ color: color.textMuted, textAlign: 'center' }}>{text}</Meta>
      {!!time && <Meta style={{ color: color.textSubtle }}>{time}</Meta>}
    </View>
  )
}

export type DeliveryState = 'queued' | 'sent' | 'delivered' | 'read'

/** The mono delivery readout under a sent (mine) bubble. Never a red dot. */
export function DeliveryMark({ state, at, now }: { state: DeliveryState; at?: string | null; now: number }) {
  const map = {
    queued: { c: color.info, node: <CloudDown stroke={color.info} />, label: 'Queued · offline' },
    sent: { c: color.textSubtle, node: <Spinner />, label: 'Sent · not delivered' },
    delivered: { c: color.textSubtle, node: <Check stroke={color.textSubtle} />, label: at ? fmtReceipt('Delivered', at, now) : 'Delivered' },
    read: { c: color.textMuted, node: <Check stroke={color.textMuted} />, label: at ? fmtReceipt('Read', at, now) : 'Read' },
  }[state]
  return (
    <View style={styles.deliveryRow}>
      {map.node}
      <Meta style={{ color: map.c }}>{map.label}</Meta>
    </View>
  )
}
function Spinner() {
  return <View style={styles.spinner} />
}

/** One message. `mine` decides the side; the server never sends a sender name. */
export function Bubble({ msg, now }: { msg: MessageDto; now: number }) {
  const mine = msg.mine
  const corner = mine
    ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.sm, borderBottomLeftRadius: radius.lg }
    : { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.sm }
  const delivery: DeliveryState | null = !mine ? null : msg.readAt ? 'read' : msg.deliveredAt ? 'delivered' : 'sent'

  return (
    <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      {msg.kind === 'ATTACHMENT' && msg.attachment ? (
        <AttachmentBubble msg={msg} mine={mine} corner={corner} />
      ) : (
        <View style={[styles.bubble, corner, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Body size="base" style={{ color: mine ? color.textInverse : color.text }}>{msg.body}</Body>
        </View>
      )}
      {mine
        ? delivery && <DeliveryMark state={delivery} at={msg.readAt ?? msg.deliveredAt} now={now} />
        : <Meta style={{ color: color.textSubtle, paddingLeft: space.xs }}>{fmtClock(msg.createdAt)}</Meta>}
    </View>
  )
}

function AttachmentBubble({ msg, mine, corner }: { msg: MessageDto; mine: boolean; corner: object }) {
  const att = msg.attachment!
  const skin = mine ? styles.bubbleMine : styles.bubbleTheirs
  if (att.kind === 'IMAGE') {
    return (
      <View style={[styles.imageBubble, corner, skin]}>
        <View style={styles.imageBox}><ImageGlyph stroke={color.textSubtle} /></View>
        <Meta style={{ color: color.textMuted, paddingHorizontal: space.xs }}>{attachmentMeta(att)}</Meta>
      </View>
    )
  }
  return (
    <View style={[styles.docBubble, corner, skin]}>
      <DocGlyph stroke={color.textSubtle} />
      <View style={{ flexShrink: 1 }}>
        <Body size="sm" weight="medium" style={{ color: color.text }} numberOfLines={1}>{att.fileName ?? 'Attachment'}</Body>
        <Meta style={{ color: color.textSubtle }}>{attachmentMeta(att)}</Meta>
      </View>
    </View>
  )
}

/** The three resting dots. No "is typing" sentence, no presence — there is none. */
export function TypingDots() {
  return (
    <View style={[styles.bubble, styles.bubbleTheirs, styles.typing, { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.sm }]}>
      <View style={[styles.dot, { backgroundColor: color.border }]} />
      <View style={[styles.dot, { backgroundColor: color.borderStrong }]} />
      <View style={[styles.dot, { backgroundColor: color.textSubtle }]} />
    </View>
  )
}

export function ReconnectingStrip() {
  return (
    <View style={styles.reconnect}>
      <OfflineWifi />
      <Meta style={{ color: color.warning }}>Reconnecting · nothing is lost</Meta>
    </View>
  )
}

/** The composer's replacement bar on a read-only / archived thread (CH-05). */
export function ReadOnlyFoot({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.readOnlyFoot}>
      <Body size="sm" weight="semibold" style={{ color: color.text }}>{title}</Body>
      <Body size="xs" tone="muted" style={{ marginTop: space.xs }}>{body}</Body>
    </View>
  )
}

/** The standing mono line under a masked interviewer header, explained positively. */
export function MaskInfoLine() {
  return (
    <View style={styles.maskInfo}>
      <Meta style={{ color: color.info }}>Assigned anonymously so nobody can pick or avoid one · named when your session starts</Meta>
      <Body size="xs" style={{ color: color.text, marginTop: space.sm }}>Every student gets the interviewer they would have got anyway. We do not send their name or photo to your phone before the session, so nobody can pick or avoid one.</Body>
    </View>
  )
}

export function ClosesLine({ text }: { text: string }) {
  return <View style={{ paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.sm }}><Meta style={{ color: color.textSubtle }}>{text}</Meta></View>
}

// ── the composer ──────────────────────────────────────────────────────────
/**
 * A field and Send. No microphone, waveform or call glyph — CHAT_MESSAGE_KINDS
 * has no fourth kind. Attachments (CH-08) are sent from the web for now; the app
 * picker is a follow-up, and a dead paperclip is a defect, so none is drawn.
 */
export function Composer({ value, busy, error, onChange, onSend }: {
  value: string; busy: boolean; error: string | null; onChange: (v: string) => void; onSend: () => void
}) {
  const canSend = value.trim().length > 0 && !busy
  return (
    <View style={styles.composer}>
      {!!error && <Body size="xs" style={{ color: color.danger, marginBottom: space.sm }}>{error}</Body>}
      <View style={styles.composerRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Message"
          placeholderTextColor={color.textSubtle}
          multiline
          style={styles.input}
        />
        <IconButton tone="accent" label="Send" disabled={!canSend} onPress={onSend} style={{ opacity: canSend ? 1 : 0.4 }}>
          <Stroke size={20} stroke={color.textInverse}><Path d="M4 12h15" /><Path d="m13 6 6 6-6 6" /></Stroke>
        </IconButton>
      </View>
    </View>
  )
}

// ── the block confirmation sheet (CN-05) ─────────────────────────────────────
export function BlockSheet({ open, name, busy, onConfirm, onClose }: { open: boolean; name: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Block ${name}?`}>
      <View style={styles.consequences}>
        <Consequence label="Right away" body="This chat stays archived, and closed to both of you for good." />
        <Consequence label="Permanently" body={`${name} never sees your profile in the feed again, and cannot send you an Interest.`} />
        <Consequence label="Not undoable" body="Not from here. Support can, and will ask why." />
      </View>
      <Body size="xs" tone="muted" style={{ marginTop: space.md }}>{name} is not told. A block and a withdrawal look the same from the other side.</Body>
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <Button variant="destructive" size="block" full busy={busy} label={`Block ${name}`} onPress={onConfirm} />
        <Button variant="quiet" size="block" full label="Keep the connection" onPress={onClose} />
      </View>
    </Sheet>
  )
}
function Consequence({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.consequence}>
      <View style={styles.sysLabel}><Eyebrow>{label}</Eyebrow></View>
      <Body size="sm" style={{ flex: 1, color: color.text }}>{body}</Body>
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
      <View style={{ marginTop: space.sm }}>
        <Pressable onPress={onReport} style={styles.menuItem}><Stroke size={16} stroke={color.textMuted}><Path d="M5 21V4" /><Path d="M5 5h11l-2 3.5L16 12H5" /></Stroke><Body size="sm" style={{ color: color.text }}>Report this chat</Body></Pressable>
        {isInterviewer && <Pressable onPress={onSupport} style={styles.menuItem}><Stroke size={16} stroke={color.textMuted}><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={3.6} /></Stroke><Body size="sm" style={{ color: color.text }}>Message support</Body></Pressable>}
        {canBlock && <Pressable onPress={onBlock} style={styles.menuItem}><Stroke size={16} stroke={color.danger}><Circle cx={12} cy={12} r={9} /><Path d="m5.6 5.6 12.8 12.8" /></Stroke><Body size="sm" style={{ color: color.danger }}>{`Block ${name}`}</Body></Pressable>}
      </View>
    </Sheet>
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
      <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>The conversation is frozen as evidence. {name} is not told you reported it.</Body>
      <View style={styles.reasonWrap}>
        {REPORT_REASONS.map((r) => <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder="Anything you want to add (optional)" placeholderTextColor={color.textSubtle} multiline style={styles.noteInput} />
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <Button variant="primary" size="block" full disabled={!reason} label="Send report" onPress={() => reason && onSubmit(reason, note)} />
        <Button variant="quiet" size="block" full label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  )
}

/** The recording pill — one of crimson's four jobs (live/recording). */
export function RecordingPill() {
  return <StatusPill tone="accent" dot label="Recording" />
}

const CLOCK: Record<Exclude<ClockReading, 'spent'>, { bg: string; fg: string; fill: string; abs: string }> = {
  fresh: { bg: color.surfaceSunken, fg: color.textMuted, fill: color.borderStrong, abs: color.textSubtle },
  soon: { bg: color.warningSoft, fg: color.warning, fill: color.warning, abs: color.warning },
  urgent: { bg: color.warning, fg: color.textInverse, fill: color.warning, abs: color.warning },
}

/** The fourteen-day Interest clock — one component, four readings; the rule fills as time is used. */
export function InterestClock({ sentAt, expiresAt, now }: { sentAt: string; expiresAt: string; now: number }) {
  const c = interestClock(sentAt, expiresAt, now)
  const t = CLOCK[c.reading === 'spent' ? 'urgent' : c.reading]
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.clockRow}>
        <View style={[styles.clockPill, { backgroundColor: t.bg }]}>
          <ClockGlyph stroke={t.fg} />
          <Text style={[styles.clockPillText, { color: t.fg }]}>{c.relative.toUpperCase()}</Text>
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space['2xs'] },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  clockPill: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], borderRadius: radius.pill, paddingHorizontal: spaceHalf['2.5'], paddingVertical: space.xs },
  clockPillText: { ...text.metaMd, letterSpacing: trackingNative.meta },
  clockTrack: { height: height['step-bar'] - 1, borderRadius: radius.pill, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  rule: { flex: 1 },
  systemLine: { alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.xs },
  spinner: { width: space.md, height: space.md, borderRadius: radius.pill, borderWidth: borderWidth.accent, borderColor: color.borderStrong, borderTopColor: color.textSubtle },
  bubbleWrap: { gap: space.xs },
  bubble: { maxWidth: height['bubble-max'], paddingHorizontal: spaceHalf['3.5'], paddingVertical: spaceHalf['2.5'] },
  imageBubble: { width: height['bubble-image-w'], padding: space.xs, gap: space.xs },
  sysLabel: { width: height['label-col'], paddingTop: space['2xs'] },
  monogram: { color: color.textMuted, letterSpacing: trackingNative.meta },
  bubbleMine: { backgroundColor: color.accent },
  bubbleTheirs: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  docBubble: { maxWidth: height['bubble-max'], flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: spaceHalf['3.5'], paddingVertical: spaceHalf['2.5'] },
  imageBox: { height: height['bubble-image-h'], alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: color.surfaceSunken, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  typing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: spaceHalf['3.5'] },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill },
  reconnect: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.warningSoft, paddingHorizontal: space.xl, paddingVertical: space.sm },
  readOnlyFoot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surfaceSunken, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  maskInfo: { backgroundColor: color.infoSoft, paddingHorizontal: space.xl, paddingVertical: space.md },
  composer: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: space.md, paddingVertical: spaceHalf['2.5'] },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: height.tap, maxHeight: height['composer-max'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, paddingHorizontal: space.lg, paddingVertical: space.sm + space['2xs'], ...text.uiBase, color: color.text },
  consequences: { marginTop: space.lg, backgroundColor: color.surfaceMuted, borderRadius: radius.md, padding: spaceHalf['3.5'], gap: space.md },
  consequence: { flexDirection: 'row', gap: space.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: height.tap, paddingHorizontal: space.sm },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  noteInput: { marginTop: space.md, minHeight: height['note-field'], borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, paddingHorizontal: space.md, paddingVertical: space.sm, ...text.uiSm, color: color.text, textAlignVertical: 'top' },
})
