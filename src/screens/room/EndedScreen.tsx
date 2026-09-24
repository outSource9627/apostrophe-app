import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview } from '../../lib/api/interviews'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Banner, Body, Button, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'

/**
 * ST-31 — interview ended. The video is being prepared (up to an hour) and
 * publishes ITSELF with no approval step; feedback within 24 hours. No
 * refund/error/sorry language. COMPLETED → processing; INCOMPLETE → ended early.
 */
export function EndedScreen({ id, onBack, onBook }: {
  id: string; onBack: () => void; onBook: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => getInterview(id) })

  const bar = <ScreenHeader onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your interview.</Body></View>)

  const incomplete = q.data!.status === 'INCOMPLETE'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.disc, incomplete ? styles.discWarn : styles.discOk]}>
          <Text style={[text.displayLead, { color: incomplete ? color.warning : color.successFill }]}>{incomplete ? '!' : '✓'}</Text>
        </View>
        <View style={styles.head}>
          <Text style={[text.metaMd, styles.eyebrow, { color: incomplete ? color.warning : color.success }]}>
            {incomplete ? 'INTERVIEW ENDED EARLY' : 'THAT IS A WRAP'}
          </Text>
          <Text style={text.displayLead}>{incomplete ? 'Your interview was marked incomplete.' : 'Your video is being made.'}</Text>
          {!incomplete && (
            <Text style={[text.uiMd, styles.muted]}>It joins the employer feed on its own — there is no approval step to wait for.</Text>
          )}
        </View>

        {incomplete ? (
          <Banner tone="warning">The session ended before it finished, so it did not become a video resume. Your paid interview still stands — book the rest of it whenever you are ready.</Banner>
        ) : (
          <View>
            <Text style={[text.uiBaseSemi, styles.listHead]}>What happens next</Text>
            <Step n="1" label="Now" body="Your interview is being edited into your 9:16 video resume." />
            <Step n="2" label="Next" body="It publishes itself and starts appearing to employers." />
            <Step n="3" label="Within a day" body="Your feedback — five scores, strengths and improvements — lands here." last />
          </View>
        )}
      </ScrollView>

      <StickyFooter>
        {incomplete && <Button variant="primary" size="lg" full label="Book the rest of it" onPress={onBook} />}
        <Button variant={incomplete ? 'outline' : 'secondary'} size={incomplete ? 'md' : 'lg'} full label="Back to my interviews" onPress={onBack} />
      </StickyFooter>
    </View>
  )
}

function Step({ n, label, body, last }: { n: string; label: string; body: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepRule]}>
      <View style={styles.stepNum}><Text style={[text.metaMd, styles.stepNumText]}>{n}</Text></View>
      <View style={styles.stepText}>
        <Text style={text.uiMdSemi}>{label}</Text>
        <Text style={[text.uiSm, styles.muted]}>{body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spaceHalf['6'], gap: space.xl, paddingBottom: space.xl },
  disc: { width: height.fab, height: height.fab, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  discOk: { backgroundColor: color.successSoft },
  discWarn: { backgroundColor: color.warningSoft },
  head: { gap: space.sm },
  eyebrow: { letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  listHead: { marginBottom: spaceHalf['1.5'] },
  step: { flexDirection: 'row', gap: spaceHalf['3.5'], paddingVertical: space.md },
  stepRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  stepNum: { width: height.radio, height: height.radio, borderRadius: radius.pill, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: color.accentText },
  stepText: { flex: 1, gap: space['2xs'] },
})
