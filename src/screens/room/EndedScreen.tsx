import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview } from '../../lib/api/interviews'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow } from '../../components/ui'

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

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Body tone="muted">Loading…</Body></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your interview.</Body></View>)

  const incomplete = q.data!.status === 'INCOMPLETE'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <View style={styles.body}>
        <View style={{ gap: space.md }}>
          <Eyebrow>{incomplete ? 'Interview ended early' : 'That is a wrap'}</Eyebrow>
          <Display level="lg">{incomplete ? 'Your interview was marked incomplete.' : 'Your video is being made.'}</Display>
          {incomplete ? (
            <View style={styles.warnWell}>
              <Body size="sm" style={{ color: color.warning }}>The session ended before it finished, so it did not become a video resume. Your paid interview still stands — book the rest of it whenever you are ready.</Body>
            </View>
          ) : (
            <Body size="base" tone="muted">It takes up to an hour, then joins the employer feed on its own — there is no approval step to wait for.</Body>
          )}
        </View>

        {!incomplete && (
          <View style={styles.card}>
            <Step label="Now" body="Your interview is being edited into your 9:16 video resume." />
            <Step label="Within the hour" body="It publishes itself and starts appearing to employers." />
            <Step label="Within a day" body="Your feedback — five scores, strengths and improvements — lands here." />
          </View>
        )}

        <View style={{ gap: space.sm }}>
          {incomplete && <Button variant="outline" size="block" full label="Book the rest of it" onPress={onBook} />}
          <Button variant="outline" size="block" full label="Back to my interviews" onPress={onBack} />
        </View>
      </View>
    </View>
  )
}

function Step({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={{ width: 116 }}><Eyebrow>{label}</Eyebrow></View>
      <Body size="sm" style={{ flex: 1, color: color.text }}>{body}</Body>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: space.xl, gap: space['2xl'], justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg, gap: space.md },
  step: { flexDirection: 'row', gap: space.md },
  warnWell: { borderRadius: radius.md, backgroundColor: color.warningSoft, padding: space.md },
})
