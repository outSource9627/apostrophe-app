import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { color, space, spaceHalf, radius, borderWidth, height, trackingNative, fontFamilyNative as FF } from '../../theme'
import { text } from '../../components/ui/typography'
import { Body, Meta } from '../../components/ui/Type'
import { Chip, Sheet, StatusPill } from '../../components/ui'
import { Btn } from '../../components/tab/kit'
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
  return <Text style={styles.day}>{label.toUpperCase()}</Text>
}

/** A quiet pill in the transcript: "This chat opened for your interview", "Your session started · …". */
export function SystemLine({ text, time, media }: { text: string; time?: string; media?: React.ReactNode }) {
  return (
    <View style={styles.systemLine}>
      {media}
      <Text style={styles.systemText}>{text}</Text>
      {!!time && <Text style={styles.systemTime}>{time}</Text>}
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
    ? { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 4, borderBottomLeftRadius: 18 }
    : { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4 }
  const delivery: DeliveryState | null = !mine ? null : msg.readAt ? 'read' : msg.deliveredAt ? 'delivered' : 'sent'

  return (
    <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      {msg.kind === 'ATTACHMENT' && msg.attachment ? (
        <AttachmentBubble msg={msg} mine={mine} corner={corner} />
      ) : (
        <View style={[styles.bubble, corner, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, { color: mine ? color.textInverse : color.text }]}>{msg.body}</Text>
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

/** Three dots that bounce while the other side types. No "is typing" sentence, no presence — there is none. */
export function TypingDots() {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0))).current
  useEffect(() => {
    const loops = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.delay(450 - i * 150),
    ])))
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [vals])
  return (
    <View accessibilityLabel="Typing" style={[styles.bubble, styles.bubbleTheirs, styles.typing, { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4 }]}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]} />
      ))}
    </View>
  )
}

/** Above the transcript while the socket is down: nothing is lost, a sent message goes out on reconnect. */
export function ReconnectingStrip() {
  return (
    <View accessibilityRole="alert" style={styles.reconnect}>
      <OfflineWifi />
      <Text style={styles.reconnectText}>Reconnecting · nothing is lost</Text>
    </View>
  )
}

/** The composer's replacement bar on a read-only / archived thread (CH-05). */
export function ReadOnlyFoot({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.readOnlyFoot}>
      <Text style={styles.readTitle}>{title}</Text>
      <Text style={styles.readBody}>{body}</Text>
    </View>
  )
}

/** The standing note under a masked interviewer header, explained positively. */
export function MaskInfoLine() {
  return (
    <View style={styles.maskInfo}>
      <Text style={styles.maskTitle}>Assigned anonymously so nobody can pick or avoid one · named when your session starts</Text>
      <Text style={styles.maskBody}>Every student gets the interviewer they would have got anyway. We do not send their name or photo to your phone before the session, so nobody can pick or avoid one.</Text>
    </View>
  )
}

export function ClosesLine({ text }: { text: string }) {
  return <View style={{ paddingHorizontal: space.xl, paddingTop: 6, paddingBottom: 8 }}><Text style={styles.closes}>{text}</Text></View>
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
      {!!error && <Text style={styles.composerError}>{error}</Text>}
      <View style={styles.composerRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Message"
          placeholderTextColor={color.textSubtle}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={[styles.send, { opacity: canSend ? 1 : 0.4 }]}
        >
          <Stroke size={20} stroke={color.textInverse}><Path d="M4 12h15" /><Path d="m13 6 6 6-6 6" /></Stroke>
        </Pressable>
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
      <Text style={styles.consLabel}>{label.toUpperCase()}</Text>
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
        <MenuItem onPress={onReport} label="Report this chat" tint={color.textSecondary} bg={color.surfaceMuted}>
          <Stroke size={18} stroke={color.textSecondary}><Path d="M5 21V4" /><Path d="M5 5h11l-2 3.5L16 12H5" /></Stroke>
        </MenuItem>
        {isInterviewer && (
          <MenuItem onPress={onSupport} label="Message support" tint={color.textSecondary} bg={color.surfaceMuted}>
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
  day: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.26, color: color.textSubtle, textAlign: 'center', marginVertical: 4 },
  systemLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 10, backgroundColor: color.surfaceMuted, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  systemText: { flexShrink: 1, fontFamily: FF.body, fontSize: 13, color: color.textMuted, textAlign: 'center' },
  systemTime: { fontFamily: FF.monoMedium, fontSize: 10.5, color: color.textSubtle },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.xs },
  spinner: { width: space.md, height: space.md, borderRadius: radius.pill, borderWidth: borderWidth.accent, borderColor: color.borderStrong, borderTopColor: color.textSubtle },
  bubbleWrap: { gap: space.xs },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10 },
  bubbleText: { fontFamily: FF.body, fontSize: 15, lineHeight: 21 },
  imageBubble: { width: height['bubble-image-w'], padding: space.xs, gap: space.xs },
  sysLabel: { width: height['label-col'], paddingTop: space['2xs'] },
  monogram: { color: color.textMuted, letterSpacing: trackingNative.meta },
  bubbleMine: { backgroundColor: color.accent },
  bubbleTheirs: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  docBubble: { maxWidth: height['bubble-max'], flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: spaceHalf['3.5'], paddingVertical: spaceHalf['2.5'] },
  imageBox: { height: height['bubble-image-h'], alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: color.surfaceSunken, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.textSubtle },
  reconnect: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.warningSoft, borderBottomWidth: borderWidth.thin, borderBottomColor: color.warningEdge, paddingHorizontal: 20, paddingVertical: 9 },
  reconnectText: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: color.warning },
  readOnlyFoot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
  readTitle: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  readBody: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted, marginTop: 3 },
  maskInfo: { backgroundColor: color.infoSoft, borderRadius: 14, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 11 },
  maskTitle: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase', color: color.info },
  maskBody: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.info, marginTop: 4 },
  closes: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase', color: color.textSubtle },
  composer: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerError: { fontFamily: FF.body, fontSize: 13, color: color.danger, marginBottom: 8 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 46, maxHeight: height['composer-max'], borderRadius: 23, borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface, paddingHorizontal: 16, paddingVertical: 11, fontFamily: FF.body, fontSize: 15, color: color.text },
  consequences: { marginTop: 14, gap: 8 },
  consequence: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  consLabel: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, color: color.textMuted },
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
