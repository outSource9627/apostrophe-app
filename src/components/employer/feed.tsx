import React, { memo, useRef, useState } from 'react'
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { borderWidth, color, height, opacity, radius, rotation, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import type { CandidateCard } from '../../lib/api/employerFeed'
import {
  experienceLine, interviewDate, joinsLine, nameInitials, salaryLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { EmIconButton } from './em'
import { FactTile, GlassPill, SkillTags } from './studio'

/**
 * The candidate feed in the Studio direction (docs/employer-app-studio.html ·
 * F0–F7): the bar, the filter chips with the live match count, the white deck
 * card (the interview film over the facts an employer checks first), the
 * SHORTLIST / PASS / SKIP stamps, the four round controls and the skip hint.
 * Tokens only; every fact is the API's, and one it did not send is left off.
 */

// ── the bar ──────────────────────────────────────────────────────────────────
export function FeedTop({
  filterCount, locked, onSaved, onFilters,
}: { filterCount: number; locked?: boolean; onSaved: () => void; onFilters: () => void }) {
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
  matches, chips, onRemove, onClear, locked,
}: { matches: number | null; chips: { key: string; text: string }[]; onRemove: (key: string) => void; onClear: () => void; locked?: boolean }) {
  if (locked) return <View style={styles.chipsSpacer} />
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
      {matches !== null && (
        <View style={styles.matchChip} accessibilityLabel={`${matches} candidates match`}>
          <Text style={text.uiSmSemi}>{matches}</Text>
          <Text style={[text.uiSm, styles.secondary]}>match</Text>
        </View>
      )}
      {chips.length === 0 ? (
        <Text style={[text.uiSm, styles.subtle]}>No filters</Text>
      ) : (
        <>
          {chips.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter ${c.text}`}
              onPress={() => onRemove(c.key)}
              hitSlop={{ top: space.sm, bottom: space.sm }}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={[text.uiSmMedium, styles.accentText]} numberOfLines={1}>{c.text}</Text>
              <Icon name="x" size={space.md} tint={color.accentText} weight={2} />
            </Pressable>
          ))}
          {chips.length > 1 && (
            <Pressable accessibilityRole="button" onPress={onClear} hitSlop={space.sm} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <Text style={[text.uiSmSemi, styles.accent]}>Clear</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  )
}

// ── the card ─────────────────────────────────────────────────────────────────
/**
 * One candidate as the Studio deck card: the verified-interview film on top
 * (muted, looping; a tap turns the sound on), the verified pill, the day's
 * position and the sound button over it, Full at its foot; then the name, the
 * qualification line, Expected / Joins and the skills. `active` is false for
 * the card waiting behind, which draws its poster and plays nothing.
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
  const progress = useRef(new Animated.Value(0)).current
  const playing = active && !!card.streamUrl && failed !== card.streamUrl
  const poster = card.posterUrl ?? card.photoUrl
  const date = card.verifiedInterview?.verified ? interviewDate(card.verifiedInterview.at) : null
  const meta = [tierLine(card.tier, card.qualification), card.city, experienceLine(card.experienceYears)].filter(Boolean).join(' · ')
  const salary = salaryLine(card.expectedSalary)
  const joins = joinsLine(card.availability)

  return (
    <View style={styles.card}>
      <View style={styles.film}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? (muted ? 'Turn the sound on' : 'Mute') : `${card.name}, open profile`}
          onPress={playing ? onToggleMute : onOpenProfile}
          style={StyleSheet.absoluteFill}
        >
          {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          {!poster && !playing && (
            <View style={styles.initialsWrap}><Text style={[text.displayPoster, styles.initials]}>{nameInitials(card.name)}</Text></View>
          )}
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
              onProgress={(p) => {
                if (p.seekableDuration > 0) progress.setValue(Math.min(1, p.currentTime / p.seekableDuration))
              }}
              onError={() => {
                setFailed(card.streamUrl)
                onStreamFail?.()
              }}
            />
          )}
        </Pressable>

        <View style={styles.filmTop} pointerEvents="box-none">
          {date ? <GlassPill icon="check" label={`Verified · ${date}`} /> : <View />}
          <View style={styles.filmTopRight} pointerEvents="box-none">
            {!!position && <GlassPill label={position} />}
            {playing && (
              <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'} onPress={onToggleMute} hitSlop={space.sm} style={styles.sound}>
                <Icon name={muted ? 'mute' : 'sound'} size={space.lg - 1} tint={color.textOnInk} />
              </Pressable>
            )}
          </View>
        </View>

        {stamps}

        <View style={styles.filmFoot} pointerEvents="box-none">
          {card.hasVideo && !fullBlocked && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${card.name}’s full interview`} onPress={onOpenFull} hitSlop={space.sm} style={({ pressed }) => [styles.full, pressed && styles.pressed]}>
              <Icon name="max" size={space.md + 1} tint={color.textOnInk} weight={2} />
              <Text style={[text.metaXs, styles.mono, styles.onInk]}>FULL</Text>
            </Pressable>
          )}
          <View style={styles.progressTrack} pointerEvents="none">
            <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
          </View>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`${card.name}, open profile`} onPress={onOpenProfile} style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[text.displaySm, styles.grow]} numberOfLines={1}>{card.name}</Text>
          {card.shortlistCount > 0 && (
            <View style={styles.count} accessibilityLabel={`Shortlisted by ${card.shortlistCount} employers`}>
              <Icon name="users" size={space.md + 2} tint={color.textMuted} />
              <Text style={[text.uiSm, styles.muted]}>{card.shortlistCount}</Text>
            </View>
          )}
        </View>
        {!!meta && <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{meta}</Text>}
        {(!!salary || !!joins) && (
          <View style={styles.facts}>
            {!!salary && <FactTile label="Expected" value={salary} />}
            {!!joins && <FactTile label="Joins" value={joins} />}
          </View>
        )}
        <SkillTags skills={card.skills} max={3} style={styles.skills} />
      </Pressable>
    </View>
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

/** SHORTLIST (green, tilted left), PASS · N DAYS (red, tilted right), SKIP (ink, level) — faded in by the drag. */
export function FeedStamp({ kind, passDays }: { kind: 'shortlist' | 'pass' | 'skip'; passDays?: number }) {
  if (kind === 'skip') {
    return (
      <View style={styles.skipStamp}>
        <Icon name="arrowU" size={space.md + 1} tint={color.textOnInk} weight={2.2} />
        <Text style={[text.metaMd, styles.stampText, styles.onInk]}>SKIP</Text>
      </View>
    )
  }
  const pass = kind === 'pass'
  return (
    <View style={[styles.stamp, pass ? styles.stampPass : styles.stampShort]}>
      <Text style={[text.metaXl, styles.stampText, { color: pass ? color.dangerFill : color.successFill }]}>
        {pass ? (passDays ? `PASS · ${passDays} DAYS` : 'PASS') : 'SHORTLIST'}
      </Text>
    </View>
  )
}

// ── the controls ─────────────────────────────────────────────────────────────
/** Undo 44, Pass 60, Shortlist 60, Interest 44, then the skip hint. */
export function FeedControls({
  canUndo, disabled, interestDisabled, onUndo, onPass, onShortlist, onInterest,
}: {
  canUndo: boolean; disabled: boolean; interestDisabled?: boolean
  onUndo: () => void; onPass: () => void; onShortlist: () => void; onInterest: () => void
}) {
  return (
    <View style={styles.ctlWrap}>
      <View style={styles.ctl}>
        <Round size="sm" tone="plain" label="Undo last swipe" disabled={!canUndo || disabled} onPress={onUndo}>
          <Icon name="undo" size={space.lg + 2} tint={color.textSecondary} />
        </Round>
        <Round size="lg" tone="pass" label="Pass" disabled={disabled} onPress={onPass}>
          <Icon name="x" size={height.glyph + 2} tint={color.dangerFill} weight={2.3} />
        </Round>
        <Round size="lg" tone="short" label="Shortlist" disabled={disabled} onPress={onShortlist}>
          <Icon name="bookmark" size={height.glyph} tint={color.textInverse} weight={2.2} />
        </Round>
        <Round size="sm" tone="interest" label="Send Interest" disabled={disabled || interestDisabled} onPress={onInterest}>
          <Icon name="heart" size={space.lg + 3} tint={color.accentText} />
        </Round>
      </View>
      <View style={styles.hint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="chevD" size={space.md + 1} tint={color.textSubtle} />
        <Text style={[text.metaXs, styles.mono, styles.subtle]}>SCROLL DOWN TO SKIP</Text>
      </View>
    </View>
  )
}

function Round({
  size, tone, label, disabled, onPress, children,
}: { size: 'sm' | 'lg'; tone: 'plain' | 'pass' | 'short' | 'interest'; label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const d = size === 'lg' ? height['deck-action'] - space.xs : height.tap
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? space.xs : undefined}
      style={({ pressed }) => [
        styles.round,
        { width: d, height: d },
        tone === 'plain' && styles.roundPlain,
        tone === 'pass' && styles.roundPass,
        tone === 'short' && styles.roundShort,
        tone === 'interest' && styles.roundInterest,
        disabled && styles.roundOff,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
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
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled - 0.1 },
  mono: { letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },
  accentText: { color: color.accentText },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },

  top: { minHeight: height['screen-header'] - 2, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.xl, paddingRight: spaceHalf['2.5'] },
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
  chip: { height: height['chip-sm'], paddingLeft: space.md, paddingRight: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.accentSoft, borderWidth: borderWidth.thin, borderColor: color.accentEdge, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  clear: { paddingHorizontal: space.xs, height: height['chip-sm'], justifyContent: 'center' },

  card: { flex: 1, backgroundColor: color.surface, borderRadius: radius.deck, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.sm, boxShadow: shadow.deck },
  film: { flex: 1, borderRadius: radius.lg, backgroundColor: color.inkRaised, overflow: 'hidden' },
  initialsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.onInkWash },
  filmTop: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  filmTopRight: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  sound: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkGlass, alignItems: 'center', justifyContent: 'center' },
  filmFoot: { position: 'absolute', left: spaceHalf['3.5'], right: spaceHalf['3.5'], bottom: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  full: { alignSelf: 'flex-end', height: space.xl + space.xs, paddingHorizontal: space.sm + 1, borderRadius: radius.pill, backgroundColor: color.onInkGlass, flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  progressTrack: { height: height['film-progress'], borderRadius: radius.bar, backgroundColor: color.onInkLevel, overflow: 'hidden' },
  progressFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.textOnInk, transformOrigin: 'left' },

  info: { paddingTop: space.md, paddingHorizontal: space.sm, paddingBottom: space.xs, gap: space.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  facts: { flexDirection: 'row', gap: space.sm },
  skills: { flexWrap: 'nowrap', overflow: 'hidden' },

  face: { borderRadius: radius.pill },
  faceMono: { backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },

  stamp: { paddingVertical: spaceHalf['1.5'] - 1, paddingHorizontal: space.md - 1, borderRadius: radius.ctl + 1, borderWidth: borderWidth.stamp, backgroundColor: color.onInkDisc },
  stampShort: { borderColor: color.successFill, transform: [{ rotate: rotation.stamp }] },
  stampPass: { borderColor: color.dangerFill, transform: [{ rotate: rotation['stamp-alt'] }] },
  stampText: { letterSpacing: trackingNative.eyebrow },
  skipStamp: { height: height['chip-sm'] + 2, paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.pill, backgroundColor: color.ink, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },

  ctlWrap: { paddingTop: spaceHalf['3.5'], paddingBottom: space.sm, gap: space.sm, alignItems: 'center' },
  ctl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spaceHalf['4.5'] },
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  roundPlain: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  roundPass: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.dangerBorder, boxShadow: shadow.card },
  roundShort: { backgroundColor: color.successFill, boxShadow: shadow['deck-save'] },
  roundInterest: { backgroundColor: color.accentSoft },
  roundOff: { opacity: opacity.disabled - 0.05 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },

  lock: { flex: 1, borderRadius: radius.deck, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  lockHead: { width: height['room-tile-w'] - space.sm, height: height['room-tile-w'] - space.sm, borderRadius: radius.pill, backgroundColor: color.inkSilhouette, marginBottom: -space.xs },
  lockBody: { width: height['lock-shoulders-w'], height: height['lock-shoulders-h'], borderTopLeftRadius: height['lock-shoulders-w'] / 2, borderTopRightRadius: height['lock-shoulders-w'] / 2, backgroundColor: color.inkSilhouette, marginTop: spaceHalf['2.5'] },
  lockOver: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spaceHalf['2.5'] },
  lockDisc: { width: height.fab - 4, height: height.fab - 4, borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
})
