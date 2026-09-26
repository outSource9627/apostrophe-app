import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmEmpty, EmError, EmIconButton, EmPills } from '../../components/employer/em'
import { nameInitials, tierLine } from '../../lib/employer/candidateFormat'
import {
  exportShortlist, fetchAllShortlist, removeFromShortlist, type ShortlistRow,
} from '../../lib/api/employerShortlist'
import {
  fetchAllEmployerInterests, interestNextEligibleAt, liveInterestOutcome, type EmployerInterestRow, type SendInterestResult,
} from '../../lib/api/employerInterests'
import { linkableJobs, useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'
import { useEmployer } from '../../lib/employer/useEmployer'
import { SendInterestSheet } from './SendInterestModal'
import { ShortlistEntrySheet } from './ShortlistEntryModal'
import type { RootStackParamList } from '../../../App'

type Slot = { pill: { label: string; tone: 'violet' | 'green' | 'gray' } | null; cta: 'send' | 'sent' | 'chat' }

/** What a row's Interest slot says, from the joined Interest and the cooldown (the web's rule). */
function interestSlot(interest: EmployerInterestRow | null, known: boolean, cooldownDays: number | undefined, now: Date): Slot {
  if (interest?.connected) return { pill: { label: 'Connected', tone: 'green' }, cta: 'chat' }
  if (!interest) return { pill: known ? { label: 'No Interest sent', tone: 'gray' } : null, cta: 'send' }
  const outcome = liveInterestOutcome(interest, now)
  if (outcome === 'SENT') return { pill: { label: 'Interest sent', tone: 'violet' }, cta: 'sent' }
  if (outcome === 'ACCEPTED') return { pill: { label: 'Accepted', tone: 'green' }, cta: 'sent' }
  const next = interestNextEligibleAt(interest, cooldownDays)
  return { pill: { label: 'Not accepted', tone: 'gray' }, cta: next && next.getTime() > now.getTime() ? 'sent' : 'send' }
}

const PILL: Record<'violet' | 'green' | 'gray', { bg: string; fg: string }> = {
  violet: { bg: color.accentSoft, fg: color.accentText },
  green: { bg: color.successSoft, fg: color.success },
  gray: { bg: color.surfaceMuted, fg: color.textSecondary },
}

/**
 * EM-14 · Shortlist (Employer Android). Private, filled from right swipes. The
 * bar counts the candidates and exports a CSV; the pills filter by tag. Each
 * row: the film thumb (opens the full interview), the name, where the Interest
 * stands, the tags, the private note, the linked job, and three actions —
 * remove, notes/tags/job (EM-15) and the Interest action (Send, Sent, or Open
 * chat once connected). EM-14b is the empty shortlist.
 */
export function EmployerShortlistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { state } = useEmployer()
  const verified = Boolean(state?.verified)
  const cfg = useShortlistConfig()
  const allJobs = useEmployerJobRefs(verified)
  const jobs = useMemo(() => (allJobs ? linkableJobs(allJobs) : []), [allJobs])

  const [rows, setRows] = useState<ShortlistRow[] | null>(null)
  const [interests, setInterests] = useState<Map<string, EmployerInterestRow> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tag, setTag] = useState('')
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<ShortlistRow | null>(null)
  const [interestFor, setInterestFor] = useState<ShortlistRow | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    setError(null)
    try {
      const [list, sent] = await Promise.all([fetchAllShortlist(), fetchAllEmployerInterests().catch(() => null)])
      setRows(list)
      setInterests(sent && new Map(sent.map((i) => [i.candidateId, i])))
      setNow(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your shortlist.')
    }
  }, [])

  // Every return to the tab reads again: a right swipe in the feed adds a row.
  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  const tags = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows ?? []) for (const t of r.tags) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [rows])
  const activeTag = tags.includes(tag) ? tag : ''
  const shown = useMemo(() => (activeTag ? (rows ?? []).filter((r) => r.tags.includes(activeTag)) : rows ?? []), [rows, activeTag])
  const jobTitle = (id: string | null) => (id ? allJobs?.find((j) => j.id === id)?.title ?? null : null)

  async function runExport() {
    setExporting(true)
    setNotice(null)
    try {
      const res = await exportShortlist({ tag: activeTag || undefined })
      if (res.url) await Linking.openURL(res.url)
      setNotice(`Exported ${res.rows} ${res.rows === 1 ? 'candidate' : 'candidates'} · ${res.filename}`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not export your shortlist.')
    } finally {
      setExporting(false)
    }
  }

  function remove(row: ShortlistRow) {
    Alert.alert('Remove from shortlist?', `${row.name} leaves your private shortlist. Their note and tags go with them.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFromShortlist(row.id)
            setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Could not remove that candidate.')
          }
        },
      },
    ])
  }

  function interestSent(res: SendInterestResult) {
    setNow(new Date())
    setInterests((prev) => {
      const next = new Map(prev ?? [])
      const row = rows?.find((r) => r.candidateId === res.candidateId)
      next.set(res.candidateId, {
        id: res.id, candidateId: res.candidateId, name: row?.name ?? '', outcome: 'SENT', message: null, jobId: null,
        sentAt: res.sentAt, expiresAt: res.expiresAt, closedAt: null, connected: false, nextEligibleAt: res.nextEligibleAt ?? null, threadId: null,
      })
      return next
    })
  }

  const total = rows?.length ?? 0
  const header = (
    <>
      {tags.length > 0 && (
        <EmPills
          items={[{ key: '', label: 'All tags' }, ...tags.map((t) => ({ key: t, label: t }))]}
          value={activeTag}
          onChange={setTag}
        />
      )}
      {!!notice && <Text style={[text.uiSm, styles.notice]}>{notice}</Text>}
    </>
  )

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your shortlist." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if (total === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty
          icon="bookmark"
          title="Shortlist is empty."
          body="Swipe right in the feed to add someone. Candidates only see an anonymous count."
          action={<Button variant="primary" size="pair" label="Open feed" onPress={() => navigation.navigate('EmployerFeed')} />}
        />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
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
        renderItem={({ item }) => (
          <Row
            row={item}
            slot={interestSlot(interests?.get(item.candidateId) ?? null, interests !== null, cfg.interestCooldownDays, now)}
            jobTitle={jobTitle(item.jobId)}
            onPlay={() => navigation.navigate('CandidateVideo', { id: item.candidateId, name: item.name, photoUrl: item.photoUrl, interviewAt: item.verifiedInterview.at })}
            onProfile={() => navigation.navigate('CandidateProfile', { id: item.candidateId })}
            onRemove={() => remove(item)}
            onEntry={() => setEditing(item)}
            onInterest={() => setInterestFor(item)}
            onChat={() => {
              const threadId = interests?.get(item.candidateId)?.threadId
              if (threadId) navigation.navigate('EmployerThread', { id: threadId })
              else navigation.navigate('EmployerChats')
            }}
          />
        )}
      />
    )
  }

  return (
    <EmployerShell
      title="Shortlist"
      sub={`PRIVATE · ${total} ${total === 1 ? 'CANDIDATE' : 'CANDIDATES'}`}
      scroll={false}
      right={
        <EmIconButton
          name="download"
          label="Export the shortlist as CSV"
          bordered="strong"
          disabled={exporting || total === 0}
          onPress={() => { runExport() }}
        />
      }
    >
      {body}

      <ShortlistEntrySheet
        open={!!editing}
        row={editing}
        knownTags={tags}
        jobs={jobs}
        onClose={() => setEditing(null)}
        onSaved={(u) => setRows((prev) => (prev ?? []).map((r) => (r.id === u.id ? { ...r, notes: u.notes ?? '', tags: u.tags, jobId: u.jobId } : r)))}
      />

      {interestFor && (
        <SendInterestSheet
          open
          candidate={{
            id: interestFor.candidateId,
            name: interestFor.name,
            photoUrl: interestFor.photoUrl,
            tier: interestFor.tier,
            qualification: interestFor.qualification,
            city: interestFor.city,
            verified: interestFor.verifiedInterview.verified,
          }}
          jobs={jobs}
          onClose={() => setInterestFor(null)}
          onSent={interestSent}
        />
      )}
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

function Row({
  row, slot, jobTitle, onPlay, onProfile, onRemove, onEntry, onInterest, onChat,
}: {
  row: ShortlistRow
  slot: Slot
  jobTitle: string | null
  onPlay: () => void
  onProfile: () => void
  onRemove: () => void
  onEntry: () => void
  onInterest: () => void
  onChat: () => void
}) {
  const sub = [tierLine(row.tier, row.qualification), row.city].filter(Boolean).join(' · ')
  const pill = slot.pill ? PILL[slot.pill.tone] : null
  return (
    <View style={[styles.row, !row.available && styles.rowGone]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${row.name}’s interview`} onPress={onPlay} disabled={!row.available} style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}>
          {row.photoUrl ? <Image source={{ uri: row.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
            <Text style={[text.uiLgSemi, styles.thumbInitials]}>{nameInitials(row.name)}</Text>
          )}
          <View style={styles.thumbDisc}><Icon name="tri" size={space.md - 2} tint={color.ink} fill={color.ink} weight={1.5} /></View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onProfile} disabled={!row.available} style={styles.who}>
          <Text style={text.uiLeadSemi} numberOfLines={1}>{row.name}</Text>
          {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
          {!row.available ? (
            <Text style={[text.uiXs, styles.muted]}>No longer on Apostrophe</Text>
          ) : pill && slot.pill ? (
            <View style={[styles.slotPill, { backgroundColor: pill.bg }]}><Text style={[text.metaXs, { color: pill.fg }]}>{slot.pill.label.toUpperCase()}</Text></View>
          ) : null}
          {row.tags.length > 0 && (
            <View style={styles.tags}>
              {row.tags.slice(0, 2).map((t) => (
                <View key={t} style={styles.ptag}>
                  <Icon name="tag" size={space.md} tint={color.accentText} weight={2} />
                  <Text style={[text.uiXsMedium, styles.accent]} numberOfLines={1}>{t}</Text>
                </View>
              ))}
              {row.tags.length > 2 && <Text style={[text.uiXs, styles.muted]}>{`+${row.tags.length - 2}`}</Text>}
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.note}>
        <Text style={[text.uiSm, row.notes ? styles.secondary : styles.noteEmpty]}>{row.notes || 'No private note yet.'}</Text>
      </View>
      <View style={styles.job}>
        <Icon name="brief" size={space.md + 1} tint={jobTitle ? color.textSecondary : color.textSubtle} />
        <Text style={[text.uiXs, jobTitle ? styles.secondary : styles.subtle]} numberOfLines={1}>{jobTitle ?? 'No job linked'}</Text>
      </View>

      <View style={styles.actions}>
        <EmIconButton name="trash" label={`Remove ${row.name}`} tint={color.danger} bordered="danger" onPress={onRemove} />
        <EmIconButton name="note" label="Notes, tags and job" bordered="soft" onPress={onEntry} />
        {slot.cta === 'chat' ? (
          <Button variant="primary" size="md" label="Open chat" style={styles.grow} onPress={onChat} />
        ) : slot.cta === 'sent' ? (
          <Button variant="quiet" size="md" label="Interest sent" disabled style={styles.grow} />
        ) : (
          <Button variant="primary" size="md" label="Send Interest" disabled={!row.available} style={styles.grow} onPress={onInterest} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  accent: { color: color.accentText },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  notice: { color: color.textSecondary, paddingHorizontal: space.xs, paddingBottom: space.md },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  gap: { height: spaceHalf['2.5'] },

  row: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.lg, padding: space.md, gap: spaceHalf['2.5'] },
  rowGone: { opacity: opacity.disabled + 0.25 },
  top: { flexDirection: 'row', gap: space.md },
  thumb: { width: height['deck-logo'] + space.lg + 2, aspectRatio: aspect.videoResume, borderRadius: radius.md, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbInitials: { color: color.textOnInkMuted },
  thumbDisc: { position: 'absolute', width: height.radio + 8, height: height.radio + 8, borderRadius: radius.pill, backgroundColor: color.onInkBadge, alignItems: 'center', justifyContent: 'center', paddingLeft: space['2xs'] },
  who: { flex: 1, minWidth: 0, gap: spaceHalf['1.5'] },
  slotPill: { alignSelf: 'flex-start', height: height['count-chip'], paddingHorizontal: space.sm, borderRadius: radius.pill, justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  ptag: { height: height['count-chip'] + space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.ctl, backgroundColor: color.accentSoft, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], maxWidth: '100%' },
  note: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, paddingVertical: space.sm + 1, paddingHorizontal: space.md },
  noteEmpty: { color: color.textMuted, fontStyle: 'italic' },
  job: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
})
