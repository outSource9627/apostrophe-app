import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { aspect, borderWidth, color, fontFamilyNative, height, radius, space } from '../../theme'
import { Body, Display, Eyebrow, VerifiedSeal, text } from '../ui'
import { Glyph, type GlyphName } from './parts'

/**
 * EM-04 · what opens when the employer is verified: the candidate feed,
 * explained and never shown.
 *
 * A DRAWING OF A CARD, NOT A CARD. The film is a dashed placeholder ground with
 * an Illustration tag, the name and qualification are skeleton bars, and the
 * shortlist count reads N. There is no face, no name, no footage and nothing
 * blurred — nothing that implies it will un-blur on approval, because there is
 * no paywall to tease. It takes no props: no real candidate can reach it.
 *
 * No score, rating or recommendation sits on the anatomy. The Verified
 * Interview mark (the library VerifiedSeal, crimson doing its own job) and the
 * shortlist count are the whole signal.
 */

/** The film well: the unfinished-profile height at 9:16. */
const FILM_H = height['well-compact']
const FILM_W = FILM_H * aspect.videoResume

const CALLOUTS: { title: string; body?: string }[] = [
  { title: 'The interview film', body: 'Recorded live on the call, 9:16. Tap a card for the full film.' },
  { title: 'Name, qualification and city' },
  { title: 'The Verified Interview mark', body: 'A person on our panel ran the interview, on the date the mark shows.' },
  { title: 'The shortlist count', body: 'How many employers shortlisted them. A number, never who.' },
]

export function FeedExplainer() {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Eyebrow>What opens when you are verified</Eyebrow>
        <Display level="sm">The candidate feed</Display>
        <Body size="sm" tone="muted">
          Each card is one candidate and the interview they sat. This is a drawing of a card; there is no candidate in it.
        </Body>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Drawing of a candidate card: a 9:16 interview film, the name and qualification, the Verified Interview mark and a shortlist count."
        style={styles.anatomy}
      >
        <View style={styles.row}>
          <View style={styles.film}>
            <View style={styles.illustration}>
              <Text style={[text.metaPill, styles.illustrationText]}>Illustration</Text>
            </View>
            <View style={styles.playWrap}>
              <View style={styles.play}>
                <Glyph name="play" size={space.lg} tint={color.borderStrong} />
              </View>
            </View>
            <View style={styles.bars}>
              <View style={[styles.bar, styles.barName]} />
              <View style={[styles.bar, styles.barMeta]} />
            </View>
          </View>
          <View style={styles.filmMarkers}>
            <Marker n={1} />
            <Marker n={2} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.column}>
            <VerifiedSeal />
          </View>
          <Marker n={3} />
        </View>

        <View style={styles.row}>
          <View style={[styles.column, styles.shortlist]}>
            <Glyph name="bookmark" size={space.md + space['2xs']} tint={color.textMuted} />
            <Body size="xs" tone="muted">
              Shortlisted by N employers
            </Body>
          </View>
          <Marker n={4} />
        </View>
      </View>

      <View style={styles.callouts}>
        {CALLOUTS.map((c, i) => (
          <View key={c.title} style={styles.callout}>
            <Marker n={i + 1} />
            <View style={styles.grow}>
              <Text style={[text.uiSm, styles.calloutTitle]}>{c.title}</Text>
              {!!c.body && (
                <Body size="xs" tone="muted">
                  {c.body}
                </Body>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.swipes}>
        <SwipeTile glyph="arrowLeft" label="Swipe left to pass" />
        <SwipeTile glyph="arrowRight" label="Swipe right to shortlist" />
      </View>

      <Body size="xs" tone="muted">
        No score, rating or recommendation sits on a card. The mark and the shortlist count are the whole signal; the
        judgement is yours.
      </Body>
    </View>
  )
}

function Marker({ n }: { n: number }) {
  return (
    <View style={styles.marker} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[text.metaPill, styles.markerText]}>{n}</Text>
    </View>
  )
}

function SwipeTile({ glyph, label }: { glyph: GlyphName; label: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileGlyph}>
        <Glyph name={glyph} />
      </View>
      <Body size="sm" style={styles.grow}>
        {label}
      </Body>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  head: { gap: space.sm },
  grow: { flex: 1 },

  anatomy: { gap: space.md, paddingLeft: space['3xl'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  column: { width: FILM_W },

  film: {
    width: FILM_W,
    height: FILM_H,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },
  illustration: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: space.xs,
    paddingVertical: space['2xs'],
  },
  illustrationText: { color: color.textMuted },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: space['3xl'],
  },
  play: {
    width: height.control,
    height: height.control,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { position: 'absolute', left: space.md, right: space.md, bottom: space.lg, gap: space.sm },
  bar: { borderRadius: radius.sm, backgroundColor: color.surfaceSunken },
  barName: { width: '85%', height: space.md },
  barMeta: { width: '58%', height: space.sm },
  filmMarkers: { alignSelf: 'stretch', justifyContent: 'space-between', paddingVertical: space.xs },

  shortlist: { flexDirection: 'row', alignItems: 'center', gap: space.xs },

  marker: {
    width: space.xl,
    height: space.xl,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: color.textMuted, letterSpacing: 0 },

  callouts: { gap: space.sm },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  calloutTitle: { fontFamily: fontFamilyNative.bodySemiBold },

  swipes: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  tileGlyph: {
    width: height.chip,
    height: height.chip,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
