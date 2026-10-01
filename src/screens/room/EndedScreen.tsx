import React, { useEffect } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview } from '../../lib/api/interviews'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Banner } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, Skel, StateBlock } from '../../components/tab/kit'
import { Disc, Eyebrow, FlowFooter, FlowHeader, Lead, Sub } from '../../components/tab/flow'

/**
 * ST-31 — interview ended. The video is being prepared (up to an hour) and
 * publishes ITSELF with no approval step; feedback within 24 hours. No
 * refund/error/sorry language. COMPLETED → processing; INCOMPLETE → ended early.
 */
export function EndedScreen({ id, onBack, onDetail, onRejoin }: {
  id: string; onBack: () => void; onDetail: () => void; onRejoin?: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => getInterview(id) })
  // An admin has reviewed the session: the status now names the outcome, and the interview screen tells that story
  // (and what the student is owed). This screen is only for a session still waiting for that review.
  const st = q.data?.status
  const reviewed = Boolean(q.data?.reviewedAs) && st !== 'COMPLETED' && st !== 'INCOMPLETE'
  useEffect(() => {
    if (reviewed) onDetail()
  }, [reviewed, onDetail])

  const bar = <FlowHeader onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending || reviewed) return frame(<View style={styles.body}><Skel w={56} h={56} round /><Skel w="70%" h={28} /><Skel w="100%" h={90} /></View>)
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your interview." />)

  const incomplete = q.data!.status === 'INCOMPLETE'
  // The student pressed Leave but the interviewer has not ended the session — it is still running.
  const running = q.data!.status === 'IN_PROGRESS' || q.data!.status === 'BOOKED'
  const iv = q.data!.interviewer
  // SC-16 reveal: name (and, when the server sends them, photo and headline) only once the session started.
  const reveal = iv?.name ? (
    <View style={styles.reveal}>
      {iv.photoUrl ? <Image source={{ uri: iv.photoUrl }} style={styles.revealPhoto} accessibilityLabel={iv.name} /> : null}
      <View style={styles.stepText}>
        <Text style={styles.t15s}>{`Interviewed by ${iv.name}`}</Text>
        {!!(iv.headline || iv.company) && <Text style={styles.small}>{[iv.headline, iv.company].filter(Boolean).join(' · ')}</Text>}
      </View>
    </View>
  ) : null

  if (running) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        {bar}
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.head}>
            <Lead>You left the interview.</Lead>
            <Sub>It is still running — only your interviewer can end it. You can rejoin while it is in progress.</Sub>
          </View>
          {reveal}
        </ScrollView>
        <FlowFooter>
          {onRejoin && <Btn label="Rejoin the interview" onPress={onRejoin} />}
          <Btn variant="outline" label="Back to my interviews" onPress={onBack} />
        </FlowFooter>
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Disc tone={incomplete ? 'warn' : 'ok'}>
          {incomplete
            ? <Text style={styles.bang}>!</Text>
            : <Icon name="check" size={26} tint={color.successFill} weight={2.2} />}
        </Disc>
        <View style={styles.head}>
          <Eyebrow tone={incomplete ? 'warn' : 'ok'}>
            {incomplete ? 'INTERVIEW ENDED EARLY' : 'THAT IS A WRAP'}
          </Eyebrow>
          <Lead>{incomplete ? 'Your interview is under review.' : 'Your video is being made.'}</Lead>
          {!incomplete && (
            <Sub>It joins the employer feed on its own — there is no approval step to wait for.</Sub>
          )}
        </View>

        {reveal}
        {incomplete ? (
          <Banner tone="warning">The session ended before it finished, so it did not become a video resume. Our team is reviewing what happened. If it was not on you, a free re-interview is added to your account and you will be told here and in your notifications.</Banner>
        ) : (
          <View>
            <Text style={styles.listHead}>What happens next</Text>
            <Step n="1" label="Now" body="Your interview is being edited into your 9:16 video resume." />
            <Step n="2" label="Next" body="It publishes itself and starts appearing to employers." />
            <Step n="3" label="Within a day" body="Your feedback — five scores, strengths and improvements — lands here." last />
          </View>
        )}
      </ScrollView>

      <FlowFooter>
        <Btn variant={incomplete ? 'outline' : 'ink'} label="Back to my interviews" onPress={onBack} />
      </FlowFooter>
    </View>
  )
}

function Step({ n, label, body, last }: { n: string; label: string; body: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepRule]}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <View style={styles.stepText}>
        <Text style={styles.t15s}>{label}</Text>
        <Text style={styles.small}>{body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 20, paddingBottom: 28 },
  bang: { fontFamily: FF.bodyBold, fontSize: 26, color: color.warning },
  head: { gap: 8 },
  t15s: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  small: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
  listHead: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text, marginBottom: 6 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 12 },
  stepRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: FF.monoMedium, fontSize: 11, color: color.accentText },
  reveal: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  revealPhoto: { width: 44, height: 44, borderRadius: 22 },
  stepText: { flex: 1, gap: 2 },
})
