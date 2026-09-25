import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { BrandMark, Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmBadge } from '../../components/employer/em'

/**
 * EM-01 · the employer's way in. The ink film card is decorative: the design's
 * sample name and date would read as a real person, so it keeps the obvious
 * placeholders ("Candidate name", QUALIFICATION · CITY · LENGTH) and the badge
 * carries no date — the same call the web landing makes.
 */
export function EmployerWelcomeScreen({ onCreate, onSignIn }: { onCreate: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brand}>
        <BrandMark />
        <Text style={text.uiLgSemi}>Apostrophe</Text>
      </View>

      <View style={styles.film} accessibilityRole="image" accessibilityLabel="An example of a verified interview film">
        <View style={styles.disc}>
          <View style={styles.play}><Icon name="tri" size={space.lg} tint={color.ink} fill={color.ink} weight={1.5} /></View>
        </View>
        <View style={styles.filmFoot}>
          <EmBadge label="Verified interview" tone="green" icon="check" small />
          <Text style={[text.displayCard, styles.onInk]}>Candidate name</Text>
          <Text style={[text.metaSm, styles.onInkMuted]}>QUALIFICATION · CITY · LENGTH</Text>
        </View>
      </View>

      <Text style={text.displayGreet}>
        The first interview <Text style={styles.muted}>has already happened.</Text>
      </Text>
      <Text style={[text.uiBase, styles.muted]}>
        Watch verified interviews, shortlist privately and send an Interest. Free for employers.
      </Text>
      <Button variant="primary" size="lg" full label="Create employer account" onPress={onCreate} />
      <Button variant="outline" size="block" full label="Sign in" onPress={onSignIn} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { flexGrow: 1, paddingHorizontal: space.xl, gap: spaceHalf['4.5'] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  film: { flexGrow: 1, minHeight: height['job-video'] + space['4xl'], borderRadius: radius.xl + 2, backgroundColor: color.ink, overflow: 'hidden' },
  disc: {
    position: 'absolute', top: '26%', alignSelf: 'center',
    width: height['room-tile-w'] - space.sm, height: height['room-tile-w'] - space.sm,
    borderRadius: radius.pill, backgroundColor: color.inkRaised, alignItems: 'center', justifyContent: 'center',
  },
  play: { width: height.control + 2, height: height.control + 2, borderRadius: radius.pill, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingLeft: space['2xs'] },
  filmFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, gap: spaceHalf['1.5'], backgroundColor: color.scrimStrong },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted, letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
})
