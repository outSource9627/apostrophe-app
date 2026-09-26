import React from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, ErrorState, Skeleton, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmMono, initialsOf } from '../../components/employer/em'
import type { EmployerState } from '../../lib/api/employer'
import { fetchEmployerJobs } from '../../lib/api/employerJobs'
import { companySizeLabel } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'

export interface EmployerCompanyScreenProps {
  onBack: () => void
}

/**
 * EM-07 · Company profile — what a candidate sees on a job post or an Interest.
 *
 * The design's monogram, name and badge, the one-line facts, and the live jobs.
 * Left out, as on the web: the About block (the record has no such field) and
 * the Edit button (there is no endpoint to update the company). The badge is
 * earned or absent — a pending company gets no greyed badge; the strip above
 * already says where verification stands. Live jobs are read only once
 * verified: a pending account has none and the API refuses the read.
 */
export function EmployerCompanyScreen({ onBack }: EmployerCompanyScreenProps) {
  const { state, error, refresh } = useEmployer()

  return (
    <EmployerShell back={onBack} title="Company profile">
      {state ? (
        <Profile state={state} />
      ) : error ? (
        <ErrorState
          title="We could not load your company."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      ) : (
        <Skeleton lines={4} />
      )}
    </EmployerShell>
  )
}

function Profile({ state }: { state: EmployerState }) {
  const { company } = state
  const site = company.website ? websiteLabel(company.website) : null
  const facts = [company.industry, companySizeLabel(company.size), company.officeLocation].filter(Boolean).join(' · ')

  return (
    <>
      <View style={styles.identity}>
        <View style={styles.mono}><Text style={[text.displayCard, styles.monoText]}>{initialsOf(company.name)}</Text></View>
        <View style={styles.naming}>
          <Text style={text.displayCard}>{company.name}</Text>
          {state.verified && <EmBadge label="Verified employer" tone="green" icon="shield" small />}
        </View>
      </View>

      <Text style={[text.uiMd, styles.muted]}>
        {facts}
        {!!site && (
          <>
            {' · '}
            <Text
              accessibilityRole="link"
              style={styles.link}
              onPress={() => Linking.openURL(websiteHref(company.website!)).catch(() => undefined)}
            >
              {site}
            </Text>
          </>
        )}
      </Text>

      {state.verified && <LiveJobs />}

      <Text style={[text.uiXs, styles.subtle]}>
        {state.verified
          ? 'Students see this on your job posts and Interests.'
          : 'Students see this once your company is verified.'}
      </Text>
    </>
  )
}

/** LIVE JOBS · N, each title opening its job. Nothing is drawn while there are none or the read failed. */
function LiveJobs() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const jobs = useQuery({ queryKey: ['employer', 'jobs', 'live'], queryFn: () => fetchEmployerJobs({ status: 'PUBLISHED', perPage: 50 }) })
  if (!jobs.data || jobs.data.rows.length === 0) return null
  const n = jobs.data.counts.PUBLISHED ?? jobs.data.total
  return (
    <EmCard>
      <EmMono>{`LIVE JOBS · ${n}`}</EmMono>
      {jobs.data.rows.map((j) => (
        <Pressable
          key={j.id}
          accessibilityRole="button"
          onPress={() => navigation.navigate('EmployerJobDetail', { id: j.id })}
          style={({ pressed }) => [styles.job, pressed && styles.pressed]}
        >
          <Text style={[text.uiBaseSemi, styles.grow]} numberOfLines={1}>{j.title}</Text>
          <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
        </Pressable>
      ))}
    </EmCard>
  )
}

/** 'copperleaf.test' → 'https://copperleaf.test'. An address that already has a scheme is left alone. */
function websiteHref(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`
}

/** 'https://www.copperleaf.test/' → 'copperleaf.test' — the address as a person reads it out. */
function websiteLabel(site: string): string {
  return site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  link: { color: color.textMuted, textDecorationLine: 'underline', textDecorationColor: color.borderStrong },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  mono: { width: height.fab + 4, height: height.fab + 4, borderRadius: radius.panel, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  monoText: { color: color.textSecondary },
  naming: { flex: 1, gap: spaceHalf['1.5'], alignItems: 'flex-start' },
  job: { minHeight: height.tap, flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
