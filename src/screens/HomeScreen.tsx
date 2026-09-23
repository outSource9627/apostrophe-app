import React from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '../components/Logo'
import { UnfinishedCard } from '../components/UnfinishedCard'
import { PayBar } from '../components/PayBar'
import { api } from '../lib/api'
import { Body, Card, Display, ErrorState, Eyebrow, Meta, ObjectRow } from '../components/ui'
import { color, space, radius, fontSize, fontWeight, borderWidth, height } from '../theme'

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
 * card they already half own, and makes paying the obvious next move.
 */
export function HomeScreen({
  onPay, onProfile, onInterviews, onVisibility, onProfileView, onJobs, onApplications, onInterests, onConnections, onChats, onNotifications, onStats, onAccount,
}: { onPay: () => void; onProfile: () => void; onInterviews?: () => void; onVisibility?: () => void; onProfileView?: () => void; onJobs?: () => void; onApplications?: () => void; onInterests?: () => void; onConnections?: () => void; onChats?: () => void; onNotifications?: () => void; onStats?: () => void; onAccount?: () => void }) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  if (me.isPending || config.isPending) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.textSubtle} />
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

  const tier = config.data.qualifications.find((q) => q.value === me.data.qualification)?.tier
  const price = config.data.tiers.find((t) => t.tier === tier)
  const firstName = me.data.name?.split(' ')[0]
  const qualificationLabel = me.data.qualification
    ? QUALIFICATION_LABEL[me.data.qualification] ?? me.data.qualification
    : undefined

  if (me.data.paid) {
    // Same destinations, same conditions, same handlers as before — only
    // reshaped into data so the list can render through `ObjectRow` inside a
    // `Card`, the way a drill-in menu reads elsewhere in the app (see e.g.
    // InterviewerAccountScreen's "Account Actions & Shortcuts").
    const links: { label: string; onPress: () => void }[] = [
      { label: 'Continue where you left off →', onPress: onProfile },
      ...(onInterviews ? [{ label: 'My interviews →', onPress: onInterviews }] : []),
      ...(onProfileView ? [{ label: 'My profile →', onPress: onProfileView }] : []),
      ...(onJobs ? [{ label: 'Job feed →', onPress: onJobs }] : []),
      ...(onApplications ? [{ label: 'My applications →', onPress: onApplications }] : []),
      ...(onInterests ? [{ label: 'Interests →', onPress: onInterests }] : []),
      ...(onConnections ? [{ label: 'Connections →', onPress: onConnections }] : []),
      ...(onChats ? [{ label: 'Chats →', onPress: onChats }] : []),
      ...(onNotifications ? [{ label: 'Notifications →', onPress: onNotifications }] : []),
      ...(onStats ? [{ label: 'Your stats →', onPress: onStats }] : []),
      ...(onAccount ? [{ label: 'Account →', onPress: onAccount }] : []),
      ...(onVisibility ? [{ label: 'Visibility →', onPress: onVisibility }] : []),
    ]

    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header name={me.data.name} />
        <View style={styles.paid}>
          <Eyebrow>
            {me.data.unusedCount > 0 ? 'YOUR INTERVIEW IS WAITING' : 'WELCOME BACK'}
          </Eyebrow>
          <Display level="md" style={styles.headline}>Let&apos;s finish</Display>
          <Display level="md" style={styles.headlineMuted}>your profile.</Display>
          <Card style={styles.linksCard}>
            {links.map((l, i) => (
              <ObjectRow key={l.label} title={l.label} onPress={l.onPress} last={i === links.length - 1} />
            ))}
          </Card>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Header name={me.data.name} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Eyebrow>
          {firstName ? `${firstName.toUpperCase()} · ACCOUNT CREATED` : 'ACCOUNT CREATED'}
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

function Header({ name }: { name?: string }) {
  const initials = name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <View style={styles.header}>
      <Logo size={17} />
      {!!initials && (
        <View style={styles.avatarTarget}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: {
    height: height['app-bar'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  // 44pt target around a 34pt circle.
  avatarTarget: { width: height.tap, height: height.tap, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  avatar: {
    width: height.avatar, height: height.avatar, borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize['ui-xs'], color: color.textMuted, fontWeight: fontWeight.medium },
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
  paid: { paddingHorizontal: space.xl, paddingTop: space['3xl'] },
  linksCard: { marginTop: space.xl },
})
