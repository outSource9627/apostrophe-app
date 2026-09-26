import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmEmpty, EmError, EmPills } from '../../components/employer/em'
import {
  EMPLOYER_APPLICATION_STATUS_LABEL, fetchJobApplications, type ApplicationRow, type ApplicationStatus,
} from '../../lib/api/employerJobs'
import { experienceLine, nameInitials } from '../../lib/employer/candidateFormat'
import { APPLICATION_TONE, istDay } from '../../lib/employer/jobs'
import type { RootStackParamList } from '../../../App'

type Tab = 'ALL' | ApplicationStatus
const ORDER: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'REJECTED', 'CONNECTED']
const PER_PAGE = 100

/**
 * EM-20 · the applicants to one post (Employer Android): pill tabs with the
 * server's counts, then a row per application — the film thumb, the name, the
 * city and experience, and where the application stands. The list summary
 * carries no tier or salary, so the row leaves them out (the web's call).
 */
export function JobApplicationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'JobApplications'>>()
  const focused = useIsFocused()
  const { id } = route.params

  const [rows, setRows] = useState<ApplicationRow[] | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [counts, setCounts] = useState<Partial<Record<ApplicationStatus, number>>>({})
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('ALL')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchJobApplications(id, { perPage: PER_PAGE })
      setRows(res.rows)
      setJobTitle(res.job?.title ?? '')
      setCounts(res.counts ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the applicants.')
    }
  }, [id])

  // Every return reads again: a status changed on the applicant shows here.
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  const all = rows?.length ?? 0
  const count = (s: ApplicationStatus) => counts[s] ?? (rows ?? []).filter((r) => r.status === s).length
  const shown = useMemo(() => (tab === 'ALL' ? rows ?? [] : (rows ?? []).filter((r) => r.status === tab)), [rows, tab])

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load the applicants." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if (all === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty icon="users" title="No applicants yet." body="Applications appear here as students apply to this post." />
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
            items={[{ key: 'ALL', label: 'All', count: all }, ...ORDER.filter((s) => count(s) > 0).map((s) => ({ key: s, label: EMPLOYER_APPLICATION_STATUS_LABEL[s], count: count(s) }))]}
            value={tab}
            onChange={setTab}
          />
        }
        ListHeaderComponentStyle={styles.pillsWrap}
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
          const c = item.candidate
          const name = c?.name ?? 'Candidate'
          const sub = [c?.city, experienceLine(c?.experienceYears)].filter(Boolean).join(' · ')
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${EMPLOYER_APPLICATION_STATUS_LABEL[item.status]}`}
              onPress={() => navigation.navigate('ApplicantDetail', { id: item.id })}
              style={({ pressed }) => [styles.row, c && !c.available && styles.rowGone, pressed && styles.pressed]}
            >
              <View style={styles.thumb}>
                {c?.photoUrl ? <Image source={{ uri: c.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
                  <Text style={[text.uiSmSemi, styles.thumbText]}>{nameInitials(name)}</Text>
                )}
              </View>
              <View style={styles.grow}>
                <Text style={text.uiBaseSemi} numberOfLines={1}>{name}</Text>
                {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
                <View style={styles.meta}>
                  <EmBadge label={EMPLOYER_APPLICATION_STATUS_LABEL[item.status]} tone={APPLICATION_TONE[item.status]} small />
                  <Text style={[text.metaSm, styles.subtle]}>{`APPLIED ${istDay(item.appliedAt).toUpperCase()}`}</Text>
                </View>
              </View>
              <Icon name="chevR" size={spaceHalf['4.5']} tint={color.textSubtle} />
            </Pressable>
          )
        }}
      />
    )
  }

  return (
    <EmployerShell back={() => navigation.goBack()} title="Applicants" sub={jobTitle ? jobTitle.toUpperCase() : undefined} scroll={false}>
      {body}
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  gap: { height: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.panel, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md },
  rowGone: { opacity: opacity.disabled + 0.25 },
  thumb: { width: height.avatar, aspectRatio: aspect.videoResume, borderRadius: radius.ctl, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbText: { color: color.textOnInkMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space['2xs'] },
})
