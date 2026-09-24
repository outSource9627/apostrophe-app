import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Segmented } from './controls'
import { TabTitle } from './student'
import { text } from './typography'

/**
 * The job deck's pieces (Android M11): the card in its two shapes (a text post
 * and a video post), the row of round actions under it, and the undo toast.
 * Presentational only — the drag, the deck and what a save does belong to the
 * screen.
 */

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

function JobDeckCardView({
  company, title, pay, meta, skills, posted, video, saved,
}: {
  company: string
  title: string
  pay?: string | null
  /** The uppercase mono line — location · type · experience · deadline. */
  meta: string
  skills: string[]
  posted?: string | null
  /** Set for a video post: its length as "0:48". */
  video?: { duration: string } | null
  saved?: boolean
}) {
  if (video) {
    return (
      <View style={styles.videoCard}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="deckVideo" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.accentDeep} />
              <Stop offset="0.7" stopColor={color.inkRaised} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#deckVideo)" />
        </Svg>
        <View style={styles.playWrap}>
          <View style={styles.play}>
            <Svg width={height.glyph} height={height.glyph} viewBox="0 0 24 24"><Path d="M8 5.5v13l11-6.5z" fill={color.textInverse} /></Svg>
          </View>
        </View>
        <View style={styles.videoTop}>
          <View style={styles.glass}>
            <View style={styles.liveDot} />
            <Text style={[text.metaSm, styles.onInk]}>VIDEO JOB · {video.duration}</Text>
          </View>
          <View style={styles.logoOnInk}><Text style={[text.metaMd, styles.logoInkText]}>{initialsOf(company)}</Text></View>
        </View>
        <View style={styles.videoFoot}>
          <Text style={[text.uiXs, styles.onInkSoft]}>{company}</Text>
          <Text style={[text.displayHeading, styles.onInk]}>{title}</Text>
          {!!pay && <Text style={[text.uiLgSemi, styles.onInk]}>{pay}</Text>}
          <Text style={[text.metaSm, styles.onInkSoft]}>{meta}</Text>
          <View style={styles.chips}>
            {skills.slice(0, 4).map((s) => (
              <View key={s} style={styles.chipOnInk}><Text style={[text.metaSm, styles.onInk]}>{s.toUpperCase()}</Text></View>
            ))}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.textCard}>
      <View style={styles.companyRow}>
        <View style={styles.logo}><Text style={[text.metaMd, styles.logoText]}>{initialsOf(company)}</Text></View>
        <View style={styles.companyText}>
          <Text style={text.uiBaseSemi} numberOfLines={1}>{company}</Text>
          {!!posted && <Text style={[text.uiXs, styles.subtle]}>{posted}</Text>}
        </View>
        {saved && (
          <View style={styles.savedPill}><Text style={[text.metaSm, styles.savedText]}>SAVED</Text></View>
        )}
      </View>
      <Text style={text.displayHeading}>{title}</Text>
      {!!pay && <Text style={text.displaySm}>{pay}</Text>}
      <Text style={[text.metaMd, styles.meta]}>{meta}</Text>
      <View style={styles.chips}>
        {skills.slice(0, 6).map((s) => (
          <View key={s} style={styles.chip}><Text style={[text.metaMd, styles.chipText]}>{s.toUpperCase()}</Text></View>
        ))}
      </View>
      <Text style={[text.metaSm, styles.tapHint]}>TAP FOR DETAILS</Text>
    </View>
  )
}

type DeckCardProps = React.ComponentProps<typeof JobDeckCardView>
/**
 * Memoised: the deck re-renders on every busy/undo change, and a card (with its
 * SVG gradient) should only redraw when what it shows changes.
 */
export const JobDeckCard = React.memo(JobDeckCardView, (a: DeckCardProps, b: DeckCardProps) =>
  a.company === b.company && a.title === b.title && a.pay === b.pay && a.meta === b.meta &&
  a.skills === b.skills && a.posted === b.posted && a.saved === b.saved && a.video?.duration === b.video?.duration)

/** The save / not-interested stamps laid over a card as it is dragged. */
export function DeckStamp({ kind }: { kind: 'save' | 'skip' }) {
  const save = kind === 'save'
  return (
    <View style={[styles.stamp, save ? styles.stampSave : styles.stampSkip]}>
      <Text style={[text.uiLgSemi, { color: save ? color.successFill : color.dangerFill }]}>{save ? 'SAVE' : 'NOT INTERESTED'}</Text>
    </View>
  )
}

type Glyph = 'undo' | 'skip' | 'save' | 'info'
function ActionGlyph({ kind, tint }: { kind: Glyph; tint: string }) {
  const p = { stroke: tint, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const }
  return (
    <Svg width={height.glyph} height={height.glyph} viewBox="0 0 24 24">
      {kind === 'undo' && <Path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12" {...p} transform="translate(0 -6)" />}
      {kind === 'skip' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {kind === 'save' && <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...p} fill={tint} />}
      {kind === 'info' && (<><Path d="M12 11v6M12 7.5v.01" {...p} /><Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" {...p} /></>)}
    </Svg>
  )
}

/** Undo · not interested · save · details — the buttons that back the gesture. */
export function DeckActions({
  onUndo, onSkip, onSave, onInfo, canUndo, disabled,
}: { onUndo: () => void; onSkip: () => void; onSave: () => void; onInfo: () => void; canUndo: boolean; disabled?: boolean }) {
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Undo" disabled={!canUndo || disabled} onPress={onUndo}
        style={[styles.roundSm, { opacity: canUndo ? 1 : opacity.disabled }]}><ActionGlyph kind="undo" tint={color.textSecondary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Not interested" disabled={disabled} onPress={onSkip}
        style={[styles.roundLg, styles.roundSkip]}><ActionGlyph kind="skip" tint={color.dangerFill} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Save" disabled={disabled} onPress={onSave}
        style={[styles.roundLg, styles.roundSave]}><ActionGlyph kind="save" tint={color.textInverse} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Details" onPress={onInfo}
        style={styles.roundSm}><ActionGlyph kind="info" tint={color.textSecondary} /></Pressable>
    </View>
  )
}

/** The ink toast under the deck: what just happened, and the one way back. */
export function UndoToast({ title, note, onUndo, disabled }: { title: string; note: string; onUndo: () => void; disabled?: boolean }) {
  return (
    <View style={styles.toast}>
      <View style={styles.toastText}>
        <Text style={[text.uiSm, styles.onInk]} numberOfLines={1}>{title}</Text>
        <Text style={[text.uiXs, styles.onInkSoft]} numberOfLines={1}>{note}</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onUndo} style={styles.toastBtn}>
        <Text style={[text.uiSmSemi, styles.undoText]}>UNDO</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  textCard: { flex: 1, borderRadius: radius.xl, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.xl, gap: spaceHalf['2.5'] },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: height['deck-logo'], height: height['deck-logo'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: color.textSecondary },
  companyText: { flex: 1, gap: space['2xs'] },
  subtle: { color: color.textSubtle },
  savedPill: { paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.pill, backgroundColor: color.successSoft },
  savedText: { color: color.success },
  meta: { color: color.textMuted, letterSpacing: trackingNative.meta, lineHeight: height.glyph },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  chip: { height: height['chip-sm'], paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: color.text },
  tapHint: { marginTop: 'auto', textAlign: 'center', color: color.textSubtle, letterSpacing: trackingNative.eyebrow },

  videoCard: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: color.ink },
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: height['deck-play'], height: height['deck-play'], borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
  videoTop: { position: 'absolute', top: space.lg, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], borderRadius: radius.pill, backgroundColor: color.onInkGlass, paddingHorizontal: spaceHalf['2.5'], paddingVertical: spaceHalf['1.5'] },
  liveDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.dangerOnInk },
  logoOnInk: { width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.md, backgroundColor: color.onInkDisc, alignItems: 'center', justifyContent: 'center' },
  logoInkText: { color: color.text },
  videoFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spaceHalf['4.5'], paddingTop: height['deck-action'] + space.lg, gap: space.sm, backgroundColor: color.scrimStrong },
  onInk: { color: color.textOnInk },
  onInkSoft: { color: color.textOnInkMuted },
  chipOnInk: { height: height['chip-sm'], paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.onInkEdge, alignItems: 'center', justifyContent: 'center' },

  stamp: { position: 'absolute', top: space.xl, paddingHorizontal: space.md, paddingVertical: spaceHalf['1.5'], borderRadius: radius.md, borderWidth: borderWidth.accent, backgroundColor: color.onInkBadge, zIndex: 2 },
  stampSave: { left: space.xl, borderColor: color.successFill, transform: [{ rotate: '-12deg' }] },
  stampSkip: { right: space.xl, borderColor: color.dangerFill, transform: [{ rotate: '12deg' }] },

  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceHalf['4.5'], paddingVertical: space.lg },
  roundSm: { width: height['deck-action-sm'], height: height['deck-action-sm'], borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  roundLg: { width: height['deck-action'], height: height['deck-action'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  roundSkip: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  roundSave: { backgroundColor: color.ink },

  toast: { flexDirection: 'row', alignItems: 'center', height: height['control'], marginHorizontal: space.lg, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.tile, backgroundColor: color.ink, gap: space.sm },
  toastText: { flex: 1, minWidth: 0 },
  toastBtn: { height: height['chip-lg'], paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  undoText: { color: color.accentMuted },
})

type JobsTab = 'For you' | 'Saved' | 'Applied'

/** The Jobs title and its three-way switch — the same header on the deck, Saved and Applied (M11/M12). */
export function JobsHeader({
  active, onFeed, onSaved, onApplied, right,
}: { active: JobsTab; onFeed?: () => void; onSaved?: () => void; onApplied?: () => void; right?: React.ReactNode }) {
  return (
    <>
      <TabTitle title="Jobs" right={right} />
      <View style={jobsStyles.seg}>
        <Segmented
          options={['For you', 'Saved', 'Applied'] as const}
          value={active}
          onChange={(v) => {
            if (v === active) return
            if (v === 'For you') onFeed?.()
            else if (v === 'Saved') onSaved?.()
            else onApplied?.()
          }}
        />
      </View>
    </>
  )
}

/**
 * Where an application has reached, as a row of dots joined by a line (M12).
 * Read-only: the pipeline is the employer's to move. `reached` counts the dots
 * lit, so a rejected application can pass 0 and draw nothing lit.
 */
export function PipelineDots({ steps, reached }: { steps: number; reached: number }) {
  return (
    <View style={jobsStyles.pipe}>
      {Array.from({ length: steps }).map((_, i) => {
        const done = i < reached
        return (
          <View key={i} style={jobsStyles.pipeCell}>
            <View style={[jobsStyles.pipeDot, done ? jobsStyles.pipeDotOn : jobsStyles.pipeDotOff]} />
            {i < steps - 1 && <View style={[jobsStyles.pipeBar, { backgroundColor: i < reached - 1 ? color.accent : color.border }]} />}
          </View>
        )
      })}
    </View>
  )
}

const jobsStyles = StyleSheet.create({
  seg: { marginHorizontal: space.lg, marginBottom: space.xs },
  pipe: { flexDirection: 'row', alignItems: 'center' },
  pipeCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pipeDot: { width: height['status-dot'] + space['2xs'], height: height['status-dot'] + space['2xs'], borderRadius: radius.pill },
  pipeDotOn: { backgroundColor: color.accent },
  pipeDotOff: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  pipeBar: { flex: 1, height: space['2xs'] },
})
