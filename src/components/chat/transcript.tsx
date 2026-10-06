import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native'
import { borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf } from '../../theme'
import { text } from '../ui/typography'
import { Icon } from '../ui/Icon'
import { EmptyState } from '../ui/states'
import type { MessageDto, ThreadKind } from '../../lib/api/chat'
import {
  attachmentExt, attachmentMeta, fmtClock, fmtDayDivider, receiptLabel, systemLineText, type ChatViewer,
} from '../../lib/chat/format'

/**
 * ONE BUBBLE for all three apps (docs/chat-redesign-mockups.html, A): mine in
 * the accent with white text and the tail bottom-right, theirs white with a
 * hairline and the tail bottom-left. Messages from one side in a row are a run
 * — 3 apart inside it, 8 between runs — and only the LAST bubble of a run
 * carries the time ("6:02 PM"; mine add "· Read" / "· Delivered" / "· Sent").
 */

/** The run spacing: inside a run, and between two runs. */
const IN_RUN = space['2xs'] + 1
const BETWEEN_RUNS = space.sm

/** Opens a signed attachment link in the phone's viewer. The link expires; a failure just does nothing. */
const openUrl = (url: string | null) => {
  if (url) Linking.openURL(url).catch(() => {})
}

function AttachmentBody({ m }: { m: MessageDto }) {
  const att = m.attachment!
  const [broken, setBroken] = useState(false)
  if (att.kind === 'IMAGE') {
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo${att.fileName ? `, ${att.fileName}` : ''}. Opens it`}
        disabled={!att.url}
        onPress={() => openUrl(att.url)}
        style={({ pressed }) => pressed && s.pressed}
      >
        {att.url && !broken ? (
          <Image source={{ uri: att.url }} style={s.image} resizeMode="cover" onError={() => setBroken(true)} />
        ) : (
          <View style={[s.image, s.imageMissing]}>
            <Icon name="image" size={height.glyph} tint={color.textSubtle} />
            <Text style={text.metaSm}>{attachmentMeta(att)}</Text>
          </View>
        )}
      </Pressable>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${att.fileName ?? 'Document'}, ${attachmentMeta(att)}. Opens it`}
      disabled={!att.url}
      onPress={() => openUrl(att.url)}
      style={({ pressed }) => [s.doc, pressed && s.pressed]}
    >
      <View style={s.docTile}><Text style={s.docTileText}>{attachmentExt(att) ?? 'File'}</Text></View>
      <View style={s.docText}>
        <Text style={[s.docName, m.mine && s.onAccent]} numberOfLines={1}>{att.fileName ?? 'Document'}</Text>
        <Text style={[s.docMeta, m.mine && s.onAccentSoft]}>{attachmentMeta(att)}</Text>
      </View>
    </Pressable>
  )
}

/** One message. `last` closes a run and draws its time (and, for mine, the receipt). */
export function Bubble({ m, last, sending }: { m: MessageDto; last: boolean; sending?: boolean }) {
  const mine = m.mine
  const image = m.kind === 'ATTACHMENT' && m.attachment?.kind === 'IMAGE'
  return (
    <View style={[s.wrap, mine ? s.wrapMine : s.wrapTheirs]}>
      <View style={[s.bubble, mine ? s.mine : s.theirs, image && s.imageBubble]}>
        {m.kind === 'ATTACHMENT' && m.attachment ? <AttachmentBody m={m} /> : null}
        {!!m.body && <Text style={[text.uiBase, mine && s.onAccent, m.attachment && s.caption]}>{m.body}</Text>}
      </View>
      {last && (
        <Text style={[text.metaSm, s.meta]}>
          {mine ? `${fmtClock(m.createdAt)} · ${receiptLabel(m, sending)}` : fmtClock(m.createdAt)}
        </Text>
      )}
    </View>
  )
}

/** Hairline – "Yesterday" – hairline. */
export function DayDivider({ label }: { label: string }) {
  return (
    <View style={s.day} accessibilityRole="header">
      <View style={s.rule} />
      <Text style={[text.metaSm, s.dayText]}>{label}</Text>
      <View style={s.rule} />
    </View>
  )
}

/** A quiet grey pill the product writes into the conversation. */
export function SystemLine({ label, media, time }: { label: string; media?: React.ReactNode; time?: string }) {
  return (
    <View style={s.sys}>
      {media}
      <Text style={s.sysText}>{label}</Text>
      {!!time && <Text style={[text.metaSm, s.sysTime]}>{time}</Text>}
    </View>
  )
}

/** Three dots that bounce in their bubble while the other side types. No sentence, no presence — there is none. */
export function TypingBubble() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current
  useEffect(() => {
    const step = 150
    const loops = dots.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * step),
      Animated.timing(v, { toValue: 1, duration: step * 2, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: step * 2, useNativeDriver: true }),
      Animated.delay((2 - i) * step + step),
    ])))
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots])
  return (
    <View accessibilityLabel="Typing" style={[s.wrap, s.wrapTheirs, { marginTop: BETWEEN_RUNS }]}>
      <View style={[s.bubble, s.theirs, s.typing]}>
        {dots.map((v, i) => (
          <Animated.View key={i} style={[s.dot, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -space.xs] }) }] }]} />
        ))}
      </View>
    </View>
  )
}

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'system'; key: string; m: MessageDto }
  | { type: 'bubble'; key: string; m: MessageDto; first: boolean; last: boolean; afterBubble: boolean }

function itemsOf(messages: MessageDto[], now: number): Item[] {
  const out: Item[] = []
  let day = ''
  const labels = messages.map((m) => fmtDayDivider(m.createdAt, now))
  messages.forEach((m, i) => {
    const label = labels[i]
    if (label !== day) {
      out.push({ type: 'day', key: `day-${label}`, label })
      day = label
    }
    if (m.kind === 'SYSTEM') {
      out.push({ type: 'system', key: m.id, m })
      return
    }
    const same = (j: number) => {
      const o = messages[j]
      return !!o && o.kind !== 'SYSTEM' && o.mine === m.mine && labels[j] === label
    }
    const prevItem = out[out.length - 1]
    out.push({ type: 'bubble', key: m.id, m, first: !same(i - 1), last: !same(i + 1), afterBubble: prevItem?.type === 'bubble' })
  })
  return out
}

/** Scroll behaviour, in points (not drawn sizes): how near the bottom still counts as "reading the newest", and how near the top fetches the page before. */
const END_SLACK = 96
const OLDER_SLACK = 320

/**
 * The scrolling conversation. It opens at the newest line and goes back there
 * on each `endSignal` (a send, a reload); a new message scrolls it down only
 * while you are reading the bottom. Scrolling to the top fetches the page
 * before, which lands above without moving what you are reading.
 */
export function Transcript({
  messages, sending, threadKind, viewer, now, peerTyping, hasOlder, older, onLoadOlder, endSignal, renderSystem,
}: {
  messages: MessageDto[]
  sending: ReadonlySet<string>
  threadKind: ThreadKind
  viewer: ChatViewer
  now: number
  peerTyping: boolean
  hasOlder: boolean
  older: 'idle' | 'loading' | 'failed'
  onLoadOlder: () => void
  endSignal: number
  /** A screen's own drawing of a system line it says differently (the student's reveal); null falls back to the pill. */
  renderSystem?: (m: MessageDto) => React.ReactNode | null
}) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const atEnd = useRef(true)
  const forceEnd = useRef(true)
  const dragged = useRef(false)

  useEffect(() => {
    forceEnd.current = true
    atEnd.current = true
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: false }))
  }, [endSignal])

  function onContentSizeChange() {
    if (forceEnd.current) {
      ref.current?.scrollToEnd({ animated: false })
      forceEnd.current = false
    } else if (atEnd.current) {
      ref.current?.scrollToEnd({ animated: true })
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    atEnd.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < END_SLACK
    if (dragged.current && contentOffset.y < OLDER_SLACK && hasOlder && older === 'idle') onLoadOlder()
  }

  const items = itemsOf(messages, now)

  return (
    <ScrollView
      ref={ref}
      style={s.scroll}
      contentContainerStyle={s.content}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      onScrollBeginDrag={() => { dragged.current = true }}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      // Index 0 is the "earlier messages" slot; the first message under it holds still while a page lands above.
      maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
    >
      <View style={s.olderSlot}>
        {older === 'loading' ? (
          <ActivityIndicator color={color.textSubtle} accessibilityLabel="Loading earlier messages" />
        ) : older === 'failed' ? (
          <Pressable accessibilityRole="button" onPress={onLoadOlder} hitSlop={space.sm}>
            <Text style={[text.metaSm, s.olderText]}>Earlier messages did not load. Tap to try again.</Text>
          </Pressable>
        ) : hasOlder ? (
          <Pressable accessibilityRole="button" onPress={onLoadOlder} hitSlop={space.sm}>
            <Text style={[text.metaSm, s.olderText]}>Earlier messages</Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 && !peerTyping ? (
        <EmptyState title="No messages yet" body="Nothing has been sent in this conversation yet." />
      ) : (
        items.map((it) => {
          if (it.type === 'day') return <DayDivider key={it.key} label={it.label} />
          if (it.type === 'system') {
            const own = renderSystem?.(it.m)
            return <View key={it.key}>{own ?? <SystemLine label={systemLineText(it.m, threadKind, viewer)} />}</View>
          }
          return (
            <View key={it.key} style={{ marginTop: it.first && it.afterBubble ? BETWEEN_RUNS : IN_RUN }}>
              <Bubble m={it.m} last={it.last} sending={sending.has(it.m.id)} />
            </View>
          )
        })
      )}
      {peerTyping && <TypingBubble />}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: spaceHalf['3.5'], paddingTop: spaceHalf['3.5'], paddingBottom: spaceHalf['2.5'] },
  olderSlot: { alignItems: 'center', paddingBottom: space.xs },
  olderText: { color: color.textMuted, textAlign: 'center' },

  wrap: { maxWidth: '78%' },
  wrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingVertical: space.sm, paddingHorizontal: space.md },
  mine: {
    backgroundColor: color.accent,
    borderTopLeftRadius: radius['card-lg'], borderTopRightRadius: radius['card-lg'], borderBottomRightRadius: radius.tail, borderBottomLeftRadius: radius['card-lg'],
  },
  theirs: {
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
    borderTopLeftRadius: radius['card-lg'], borderTopRightRadius: radius['card-lg'], borderBottomRightRadius: radius['card-lg'], borderBottomLeftRadius: radius.tail,
  },
  onAccent: { color: color.textInverse },
  onAccentSoft: { color: color.accentMuted },
  caption: { marginTop: space.sm },
  meta: { marginTop: space['2xs'] + 1, marginHorizontal: space.xs },

  imageBubble: { padding: space.xs },
  image: { width: height['bubble-image-w'], aspectRatio: 4 / 3, borderRadius: radius.panel, backgroundColor: color.surfaceSunken },
  imageMissing: { alignItems: 'center', justifyContent: 'center', gap: space.xs },

  doc: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], minWidth: height['bubble-image-w'] },
  docTile: { width: height['avatar-lg'], height: height['control-compact'], borderRadius: radius.ctl, backgroundColor: color.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  docTileText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-2xs'], color: color.danger },
  docText: { flexShrink: 1 },
  docName: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.text },
  docMeta: { fontFamily: FF.body, fontSize: fontSize['meta-md'], fontVariant: ['tabular-nums'], color: color.textMuted },

  day: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], marginTop: space.md, marginBottom: spaceHalf['1.5'] },
  rule: { flex: 1, height: borderWidth.thin, backgroundColor: color.border },
  dayText: { color: color.textMuted },

  sys: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: space.sm, maxWidth: '92%',
    backgroundColor: color.surfaceMuted, borderRadius: radius.pill, paddingVertical: space.xs + 1, paddingHorizontal: space.md, marginVertical: spaceHalf['2.5'],
  },
  sysText: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.textMuted, textAlign: 'center' },
  sysTime: { color: color.textSubtle },

  typing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  dot: { width: space.sm - 1, height: space.sm - 1, borderRadius: radius.pill, backgroundColor: color.textSubtle },
})
