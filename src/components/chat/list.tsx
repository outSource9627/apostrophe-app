import React, { useRef } from 'react'
import { Animated, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { borderWidth, color, fontFamilyNative as FF, fontSize, height, opacity, radius, space, spaceHalf } from '../../theme'
import { text } from '../ui/typography'
import { Icon } from '../ui/Icon'
import { measureAnchor, type MenuAnchor } from '../ui/overlay'
import { LargeTitle, SkeletonRows, useCollapsingTitle } from '../tab/kit'
import type { MessageSearchHit } from '../../lib/api/chat'
import { fmtClock, fmtDayMon } from '../../lib/chat/format'
import { BackButton, ReconnectingStrip } from './controls'

/**
 * ONE list row for all three apps (docs/chat-redesign-mockups.html, A): the
 * plate, the name (bold while unread, grey when the chat is read-only), a
 * pushpin when pinned, the time (violet while unread), the last line (dark
 * while unread), the violet count, and a quiet sentence-case line saying what
 * the chat is. A long press opens the pin menu where the app has pinning.
 */
export function ChatRow({ plate, name, pinned, time, unread, preview, context, muted, onPress, onMenu, menuLabel }: {
  plate: React.ReactNode
  name: string
  pinned?: boolean
  time?: string | null
  unread: number
  preview: string
  context?: string | null
  muted?: boolean
  onPress: () => void
  /** Long press: the row's menu, opened at the finger. Absent where there is nothing to pin. */
  onMenu?: (anchor: MenuAnchor) => void
  /** The long-press action's name, read out by a screen reader ("Pin chat"). */
  menuLabel?: string
}) {
  const ref = useRef<React.ComponentRef<typeof View>>(null)
  const isUnread = unread > 0
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${name}${pinned ? ', pinned' : ''}${isUnread ? `, ${unread} unread` : ''}`}
      accessibilityHint={onMenu ? 'Long press to pin or unpin' : undefined}
      accessibilityActions={onMenu ? [{ name: 'longpress', label: menuLabel ?? 'More' }] : undefined}
      onAccessibilityAction={onMenu ? (e) => { if (e.nativeEvent.actionName === 'longpress') measureAnchor(ref.current).then((a) => a && onMenu(a)) } : undefined}
      onPress={onPress}
      onLongPress={onMenu ? (e) => onMenu({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, width: 0, height: 0 }) : undefined}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      {plate}
      <View style={s.body}>
        <View style={s.top}>
          <Text style={[s.name, isUnread && s.nameUnread, muted && s.nameMuted]} numberOfLines={1}>{name}</Text>
          {pinned && <Icon name="pushpin" size={spaceHalf['3.5']} tint={color.textSubtle} weight={2} />}
          {!!time && <Text style={[text.metaSm, isUnread && s.timeUnread]}>{time}</Text>}
        </View>
        <View style={s.mid}>
          <Text style={[s.preview, isUnread && s.previewUnread]} numberOfLines={1}>{preview}</Text>
          {isUnread && <View style={s.badge}><Text style={s.badgeText}>{String(unread)}</Text></View>}
        </View>
        {!!context && <Text style={[text.metaSm, s.context]} numberOfLines={1}>{context}</Text>}
      </View>
    </Pressable>
  )
}

/** "Search people and messages" — the same field on all three lists. */
export function ChatSearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.search}>
      <Icon name="search" size={spaceHalf['4.5']} tint={color.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search people and messages"
        placeholderTextColor={color.textSubtle}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search people and messages"
        style={s.searchInput}
      />
      {!!value && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={space.sm} onPress={() => onChange('')}>
          <Icon name="x" size={space.lg} tint={color.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

/** A quiet grey label over a group in the list — "Messages", "Conversations". */
function GroupLabel({ children }: { children: string }) {
  return <Text style={[text.metaSm, s.groupLabel]}>{children}</Text>
}

/** Messages that matched the search, above the conversations whose name did. */
function SearchHits({ hits, nameOf, onOpen }: { hits: MessageSearchHit[]; nameOf: (threadId: string) => string; onOpen: (threadId: string) => void }) {
  return (
    <View>
      <GroupLabel>Messages</GroupLabel>
      {hits.map((h) => (
        <Pressable key={h.id} accessibilityRole="button" onPress={() => onOpen(h.threadId)} style={({ pressed }) => [s.hit, pressed && s.pressed]}>
          <Text style={[text.uiSmSemi, s.hitName]} numberOfLines={1}>{nameOf(h.threadId)}</Text>
          <Text style={[text.uiSm, s.muted]} numberOfLines={2}>{`${h.mine ? 'You: ' : ''}${h.body ?? ''}`}</Text>
          <Text style={text.metaSm}>{`${fmtDayMon(h.createdAt)} · ${fmtClock(h.createdAt)}`}</Text>
        </Pressable>
      ))}
    </View>
  )
}

/** The large title folded into a bar once the list scrolls under it. */
function CompactTitle({ title, opacity: o }: { title: string; opacity: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View pointerEvents="none" style={[s.compact, { opacity: o }]}>
      <Text style={s.compactText} numberOfLines={1}>{title}</Text>
    </Animated.View>
  )
}

export type ChatListStatus = 'loading' | 'error' | 'empty' | 'ready'

/**
 * The chat list's frame, shared by Chats (student, employer) and Messages
 * (interviewer): the reconnecting strip, the large title that folds into a
 * bar (with a fixed back circle above it where the screen is a drill-in), the search,
 * the rows, a quiet hint at the end, pull to refresh. Each screen loads its
 * own threads, draws its own empty and error blocks (their copy is the
 * persona's), and hands the rows in.
 */
export function ChatListFrame({
  title, onBack, titleRight, connected, status, errorView, emptyView, query, onQuery, hits, nameOf, onOpenHit,
  notice, rows, hint, refreshing, onRefresh, bottomPad = space.lg,
}: {
  title: string
  onBack?: () => void
  titleRight?: React.ReactNode
  connected: boolean
  status: ChatListStatus
  errorView?: React.ReactNode
  emptyView?: React.ReactNode
  query: string
  onQuery: (v: string) => void
  hits: MessageSearchHit[] | null
  nameOf: (threadId: string) => string
  onOpenHit: (threadId: string) => void
  /** A line under the search — "That pin did not save. Try again." */
  notice?: string | null
  rows: React.ReactNode[]
  hint?: string | null
  refreshing?: boolean
  onRefresh?: () => void
  /** Room under the last row — a floating tab bar needs more than a docked one. */
  bottomPad?: number
}) {
  const collapse = useCollapsingTitle()
  const searching = query.trim().length > 0
  let body: React.ReactNode
  if (status === 'loading') body = <View style={s.pad}><SkeletonRows count={5} /></View>
  else if (status === 'error') body = errorView
  else if (status === 'empty') body = emptyView
  else {
    body = (
      <View style={s.pad}>
        <ChatSearchField value={query} onChange={onQuery} />
        {!!notice && <Text accessibilityRole="alert" style={[text.uiSm, s.notice]}>{notice}</Text>}
        {!!hits && hits.length > 0 && <SearchHits hits={hits} nameOf={nameOf} onOpen={onOpenHit} />}
        {!!hits && hits.length > 0 && rows.length > 0 && <GroupLabel>Conversations</GroupLabel>}
        {rows}
        {searching && rows.length === 0 && !hits?.length && <Text style={[text.uiMd, s.muted, s.none]}>No one by that name.</Text>}
        {!searching && !!hint && <Text style={[text.metaSm, s.hint]}>{hint}</Text>}
      </View>
    )
  }

  return (
    <View style={s.frame}>
      <ReconnectingStrip visible={!connected} />
      {/* A drill-in list keeps its way back in view; the title fades in beside it once the large one has scrolled away. */}
      {!!onBack && (
        <View style={s.navRow}>
          <BackButton onPress={onBack} />
          <Animated.Text style={[s.compactText, s.navTitle, { opacity: collapse.barOpacity }]} numberOfLines={1}>{title}</Animated.Text>
        </View>
      )}
      <View style={s.frame}>
        <Animated.ScrollView
          onScroll={collapse.onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.textSubtle} /> : undefined}
        >
          <LargeTitle title={title} right={titleRight} />
          {body}
        </Animated.ScrollView>
        {!onBack && <CompactTitle title={title} opacity={collapse.barOpacity} />}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  frame: { flex: 1 },
  pad: { paddingHorizontal: space.xl },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  name: { flex: 1, fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-lead'], color: color.text },
  nameUnread: { fontFamily: FF.bodyBold },
  nameMuted: { color: color.textMuted },
  timeUnread: { color: color.accentText },
  mid: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space['2xs'] },
  preview: { flex: 1, fontFamily: FF.body, fontSize: fontSize['ui-md'], color: color.textMuted },
  previewUnread: { fontFamily: FF.bodyMedium, color: color.text },
  badge: { minWidth: height['count-chip'], height: height['count-chip'], borderRadius: radius.pill, paddingHorizontal: spaceHalf['1.5'], backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-xs'], fontVariant: ['tabular-nums'], color: color.textInverse },
  context: { color: color.textMuted, marginTop: space.xs },

  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: height['control-compact'], borderRadius: radius.panel, backgroundColor: color.surfaceMuted, paddingHorizontal: space.md, marginBottom: spaceHalf['2.5'] },
  searchInput: { flex: 1, paddingVertical: 0, fontFamily: FF.body, fontSize: fontSize['ui-md'], color: color.text },
  notice: { color: color.danger, marginBottom: space.sm },
  groupLabel: { color: color.textMuted, paddingTop: space.sm, paddingBottom: space.xs },
  hit: { gap: space['2xs'], paddingVertical: spaceHalf['2.5'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  hitName: { color: color.text },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  hint: { color: color.textMuted, textAlign: 'center', paddingVertical: space.lg },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: height['app-bar'], paddingHorizontal: space.md },
  navTitle: { flex: 1 },
  compact: {
    position: 'absolute', top: 0, left: 0, right: 0, height: height['app-bar'], justifyContent: 'center', paddingHorizontal: space.xl,
    backgroundColor: color.background, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  compactText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-cta'], color: color.text },
})
