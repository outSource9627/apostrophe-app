import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmEmpty, EmError, EmPerson, EmPills, initialsOf, type EmTone } from '../../components/employer/em'
import {
  fetchAllEmployerInterests, interestNextEligibleAt, liveInterestOutcome, type EmployerInterestRow, type InterestOutcome,
} from '../../lib/api/employerInterests'
import { formatIst } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'
import { SendInterestSheet } from './SendInterestModal'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | InterestOutcome

const BADGE: Record<InterestOutcome, { label: string; tone: EmTone }> = {
  SENT: { label: 'Sent', tone: 'violet' },
  ACCEPTED: { label: 'Accepted', tone: 'green' },
  NOT_ACCEPTED: { label: 'Not accepted', tone: 'gray' },
}

/** '8 OCT' in IST, for the row's mono line. */
const day = (iso: string) => formatIst(iso).split(' · ')[0].split(' ').slice(0, 2).join(' ').toUpperCase()

/**
 * EM-16 · Interests (outbound), Employer Android. Pill tabs with counts — All,
 * Sent, Accepted, Not accepted (a decline and an expiry are the same outcome to
 * the sender, so there is no Expired tab). Each row: the person, the outcome
 * badge, the message sent, the linked job, and one mono line — when it
 * expires, when it connected, or when the next can go — with the one action:
 * Open chat once connected, Send again once the cooldown has passed. EM-16b is
 * the empty list.
 */
export function EmployerInterestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { state } = useEmployer()
  const verified = Boolean(state?.verified)
  const cfg = useShortlistConfig()
  const jobs = useEmployerJobRefs(verified)

  const [rows, setRows] = useState<EmployerInterestRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [now, setNow] = useState(() => new Date())
  const [resend, setResend] = useState<EmployerInterestRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await fetchAllEmployerInterests())
      setNow(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your sent Interests.')
    }
  }, [])

  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  // A SENT Interest past its expiry already reads Not accepted, without waiting for the server's sweep.
  const outcomeOf = useCallback((r: EmployerInterestRow) => liveInterestOutcome(r, now), [now])
  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, SENT: 0, ACCEPTED: 0, NOT_ACCEPTED: 0 }
    for (const r of rows ?? []) c[outcomeOf(r)] += 1
    return c
  }, [rows, outcomeOf])
  const shown = tab === 'all' ? rows ?? [] : (rows ?? []).filter((r) => outcomeOf(r) === tab)
  const jobTitle = (id: string | null) => (id ? jobs?.find((j) => j.id === id)?.title ?? null : null)

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your Interests." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if (counts.all === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty
          icon="heart"
          title="No Interests yet."
          body="Send one from your shortlist or a profile. If accepted, a chat opens."
          action={<Button variant="primary" size="pair" label="Open shortlist" onPress={() => navigation.navigate('EmployerShortlist')} />}
        />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <EmPills<Tab>
            items={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'SENT', label: 'Sent', count: counts.SENT },
              { key: 'ACCEPTED', label: 'Accepted', count: counts.ACCEPTED },
              { key: 'NOT_ACCEPTED', label: 'Not accepted', count: counts.NOT_ACCEPTED },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
        ListHeaderComponentStyle={styles.pillsWrap}
        ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here.</Text>}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.textSubtle}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
        renderItem={({ item }) => {
          const outcome = outcomeOf(item)
          const next = interestNextEligibleAt(item, cfg.interestCooldownDays)
          const coolingDown = !!next && next.getTime() > now.getTime()
          const line =
            outcome === 'SENT'
              ? `EXPIRES ${day(item.expiresAt)}`
              : outcome === 'ACCEPTED'
                ? item.closedAt ? `CONNECTED ${day(item.closedAt)}` : 'ACCEPTED'
                : coolingDown && next ? `NEXT FROM ${day(next.toISOString())}` : `SENT ${day(item.sentAt)}`
          const job = jobTitle(item.jobId)
          return (
            <EmCard>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CandidateProfile', { id: item.candidateId })} style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
                <EmPerson initials={initialsOf(item.name)} size={height.tap} />
                <View style={styles.grow}>
                  <Text style={text.uiBaseSemi} numberOfLines={1}>{item.name}</Text>
                  {!!job && (
                    <View style={styles.job}>
                      <Icon name="brief" size={space.md} tint={color.textMuted} />
                      <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{job}</Text>
                    </View>
                  )}
                </View>
                <EmBadge label={BADGE[outcome].label} tone={BADGE[outcome].tone} small />
              </Pressable>
              {!!item.message && <Text style={[text.uiSm, styles.message]} numberOfLines={3}>{item.message}</Text>}
              <View style={styles.foot}>
                <Text style={[text.metaSm, styles.mono, styles.muted]}>{line}</Text>
                {outcome === 'ACCEPTED' && item.connected ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="chat"
                    label="Open chat"
                    onPress={() => (item.threadId ? navigation.navigate('EmployerThread', { id: item.threadId }) : navigation.navigate('EmployerChats'))}
                  />
                ) : outcome === 'NOT_ACCEPTED' && !coolingDown ? (
                  <Button variant="outline" size="sm" label="Send again" onPress={() => setResend(item)} />
                ) : null}
              </View>
            </EmCard>
          )
        }}
      />
    )
  }

  return (
    <EmployerShell title="Interests" sub="OUTBOUND" scroll={false}>
      {body}
      {resend && (
        <SendInterestSheet
          open
          candidate={{ id: resend.candidateId, name: resend.name }}
          onClose={() => setResend(null)}
          onSent={() => { load() }}
        />
      )}
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  mono: { letterSpacing: trackingNative.eyebrow },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  gap: { height: spaceHalf['2.5'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  job: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  message: { color: color.textSecondary, borderLeftWidth: borderWidth.accent, borderLeftColor: color.border, paddingLeft: space.md },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, minHeight: height.tap },
})
