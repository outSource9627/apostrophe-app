import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { UnfinishedCard } from '../components/UnfinishedCard'
import { PaidHome } from './home/PaidHome'
import { PayBar } from '../components/PayBar'
import { api } from '../lib/api'
import { AppHeader, Avatar, Body, Display, ErrorState, Eyebrow, Meta, Skeleton } from '../components/ui'
import { color, space, borderWidth } from '../theme'

interface Me {
  paid: boolean
  name?: string
  city?: string
  qualification?: string
  unusedCount: number
}
interface Config {
  qualifications: { value: string; tier: string }[]
  tiers: { tier: string; amountPaise: number; durationMin: number }[]
}

const QUALIFICATION_LABEL: Record<string, string> = {
  CLASS_12: 'Class 12',
  GRADUATION: 'Graduation',
  POST_GRADUATION: 'Post Graduation',
  PHD: 'PhD',
}

const BEATS = [
  { n: '01', title: 'Pick a slot that suits you', body: 'Evenings and weekends included.' },
  { n: '02', title: 'Talk to a person, not a form', body: 'Twenty minutes on video.' },
  { n: '03', title: 'Employers come to you', body: 'Shortlists stay private until someone sends Interest.' },
]

/**
 * Where signing in lands. ST-12 — an unpaid student may sign in, see pricing,
 * read static content and pay, and nothing else.
 *
 * So this does not hide the product behind a locked door: it shows them the
 * card they already half own, and makes paying the obvious next move. Once
 * paid, Home is the design's dashboard (Student App Android, M4).
 */
export function HomeScreen({
  onPay, onBook, onJoin, onReschedule, onFeedback, onVideoResume, onChat, onInterests, onInterviews, onSavedJobs, onApplications,
}: {
  onPay: () => void
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
  onFeedback: (id: string) => void
  onVideoResume: () => void
  onChat: () => void
  onInterests: () => void
  onInterviews: () => void
  onSavedJobs: () => void
  onApplications: () => void
}) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  if (me.isPending || config.isPending) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <AppHeader />
        <View style={styles.scroll}><Skeleton lines={3} /></View>
      </View>
    )
  }

  if (me.isError || !me.data || !config.data) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ErrorState title="Could not load your account." />
      </View>
    )
  }

  const initials = initialsOf(me.data.name)

  if (me.data.paid) {
    // The paid dashboard is its own screen body; it draws its own header, so no top inset here.
    return (
      <PaidHome
        me={me.data}
        onBook={onBook}
        onJoin={onJoin}
        onReschedule={onReschedule}
        onFeedback={onFeedback}
        onVideoResume={onVideoResume}
        onChat={onChat}
        onInterests={onInterests}
        onInterviews={onInterviews}
        onSavedJobs={onSavedJobs}
        onApplications={onApplications}
      />
    )
  }

  const tier = config.data.qualifications.find((q) => q.value === me.data.qualification)?.tier
  const price = config.data.tiers.find((t) => t.tier === tier)
  const firstName = me.data.name?.split(' ')[0]
  const qualificationLabel = me.data.qualification
    ? QUALIFICATION_LABEL[me.data.qualification] ?? me.data.qualification
    : undefined

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppHeader>{!!initials && <Avatar initials={initials} />}</AppHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Eyebrow>
          {firstName ? `${firstName} · Account created` : 'Account created'}
        </Eyebrow>
        <Display level="md" style={styles.headline}>One conversation</Display>
        <Display level="md" style={styles.headlineMuted}>away from being seen.</Display>

        <View style={styles.cardWrap}>
          <UnfinishedCard
            name={me.data.name ?? 'Your name'}
            city={me.data.city}
            qualificationLabel={qualificationLabel}
          />
          <Body size="sm" tone="subtle" style={styles.caption}>
            This is the card an employer sees. Everything but the film is already yours.
          </Body>
        </View>

        <View style={styles.beats}>
          {BEATS.map((b) => (
            <View key={b.n} style={styles.beat}>
              <Meta style={styles.beatNumber}>{b.n}</Meta>
              <View style={styles.beatBody}>
                <Body size="sm" weight="medium">{b.title}</Body>
                <Body size="sm" tone="muted" style={styles.beatText}>{b.body}</Body>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <PayBar
        amountPaise={price?.amountPaise}
        tierLabel={qualificationLabel}
        durationMin={price?.durationMin}
        onPay={onPay}
      />
    </View>
  )
}

const initialsOf = (name?: string) => name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? ''

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['2xl'] },
  headline: { marginTop: space.md },
  headlineMuted: { color: color.textMuted, marginTop: 0 },
  cardWrap: { marginTop: space.xl },
  caption: { marginTop: space.lg },
  beats: { marginTop: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  beat: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  beatNumber: { width: space.xl, paddingTop: space['2xs'] },
  beatBody: { flex: 1 },
  beatText: { marginTop: space['2xs'] },

})
