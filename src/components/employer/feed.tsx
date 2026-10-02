import React, { memo, useRef, useState } from 'react'
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import {
  FeedCardFrame, FeedCardTop, FeedCount, FeedFilmBar, FeedGlassButton, FeedHud, FeedMeta, FeedPill, FeedPills, FeedShade, FeedTag,
  FeedTopButton, feedText,
} from '../ui/feed-deck'
import type { CandidateCard } from '../../lib/api/employerFeed'
import {
  experienceLine, interviewDate, joinsLine, nameInitials, salaryLine, shortlistedLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { EmIconButton } from './em'

/**
 * The candidate feed (docs/tinder-feed-mockups.html · design 1, employer mode,
 * on the Studio bar): the bar, the filter chips with the live match count, and
 * the video card. The stamps, the four round buttons, the toast and the
 * loading card are the shared feed pieces (components/ui/feed-deck). The bar
 * and the chips are drawn on ink while a card is up (`dark`) and on the page
 * for the lock, limit, caught-up and error states.
 * Tokens only; every fact is the API's, and one it did not send is left off.
 */

// ── the bar ──────────────────────────────────────────────────────────────────
export function FeedTop({
  filterCount, locked, dark, onSaved, onFilters,
}: { filterCount: number; locked?: boolean; dark?: boolean; onSaved: () => void; onFilters: () => void }) {
  if (dark) {
    return (
      <View style={styles.top}>
        <Text style={[text.displaySm, styles.onInk, styles.grow]} accessibilityRole="header">Feed</Text>
        <View style={styles.topDarkBtns}>
          <FeedTopButton icon="bookmark" label="Saved searches" dark disabled={locked} onPress={onSaved} />
          <FeedTopButton icon="sliders" label="Filters" dark badge={filterCount} disabled={locked} onPress={onFilters} />
        </View>
      </View>
    )
  }
  return (
    <View style={styles.top}>
      <Text style={[text.displaySm, styles.grow]} accessibilityRole="header">Feed</Text>
      <View style={locked && styles.dim}>
        <EmIconButton name="bookmark" label="Saved searches" tint={color.textSecondary} onPress={onSaved} disabled={locked} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filterCount ? `Filters, ${filterCount} on` : 'Filters'}
        disabled={locked}
        onPress={onFilters}
        hitSlop={space.xs}
        style={({ pressed }) => [styles.filterBtn, locked && styles.dim, pressed && styles.pressed]}
      >
        <Icon name="sliders" size={space.lg + 2} tint={color.textInverse} />
        {filterCount > 0 && (
          <View style={styles.filterBadge}><Text style={[text.metaXs, styles.filterBadgeText]}>{filterCount}</Text></View>
        )}
      </Pressable>
    </View>
  )
}

/** The match count, then the removable filter chips, then Clear. */
export function FeedChips({
  matches, chips, onRemove, onClear, locked, dark,
}: {
  matches: number | null; chips: { key: string; text: string }[]; onRemove: (key: string) => void; onClear: () => void
  locked?: boolean; dark?: boolean
}) {
  if (locked) return <View style={styles.chipsSpacer} />
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
      {matches !== null && (
        <View style={[styles.matchChip, dark && styles.matchChipDark]} accessibilityLabel={`${matches} candidates match`}>
          <Text style={[text.uiSmSemi, dark && styles.onInk]}>{matches}</Text>
          <Text style={[text.uiSm, dark ? styles.onInkMuted : styles.secondary]}>match</Text>
        </View>
      )}
      {chips.length === 0 ? (
        <Text style={[text.uiSm, dark ? styles.onInkSubtle : styles.subtle]}>No filters</Text>
      ) : (
        <>
          {chips.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter ${c.text}`}
              onPress={() => onRemove(c.key)}
              hitSlop={{ top: space.sm, bottom: space.sm }}
              style={({ pressed }) => [styles.chip, dark && styles.chipDark, pressed && styles.pressed]}
            >
              <Text style={[text.uiSmMedium, dark ? styles.onInkAccent : styles.accentText]} numberOfLines={1}>{c.text}</Text>
              <Icon name="x" size={space.md} tint={dark ? color.accentMuted : color.accentText} weight={2} />
            </Pressable>
          ))}
          {chips.length > 1 && (
            <Pressable accessibilityRole="button" onPress={onClear} hitSlop={space.sm} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <Text style={[text.uiSmSemi, dark ? styles.onInkAccent : styles.accent]}>Clear</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  )
}

// ── the card ─────────────────────────────────────────────────────────────────
/**
 * One candidate as a video feed card (docs/tinder-feed-mockups.html · design 1,
 * employer mode): the verified-interview film fills the card (muted, looping),
 * the poster stays over it until its first frame is ready, and the film's
 * progress runs across the top. On top: the verified tag, the day's position,
 * Full and the sound toggle. At the foot: the face and name (a tap opens the
 * profile), the headline, Expected / Joins in pink, the skills, and where /
 * how long / how many shortlisted. The four round buttons are the screen's,
 * fixed over the foot. `active` is false for the card waiting behind, which
 * draws its poster and plays nothing.
 */
export const DeckCard = memo(function DeckCardView({
  card, active, muted, position, fullBlocked, onToggleMute, onOpenFull, onOpenProfile, onStreamFail, stamps,
}: {
  card: CandidateCard
  active: boolean
  muted: boolean
  /** “13 / 40” — the day's position. */
  position?: string | null
  fullBlocked?: boolean
  onToggleMute?: () => void
  onOpenFull?: () => void
  onOpenProfile?: () => void
  onStreamFail?: () => void
  /** Drawn over the film (the swipe stamps). */
  stamps?: React.ReactNode
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const [ready, setReady] = useState<string | null>(null)
  const progress = useRef(new Animated.Value(0)).current
  const playing = active && !!card.streamUrl && failed !== card.streamUrl
  const shown = playing && ready === card.streamUrl
  const poster = card.posterUrl ?? card.photoUrl
  const date = card.verifiedInterview?.verified ? interviewDate(card.verifiedInterview.at) : null
  const headline = card.headline || tierLine(card.tier, card.qualification)
  const meta = [card.city, experienceLine(card.experienceYears), shortlistedLine(card.shortlistCount)].filter(Boolean).join(' · ')
  const salary = salaryLine(card.expectedSalary)
  const joins = joinsLine(card.availability)

  return (
    <FeedCardFrame>
      {playing && (
        <Video
          source={{ uri: card.streamUrl! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          muted={muted}
          repeat
          paused={!active}
          playInBackground={false}
          progressUpdateInterval={250}
          onReadyForDisplay={() => setReady(card.streamUrl)}
          onProgress={(p) => {
            if (p.seekableDuration > 0) progress.setValue(Math.min(1, p.currentTime / p.seekableDuration))
            // Belt and braces: a player that never reports its first frame still lifts the poster once it plays.
            if (p.currentTime > 0 && ready !== card.streamUrl) setReady(card.streamUrl)
          }}
          onError={() => {
            setFailed(card.streamUrl)
            onStreamFail?.()
          }}
        />
      )}
      {!shown && (poster
        ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={styles.initialsWrap}><Text style={[text.displayPoster, styles.initials]}>{nameInitials(card.name)}</Text></View>)}
      <FeedShade />
      {playing && <FeedFilmBar progress={progress} />}

      <FeedCardTop
        left={<FeedTag label={date ? `Verified interview · ${date}` : card.hasVideo ? 'Interview film' : 'Candidate'} />}
        right={
          <>
            {!!position && <FeedCount label={position} />}
            {card.hasVideo && !fullBlocked && !!onOpenFull && (
              <FeedGlassButton icon="max" label={`Watch ${card.name}’s full interview`} onPress={onOpenFull} />
            )}
            {playing && <FeedGlassButton icon={muted ? 'mute' : 'sound'} label={muted ? 'Turn the sound on' : 'Mute'} onPress={onToggleMute} />}
          </>
        }
      />

      {stamps}

      <FeedHud>
        <View style={styles.who}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${card.name}, open profile`} onPress={onOpenProfile} style={styles.whoTap}>
            {card.photoUrl ? (
              <Image source={{ uri: card.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarMono]}><Text style={styles.avatarText}>{nameInitials(card.name)}</Text></View>
            )}
            <View style={styles.grow}>
              <View style={styles.nameRow}>
                <Text style={[feedText.person, styles.shrink]} numberOfLines={1}>{card.name}</Text>
                {card.verifiedInterview?.verified && <Icon name="check" size={space.lg + 2} tint={color.feedLike} weight={2.5} />}
              </View>
              {!!headline && <Text style={feedText.sub} numberOfLines={1}>{headline}</Text>}
            </View>
          </Pressable>
          <FeedGlassButton icon="chevU" tone="light" label="Open full profile" onPress={onOpenProfile} />
        </View>
        <FeedPills>
          {!!salary && <FeedPill tone="pink" label={salary} />}
          {!!joins && <FeedPill tone="pink" label={joins} />}
          {card.interest === 'SENT' && <FeedPill tone="dark" label="Interest sent" />}
          {card.skills.slice(0, 3).map((sk) => <FeedPill key={sk} tone="dark" label={sk} />)}
        </FeedPills>
        {!!meta && <FeedMeta label={meta} />}
      </FeedHud>
    </FeedCardFrame>
  )
})

/** A candidate's face (the photo, else the initials on the violet disc). Shared with the shortlist and Interest sheets. */
export function FeedFace({ name, photo, size = height.avatar }: { name: string; photo: string | null | undefined; size?: number }) {
  return photo ? (
    <Image source={{ uri: photo }} style={[styles.face, { width: size, height: size }]} />
  ) : (
    <View style={[styles.face, styles.faceMono, { width: size, height: size }]}>
      <Text style={[size >= height.control ? text.uiBaseSemi : text.uiSmSemi, styles.onInk]}>{nameInitials(name)}</Text>
    </View>
  )
}

/** EM-08b · the feed while pending: a locked silhouette, never a real candidate. */
export function FeedLockCard() {
  return (
    <View style={styles.lock}>
      <View style={styles.lockHead} />
      <View style={styles.lockBody} />
      <View style={styles.lockOver}>
        <View style={styles.lockDisc}><Icon name="lock" size={height.glyph - 2} tint={color.textOnInk} weight={2} /></View>
        <Text style={[text.uiSm, styles.onInkMuted]}>Videos play once you’re verified</Text>
      </View>
    </View>
  )
}

export const FEED_HOW = [
  { icon: 'arrowR', text: 'Swipe right to shortlist privately' },
  { icon: 'arrowL', text: 'Swipe left to pass' },
  { icon: 'arrowU', text: 'Scroll down to skip — nothing is saved' },
  { icon: 'heart', text: 'Send an Interest when you want to talk' },
] as const

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled - 0.1 },
  secondary: { color: color.textSecondary },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },
  accentText: { color: color.accentText },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  onInkSubtle: { color: color.textOnInkSubtle },
  onInkAccent: { color: color.accentMuted },

  top: { minHeight: height['screen-header'] - 2, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.xl, paddingRight: spaceHalf['2.5'] },
  topDarkBtns: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xs },
  filterBtn: { width: height['control-xs'] - 2, height: height['control-xs'] - 2, borderRadius: radius.pill, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
  filterBadge: {
    position: 'absolute', top: -space.xs, right: -space.xs, minWidth: space.lg + 1, height: space.lg + 1, paddingHorizontal: space.xs,
    borderRadius: radius.pill, backgroundColor: color.accent, borderWidth: borderWidth.accent, borderColor: color.background, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: color.textInverse },

  chipsScroll: { flexGrow: 0 },
  chips: { gap: spaceHalf['1.5'], paddingHorizontal: space.lg, paddingBottom: spaceHalf['2.5'], alignItems: 'center', minHeight: height['chip-sm'] + spaceHalf['2.5'] },
  chipsSpacer: { height: height['chip-sm'] + spaceHalf['2.5'] },
  matchChip: { height: height['chip-sm'], paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  matchChipDark: { backgroundColor: color.inkRaised },
  chip: { height: height['chip-sm'], paddingLeft: space.md, paddingRight: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.accentSoft, borderWidth: borderWidth.thin, borderColor: color.accentEdge, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  chipDark: { backgroundColor: color.accentOnInkSoft, borderColor: color.onInkEdge },
  clear: { paddingHorizontal: space.xs, height: height['chip-sm'], justifyContent: 'center' },

  initialsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: color.inkRaised },
  initials: { color: color.onInkEdge },

  who: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  whoTap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  avatar: { width: height.avatar, height: height.avatar, borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.onInkOutline },
  avatarMono: { backgroundColor: color.onInkEdge, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'], color: color.textOnInk },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },

  face: { borderRadius: radius.pill },
  faceMono: { backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },

  lock: { flex: 1, borderRadius: radius.deck, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  lockHead: { width: height['room-tile-w'] - space.sm, height: height['room-tile-w'] - space.sm, borderRadius: radius.pill, backgroundColor: color.inkSilhouette, marginBottom: -space.xs },
  lockBody: { width: height['lock-shoulders-w'], height: height['lock-shoulders-h'], borderTopLeftRadius: height['lock-shoulders-w'] / 2, borderTopRightRadius: height['lock-shoulders-w'] / 2, backgroundColor: color.inkSilhouette, marginTop: spaceHalf['2.5'] },
  lockOver: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spaceHalf['2.5'] },
  lockDisc: { width: height.fab - 4, height: height.fab - 4, borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
})
