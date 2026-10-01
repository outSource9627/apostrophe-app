import React, { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Body, InkButton, text } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { LogoMark } from '../components/Logo'
import { borderWidth, color, height, radius, space } from '../theme'

type Props = {
  /** Opens the Create account entry (candidate or hiring). */
  onGetStarted: () => void
  onSignIn: () => void
}

const AUTOPLAY_MS = 3800

const SLIDES = [
  {
    key: 'meet',
    title: 'Beyond resumes.\nMeet the person.',
    body: 'A hiring app built on real, verified video interviews.',
  },
  {
    key: 'interview',
    title: 'One live interview.\nYour video resume.',
    body: 'A real person interviews you. The recording becomes your verified profile.',
  },
  {
    key: 'hired',
    title: 'Swipe. Shortlist.\nGet hired.',
    body: 'Employers watch, shortlist and reach out. No first-round screening calls.',
  },
] as const

/**
 * The app's first screen — a short intro, not a page. Three slides carry the
 * pitch; one button leads on to Create account, one link to Sign in. Which
 * account type a person is gets decided there, not here.
 *
 * No shadows anywhere on this screen: depth comes from layered tints.
 */
export function WelcomeScreen({ onGetStarted, onSignIn }: Props) {
  const insets = useSafeAreaInsets()
  const { width, height: screenH } = useWindowDimensions()
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)

  const go = (i: number) => {
    indexRef.current = i
    setIndex(i)
    scroller.current?.scrollTo({ x: i * width, animated: true })
  }

  // Auto-advance. A manual swipe restarts the clock because `index` changes.
  useEffect(() => {
    const t = setTimeout(() => go((indexRef.current + 1) % SLIDES.length), AUTOPLAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width])

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    indexRef.current = i
    setIndex(i)
  }

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width={width} height={screenH} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="ground" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={color.accentBright} />
            <Stop offset="0.5" stopColor={color.accentHover} />
            <Stop offset="1" stopColor={color.accentDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={screenH} fill="url(#ground)" />
      </Svg>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={[styles.brand, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.brandTile}>
          <LogoMark size={height['brand-mark'] * 0.55} fill={color.accent} />
        </View>
        <Text style={[text.displaySm, styles.onInk]}>apostrophe</Text>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.carousel}
      >
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.art}>
              {i === 0 ? <FilmPair /> : <GlyphTile name={i === 1 ? 'video' : 'arrowR'} />}
            </View>
            <Text style={[text.displayGreet, styles.onInk]}>{s.title}</Text>
            <Text style={[text.uiBase, styles.sub]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Pressable key={s.key} hitSlop={space.sm} onPress={() => go(i)} accessibilityLabel={`Slide ${i + 1}`}>
            <View style={[styles.dot, i === index && styles.dotOn]} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.cta, { paddingBottom: insets.bottom + space.xl }]}>
        <InkButton variant="solid" label="Get started" onPress={onGetStarted} />
        <InkButton variant="ghost" label="I already have an account" onPress={onSignIn} />
        <Body size="xs" style={styles.terms}>By continuing you agree to our Terms & Privacy Policy</Body>
      </View>
    </View>
  )
}

/** Two tilted film cards — a verified interview, shown without inventing anyone. */
function FilmPair() {
  return (
    <View style={styles.pair}>
      <View style={[styles.film, styles.filmLeft]}>
        <View style={styles.seal}><Icon name="check" size={14} tint={color.textInverse} weight={2.6} /></View>
        <View style={styles.filmLabel}>
          <Text style={[text.uiXsSemi, styles.filmText]}>Verified interview</Text>
        </View>
      </View>
      <View style={[styles.film, styles.filmRight]}>
        <View style={styles.seal}><Icon name="check" size={14} tint={color.textInverse} weight={2.6} /></View>
        <View style={styles.filmLabel}>
          <Text style={[text.uiXsSemi, styles.filmText]}>Verified interview</Text>
        </View>
      </View>
    </View>
  )
}

function GlyphTile({ name }: { name: 'video' | 'arrowR' }) {
  return (
    <View style={styles.glyphTile}>
      <Icon name={name} size={height['brand-mark'] * 1.6} tint={color.textInverse} weight={1.5} />
    </View>
  )
}

const FILM_W = 150
const FILM_H = 220

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.accentHover, overflow: 'hidden' },
  onInk: { color: color.textInverse },
  sub: { color: color.onInkDisc, opacity: 0.8, marginTop: space.md },

  orbTop: {
    position: 'absolute', width: 380, height: 380, borderRadius: radius.pill,
    right: -140, top: -90, backgroundColor: color.onInkWash,
  },
  orbBottom: {
    position: 'absolute', width: 300, height: 300, borderRadius: radius.pill,
    left: -150, bottom: 140, backgroundColor: color.onInkWash,
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl + space.sm },
  brandTile: {
    width: height['brand-mark'], height: height['brand-mark'], borderRadius: radius.tile,
    backgroundColor: color.textInverse, alignItems: 'center', justifyContent: 'center',
  },

  carousel: { flex: 1 },
  slide: { paddingHorizontal: space.xl + space.sm, justifyContent: 'center' },
  art: { height: FILM_H + space['2xl'], marginBottom: space['2xl'], alignItems: 'center', justifyContent: 'center' },

  pair: { width: '100%', height: FILM_H, alignItems: 'center', justifyContent: 'center' },
  film: {
    position: 'absolute', width: FILM_W, height: FILM_H, borderRadius: radius.modal,
    backgroundColor: color.accentSoft, padding: space.md, justifyContent: 'flex-end',
  },
  filmLeft: { left: space['3xl'], top: space.sm, transform: [{ rotate: '-8deg' }] },
  filmRight: { right: space['3xl'], top: 0, transform: [{ rotate: '7deg' }], backgroundColor: color.accentMuted },
  seal: {
    position: 'absolute', top: space.md, right: space.md, width: height['avatar-lg'], height: height['avatar-lg'],
    borderRadius: radius.pill, backgroundColor: color.successFill, alignItems: 'center', justifyContent: 'center',
  },
  filmLabel: { backgroundColor: color.surface, borderRadius: radius.tile, paddingHorizontal: space.md, paddingVertical: space.sm },
  filmText: { color: color.text },

  glyphTile: {
    width: FILM_W, height: FILM_W, borderRadius: radius.modal, backgroundColor: color.onInkGround,
    borderWidth: borderWidth.medium, borderColor: color.onInkEdge, alignItems: 'center', justifyContent: 'center',
  },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  dot: { width: space.sm - 1, height: space.sm - 1, borderRadius: radius.pill, backgroundColor: color.onInkTrack },
  dotOn: { width: space['2xl'] - space.xs, backgroundColor: color.textInverse },

  cta: { paddingHorizontal: space.xl + space.sm, gap: space.xs },
  terms: { color: color.textOnInkSubtle, textAlign: 'center', marginTop: space.sm },
})
