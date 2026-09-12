import React from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '../components/Logo'
import { UnfinishedCard } from '../components/UnfinishedCard'
import { PayBar } from '../components/PayBar'
import { api } from '../lib/api'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative, borderWidth, height, leadingNative, trackingNative } from '../theme'

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
export function HomeScreen({ onPay, onProfile }: { onPay: () => void; onProfile: () => void }) {
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
        <Text style={styles.muted}>Could not load your account.</Text>
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
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header name={me.data.name} />
        <View style={styles.paid}>
          <Text style={styles.eyebrow}>
            {me.data.unusedCount > 0 ? 'YOUR INTERVIEW IS WAITING' : 'WELCOME BACK'}
          </Text>
          <Text style={styles.headline}>Let&apos;s finish</Text>
          <Text style={[styles.headline, styles.headlineMuted]}>your profile.</Text>
          <Text style={styles.link} onPress={onProfile}>Continue where you left off →</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Header name={me.data.name} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>
          {firstName ? `${firstName.toUpperCase()} · ACCOUNT CREATED` : 'ACCOUNT CREATED'}
        </Text>
        <Text style={styles.headline}>One conversation</Text>
        <Text style={[styles.headline, styles.headlineMuted]}>away from being seen.</Text>

        <View style={styles.cardWrap}>
          <UnfinishedCard
            name={me.data.name ?? 'Your name'}
            city={me.data.city}
            qualificationLabel={qualificationLabel}
          />
          <Text style={styles.caption}>
            This is the card an employer sees. Everything but the film is already yours.
          </Text>
        </View>

        <View style={styles.beats}>
          {BEATS.map((b) => (
            <View key={b.n} style={styles.beat}>
              <Text style={styles.beatNumber}>{b.n}</Text>
              <View style={styles.beatBody}>
                <Text style={styles.beatTitle}>{b.title}</Text>
                <Text style={styles.beatText}>{b.body}</Text>
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
  muted: { color: color.textMuted, fontSize: fontSize.base },
  header: {
    height: height['app-bar'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['20'],
  },
  // 44pt target around a 34pt circle.
  avatarTarget: { width: height.tap, height: height.tap, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  avatar: {
    width: height.avatar, height: height.avatar, borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize['12'], color: color.textMuted, fontWeight: fontWeight.medium },
  scroll: { paddingHorizontal: space['20'], paddingTop: space['14'], paddingBottom: space['2xl'] },
  eyebrow: { fontSize: fontSize.xs, letterSpacing: trackingNative.eyebrow, color: color.textSubtle },
  headline: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['30'],
    lineHeight: leadingNative.display,
    color: color.text,
    marginTop: space.md,
  },
  headlineMuted: { color: color.textMuted, marginTop: 0 },
  cardWrap: { marginTop: space['22'] },
  caption: { marginTop: space['14'], fontSize: fontSize.sm, lineHeight: leadingNative.bodyLg, color: color.textSubtle },
  beats: { marginTop: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  beat: { flexDirection: 'row', gap: space['13'], paddingVertical: space['14'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  beatNumber: { fontFamily: fontFamilyNative.display, fontSize: fontSize['12-5'], color: color.accent, width: space['20'], paddingTop: space['2'] },
  beatBody: { flex: 1 },
  beatTitle: { fontSize: fontSize['13-5'], fontWeight: fontWeight.medium, color: color.text },
  beatText: { marginTop: space['2'], fontSize: fontSize['13-5'], lineHeight: leadingNative.bodyLg, color: color.textMuted },
  paid: { paddingHorizontal: space['20'], paddingTop: space['3xl'] },
  link: { marginTop: space.xl, fontSize: fontSize['16'], color: color.accent, fontWeight: fontWeight.semibold },
})
