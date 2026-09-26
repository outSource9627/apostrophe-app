import React, { memo, useRef, useState } from 'react'
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, rotation, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import type { CandidateCard } from '../../lib/api/employerFeed'
import {
  experienceLine, interviewDate, joinsLine, nameInitials, salaryLine, shortlistedLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { EmAvatarButton, EmIconButton, initialsOf } from './em'

/**
 * The Employer Android feed (EM-08, `gen/a1.js` A.feedTop, A.card, A.ctl): the
 * bar with the day's position, the filter chips, the full-bleed film card with
 * its caption, the SHORTLIST / PASS stamps, the four round controls and the
 * undo toast. Tokens only; every fact on the card is the API's, and a fact it
 * did not send is left off rather than drawn as a placeholder.
 */

// ── the bar (A.feedTop) ──────────────────────────────────────────────────────
export function FeedTop({
  position, filterCount, companyName, locked, onSaved, onFilters, onAccount,
}: {
  position: string
  filterCount: number
  companyName?: string
  locked?: boolean
  onSaved: () => void
  onFilters: () => void
  onAccount: () => void
}) {
  return (
    <View style={styles.top}>
      <View style={styles.topTitle}>
        <Text style={text.displayMd}>Feed</Text>
        <Text style={[text.metaSm, styles.mono, styles.muted]}>{position}</Text>
      </View>
      <View style={locked && styles.dim}>
        <EmIconButton name="bookmark" label="Saved searches" tint={color.textSecondary} onPress={onSaved} disabled={locked} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filterCount ? `Filters, ${filterCount} on` : 'Filters'}
        disabled={locked}
        onPress={onFilters}
        hitSlop={space['2xs']}
        style={({ pressed }) => [styles.filterPill, locked && styles.dim, pressed && styles.pressed]}
      >
        <Icon name="filter" size={space.lg - 1} tint={color.text} />
        <View style={styles.filterCount}><Text style={[text.metaMd, styles.filterCountText]}>{filterCount}</Text></View>
      </Pressable>
      <EmAvatarButton initials={initialsOf(companyName)} onPress={onAccount} />
    </View>
  )
}

/** The removable chips under the bar, then Clear — or "No filters". */
export function FeedChips({
  chips, onRemove, onClear, locked,
}: { chips: { key: string; text: string }[]; onRemove: (key: string) => void; onClear: () => void; locked?: boolean }) {
  if (locked) return <View style={styles.chipsSpacer} />
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
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
              <Text style={text.uiSm} numberOfLines={1}>{c.text}</Text>
              <Icon name="x" size={space.md} tint={color.textMuted} weight={2} />
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClear} hitSlop={space.sm} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
            <Text style={[text.uiSmSemi, styles.accent]}>Clear</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}

// ── the card (A.card) ────────────────────────────────────────────────────────
/**
 * One candidate as the design's film card: the verified-interview film full
 * bleed (muted, looping; a tap turns the sound on), the verified pill and the
 * sound button on top, the Full button on the right edge, and the caption over
 * a gradient at the foot — the part a tap opens the profile from. `active` is
 * false for the card waiting behind, which draws its poster and plays nothing.
 */
export const FeedFilmCard = memo(function FilmCard({
  card, active, muted, fullBlocked, onToggleMute, onOpenFull, onOpenProfile, onStreamFail, children,
}: {
  card: CandidateCard
  active: boolean
  muted: boolean
  fullBlocked?: boolean
  onToggleMute?: () => void
  onOpenFull?: () => void
  onOpenProfile?: () => void
  onStreamFail?: () => void
  /** Drawn over the film (the swipe stamps). */
  children?: React.ReactNode
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const progress = useRef(new Animated.Value(0)).current
  const playing = active && !!card.streamUrl && failed !== card.streamUrl
  const poster = card.posterUrl ?? card.photoUrl
  const date = card.verifiedInterview?.verified ? interviewDate(card.verifiedInterview.at) : null
  const facts = [card.city, experienceLine(card.experienceYears)].filter(Boolean).join(' · ')
  const salary = salaryLine(card.expectedSalary)
  const joins = joinsLine(card.availability)
  const shortlisted = shortlistedLine(card.shortlistCount)
  const sub = tierLine(card.tier, card.qualification)

  return (
    <View style={styles.film}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'}
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
        {date ? (
          <View style={styles.verified} pointerEvents="none">
            <Icon name="check" size={space.md} tint={color.successOnInk} weight={2.6} />
            <Text style={[text.metaSm, styles.onInk, styles.mono]}>{`VERIFIED INTERVIEW · ${date.toUpperCase()}`}</Text>
          </View>
        ) : <View />}
        {playing && (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'} onPress={onToggleMute} hitSlop={space.xs} style={styles.sound}>
            <Icon name={muted ? 'mute' : 'sound'} size={space.lg + 2} tint={color.textOnInk} />
          </Pressable>
        )}
      </View>

      {card.hasVideo && !fullBlocked && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${card.name}’s full interview`} onPress={onOpenFull} style={({ pressed }) => [styles.full, pressed && styles.pressed]}>
          <Icon name="video" size={space.xl} tint={color.textOnInk} />
          <Text style={[text.uiXsSemi, styles.onInk]}>Full</Text>
        </Pressable>
      )}

      {children}

      <Pressable accessibilityRole="button" accessibilityLabel={`${card.name}, open profile`} onPress={onOpenProfile} style={styles.caption}>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <LinearGradient id="feedCaption" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.inkDeep} stopOpacity={0} />
              <Stop offset="0.45" stopColor={color.inkDeep} stopOpacity={0.95} />
              <Stop offset="1" stopColor={color.inkDeep} stopOpacity={0.95} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill="url(#feedCaption)" />
        </Svg>
        <View style={styles.who}>
          <FeedFace name={card.name} photo={card.photoUrl} />
          <View style={styles.grow}>
            <Text style={[text.displaySm, styles.onInk]} numberOfLines={1}>{card.name}</Text>
            {!!sub && <Text style={[text.uiXs, styles.onInkMuted]} numberOfLines={1}>{sub}</Text>}
          </View>
        </View>
        {!!facts && <Text style={[text.uiXs, styles.onInkSoft]} numberOfLines={1}>{facts}</Text>}
        {(!!salary || !!joins) && (
          <Text style={[text.uiSm, styles.onInk]} numberOfLines={1}>
            {!!salary && <Text style={styles.semi}>{salary}</Text>}
            {!!salary && <Text style={styles.onInkBody}> expected</Text>}
            {!!salary && !!joins && '    '}
            {!!joins && <Text style={styles.onInkBody}>Joins </Text>}
            {!!joins && <Text style={styles.semi}>{joins}</Text>}
          </Text>
        )}
        {card.languages.length > 0 && <Text style={[text.uiXs, styles.onInkMuted]} numberOfLines={1}>{card.languages.join(', ')}</Text>}
        {card.skills.length > 0 && (
          <View style={styles.tags}>
            {card.skills.slice(0, 4).map((s) => (
              <View key={s} style={styles.tag}><Text style={[text.metaSm, styles.onInk]} numberOfLines={1}>{s.toUpperCase()}</Text></View>
            ))}
          </View>
        )}
        <View style={styles.captionFoot}>
          {shortlisted ? (
            <View style={styles.shortlisted}>
              <Icon name="users" size={space.md + 2} tint={color.textOnInkSoft} />
              <Text style={[text.uiXs, styles.onInkSoft]}>{shortlisted}</Text>
            </View>
          ) : <View />}
          <Text style={[text.metaXs, styles.onInkBody, styles.mono]}>TAP FOR PROFILE</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
        </View>
      </Pressable>
    </View>
  )
})

/** A candidate's face (H.av on the card): the photo, else the initials on the violet disc. */
export function FeedFace({ name, photo, size = height.avatar }: { name: string; photo: string | null | undefined; size?: number }) {
  return photo ? (
    <Image source={{ uri: photo }} style={[styles.face, { width: size, height: size }]} />
  ) : (
    <View style={[styles.face, styles.faceMono, { width: size, height: size }]}>
      <Text style={[size >= height.control ? text.uiBaseSemi : text.uiSmSemi, styles.onInk]}>{nameInitials(name)}</Text>
    </View>
  )
}

/** SHORTLIST (green, tilted left) and PASS · N DAYS (red, tilted right), faded in by the drag. */
export function FeedStamp({ kind, passDays }: { kind: 'shortlist' | 'pass'; passDays?: number }) {
  const pass = kind === 'pass'
  return (
    <View style={[styles.stamp, pass ? styles.stampPass : styles.stampShort]}>
      <Text style={[text.metaXl, styles.stampText, { color: pass ? color.dangerFill : color.successFill }]}>
        {pass ? (passDays ? `PASS · ${passDays} DAYS` : 'PASS') : 'SHORTLIST'}
      </Text>
    </View>
  )
}

// ── the controls (A.ctl) ─────────────────────────────────────────────────────
/** Undo 48, Pass 64, Shortlist 64, Profile 48 — every target at least 48. */
export function FeedControls({
  canUndo, disabled, onUndo, onPass, onShortlist, onProfile,
}: { canUndo: boolean; disabled: boolean; onUndo: () => void; onPass: () => void; onShortlist: () => void; onProfile: () => void }) {
  return (
    <View style={styles.ctl}>
      <Round size="sm" label="Undo last swipe" disabled={!canUndo || disabled} onPress={onUndo}>
        <Icon name="undo" size={space.xl} tint={color.textSecondary} />
      </Round>
      <Round size="lg" label="Pass" disabled={disabled} onPress={onPass}>
        <Icon name="x" size={height.glyph + 2} tint={color.dangerFill} weight={2.2} />
      </Round>
      <Round size="lg" dark label="Shortlist" disabled={disabled} onPress={onShortlist}>
        <Icon name="bookmark" size={height.glyph} tint={color.textInverse} weight={2} />
      </Round>
      <Round size="sm" label="Open profile" disabled={disabled} onPress={onProfile}>
        <Icon name="info" size={space.xl} tint={color.textSecondary} />
      </Round>
    </View>
  )
}

function Round({
  size, dark, label, disabled, onPress, children,
}: { size: 'sm' | 'lg'; dark?: boolean; label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const d = size === 'lg' ? height['deck-action'] : height.control
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { width: d, height: d },
        dark ? styles.roundDark : styles.roundLight,
        size === 'lg' && (dark ? styles.roundDarkLift : styles.roundLift),
        disabled && styles.roundOff,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  )
}

/** The ink bar after a swipe: what happened, and UNDO (the server keeps one). */
export function FeedToast({ message, onUndo, disabled }: { message: string; onUndo: () => void; disabled?: boolean }) {
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={[text.uiSm, styles.onInk, styles.grow]} numberOfLines={1}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Undo" disabled={disabled} onPress={onUndo} hitSlop={space.xs} style={({ pressed }) => [styles.toastUndo, pressed && styles.pressed]}>
        <Text style={[text.uiSmSemi, styles.toastUndoText]}>UNDO</Text>
      </Pressable>
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
  { icon: 'heart', text: 'Send an Interest when you want to talk' },
] as const

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled - 0.1 },
  mono: { letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },
  semi: { fontFamily: text.uiSmSemi.fontFamily },
  onInk: { color: color.textOnInk },
  onInkSoft: { color: color.textOnInkSoft },
  onInkMuted: { color: color.textOnInkMuted },
  onInkBody: { color: color.textOnInkBody },

  top: { minHeight: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: spaceHalf['4.5'], paddingRight: space.sm },
  topTitle: { flex: 1, minWidth: 0, gap: space['2xs'] },
  filterPill: { height: height.avatar, paddingLeft: space.md, paddingRight: spaceHalf['1.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  filterCount: { minWidth: space.xl + 2, height: space.xl + 2, paddingHorizontal: spaceHalf['1.5'], borderRadius: radius.pill, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  filterCountText: { color: color.accentText },

  chipsScroll: { flexGrow: 0 },
  chips: { gap: spaceHalf['1.5'], paddingHorizontal: space.lg, paddingBottom: spaceHalf['2.5'], alignItems: 'center', minHeight: height['chip-sm'] + spaceHalf['2.5'] },
  chipsSpacer: { height: height['chip-sm'] + spaceHalf['2.5'] },
  chip: { height: height['chip-sm'], paddingLeft: spaceHalf['2.5'] + 1, paddingRight: space.sm, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong, flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
  clear: { paddingHorizontal: space.xs, height: height['chip-sm'], justifyContent: 'center' },

  film: { flex: 1, borderRadius: radius.deck, backgroundColor: color.inkRaised, overflow: 'hidden', boxShadow: shadow.deck },
  initialsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.onInkWash },
  filmTop: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verified: { height: height['chip-sm'] - 2, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.onInkGlass, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  sound: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkDiscPlaying, alignItems: 'center', justifyContent: 'center' },
  full: { position: 'absolute', right: space.md, top: '40%', paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.sm, borderRadius: radius.panel, backgroundColor: color.onInkGlass, alignItems: 'center', gap: space.xs, minWidth: height.control },

  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: height.fab + space.md, paddingHorizontal: space.lg, paddingBottom: spaceHalf['3.5'], gap: space.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 1 },
  tag: { height: space.xl + space.xs, paddingHorizontal: spaceHalf['2.5'] + 1, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.onInkOutline, backgroundColor: color.onInkWash, justifyContent: 'center' },
  captionFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space['2xs'] },
  shortlisted: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  progressTrack: { height: height['film-progress'], borderRadius: radius.bar, backgroundColor: color.onInkLevel, overflow: 'hidden' },
  progressFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.textOnInk, transformOrigin: 'left' },

  face: { borderRadius: radius.pill },
  faceMono: { backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },

  stamp: { paddingVertical: spaceHalf['1.5'], paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.md, borderWidth: borderWidth.stamp, backgroundColor: color.onInkDisc },
  stampShort: { borderColor: color.successFill, transform: [{ rotate: rotation.stamp }] },
  stampPass: { borderColor: color.dangerFill, transform: [{ rotate: rotation['stamp-alt'] }] },
  stampText: { letterSpacing: trackingNative.eyebrow },

  ctl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.lg, paddingTop: space.md, paddingBottom: spaceHalf['2.5'] },
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  roundLight: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  roundDark: { backgroundColor: color.ink },
  roundLift: { boxShadow: shadow['deck-skip'] },
  roundDarkLift: { boxShadow: shadow['deck-save'] },
  roundOff: { opacity: opacity.disabled - 0.05 },

  toast: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, height: height.control, paddingLeft: spaceHalf['3.5'], paddingRight: space.sm, borderRadius: radius.tile, backgroundColor: color.ink, flexDirection: 'row', alignItems: 'center', gap: space.sm, boxShadow: shadow.toast },
  toastUndo: { height: spaceHalf['4.5'] * 2 - 2, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.ctl, justifyContent: 'center' },
  toastUndoText: { color: color.accentMuted },

  lock: { flex: 1, borderRadius: radius.deck, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  lockHead: { width: height['room-tile-w'] - space.sm, height: height['room-tile-w'] - space.sm, borderRadius: radius.pill, backgroundColor: color.inkSilhouette, marginBottom: -space.xs },
  lockBody: { width: height['lock-shoulders-w'], height: height['lock-shoulders-h'], borderTopLeftRadius: height['lock-shoulders-w'] / 2, borderTopRightRadius: height['lock-shoulders-w'] / 2, backgroundColor: color.inkSilhouette, marginTop: spaceHalf['2.5'] },
  lockOver: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spaceHalf['2.5'] },
  lockDisc: { width: height.fab - 4, height: height.fab - 4, borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
})
