import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmDialog, EmError, EmIconButton, EmRadioRow, EmSheet } from '../../components/employer/em'
import { ChipRow, Face, IconSquare, NoteWell, StudioCard, StudioChip, StudioState, StudioToast } from '../../components/employer/studio'
import { experienceLine, interviewDate } from '../../lib/employer/candidateFormat'
import { label } from '../../lib/profile/labels'
import { interestClock } from '../../lib/chat/format'
import {
  exportShortlist, fetchAllShortlist, removeFromShortlist, type ShortlistQuery, type ShortlistRow,
} from '../../lib/api/employerShortlist'
import {
  fetchAllEmployerInterests, INTEREST_OUTCOME_LABEL, interestNextEligibleAt, liveInterestOutcome, type EmployerInterestRow, type SendInterestResult,
} from '../../lib/api/employerInterests'
import { linkableJobs, useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useCandidateDocument } from '../../lib/employer/useCandidateDocument'
import { SendInterestSheet } from './SendInterestModal'
import { ShortlistEntrySheet } from './ShortlistEntryModal'
import type { RootStackParamList } from '../../../App'

type Sort = NonNullable<ShortlistQuery['sort']>

/** The server's two sorts, in its own words (contracts/feed SHORTLIST_SORT_LABEL). */
const SORTS: { key: Sort; label: string }[] = [
  { key: 'ADDED', label: 'Recently added' },
  { key: 'INTERVIEWED', label: 'Recently interviewed' },
]
const sortLabel = (s: Sort) => SORTS.find((x) => x.key === s)?.label ?? ''

/** How long the export / remove notice stays over the list. */
const TOAST_MS = 4000

/** What the card's primary slot does: send, a quiet status line, or open the chat. */
type Slot = { kind: 'send' } | { kind: 'status'; label: string } | { kind: 'chat' }

/**
 * The Interest slot, from the joined Interest and the cooldown (the web's rule):
 * Send Interest → Interest sent · time left → Open chat once connected. A
 * declined or lapsed one reads “Not accepted” until the cooldown lets it go again.
 */
function interestSlot(interest: EmployerInterestRow | null, cooldownDays: number | undefined, now: Date): Slot {
  if (interest?.connected) return { kind: 'chat' }
  if (!interest) return { kind: 'send' }
  const outcome = liveInterestOutcome(interest, now)
  if (outcome === 'SENT') {
    const clock = interestClock(interest.sentAt, interest.expiresAt, now.getTime())
    return { kind: 'status', label: `${INTEREST_OUTCOME_LABEL.SENT} · ${clock.relative}` }
  }
  if (outcome === 'ACCEPTED') return { kind: 'status', label: INTEREST_OUTCOME_LABEL.ACCEPTED }
  const next = interestNextEligibleAt(interest, cooldownDays)
  return next && next.getTime() > now.getTime() ? { kind: 'status', label: INTEREST_OUTCOME_LABEL.NOT_ACCEPTED } : { kind: 'send' }
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0)
const byAdded = (a: ShortlistRow, b: ShortlistRow) => time(b.savedAt) - time(a.savedAt)

/** The server's order, kept in memory: ADDED is the swipe time; INTERVIEWED the interview date, unavailable rows last. */
function sortRows(list: ShortlistRow[], sort: Sort): ShortlistRow[] {
  if (sort === 'ADDED') return [...list].sort(byAdded)
  return [...list].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1
    if (!a.available) return byAdded(a, b)
    return time(b.verifiedInterview.at) - time(a.verifiedInterview.at) || byAdded(a, b)
  })
}

/** “B.Com · Tier 2 · Pune · 1.5 yrs” — only the facts the API sent. */
function metaLine(row: ShortlistRow): string {
  const exp = experienceLine(row.experienceYears)?.replace(' experience', '') ?? null
  return [row.qualification ? label(row.qualification) : null, row.tier, row.city, exp].filter(Boolean).join(' · ')
}

/**
 * EM-14 · Shortlist (Employer Android, Studio S1/S3). Private, filled from right
 * swipes. The bar counts the candidates, exports a CSV and sorts; the tag chips
 * filter, with the job and sort under them. Each card: the face (opens the
 * interview), the name and facts, the saved day, the note in its amber well,
 * the tags and the linked job, then remove, notes/tags/job (S2) and the
 * Interest action. S3 is the empty shortlist.
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
  const [jobFilter, setJobFilter] = useState('')
  const [sort, setSort] = useState<Sort>('ADDED')
  const [picker, setPicker] = useState<'job' | 'sort' | null>(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<ShortlistRow | null>(null)
  const [interestFor, setInterestFor] = useState<ShortlistRow | null>(null)
  const [removing, setRemoving] = useState<ShortlistRow | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const docs = useCandidateDocument()

  /** Reads the list and the Interests; resolves to the error it showed, if any. */
  const load = useCallback(async (): Promise<string | null> => {
    setError(null)
    try {
      const [list, sent] = await Promise.all([fetchAllShortlist(), fetchAllEmployerInterests().catch(() => null)])
      setRows(list)
      setInterests(sent && new Map(sent.map((i) => [i.candidateId, i])))
      setNow(new Date())
      return null
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load your shortlist.'
      setError(message)
      return message
    }
  }, [])

  // Every return to the tab reads again: a right swipe in the feed adds a row.
  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  // The notice says what happened, then gets out of the list's way.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [notice])

  const jobTitle = useCallback((id: string | null) => (id ? allJobs?.find((j) => j.id === id)?.title ?? null : null), [allJobs])

  const tags = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows ?? []) for (const t of r.tags) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [rows])
  // The jobs the shortlist actually links, named from the jobs list, so a job filter is never empty on its own.
  const jobOptions = useMemo(() => {
    const ids = [...new Set((rows ?? []).map((r) => r.jobId).filter((id): id is string => !!id))]
    return ids.flatMap((id) => {
      const title = jobTitle(id)
      return title ? [{ id, title }] : []
    })
  }, [rows, jobTitle])

  const activeTag = tags.includes(tag) ? tag : ''
  const activeJob = jobOptions.some((j) => j.id === jobFilter) ? jobFilter : ''
  const shown = useMemo(
    () => sortRows((rows ?? []).filter((r) => (!activeTag || r.tags.includes(activeTag)) && (!activeJob || r.jobId === activeJob)), sort),
    [rows, activeTag, activeJob, sort],
  )

  async function runExport() {
    setExporting(true)
    setNotice(null)
    try {
      const res = await exportShortlist({ tag: activeTag || undefined, jobId: activeJob || undefined, sort })
      if (res.url) await Linking.openURL(res.url)
      setNotice(`Exported ${res.rows} ${res.rows === 1 ? 'candidate' : 'candidates'} · ${res.filename}`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not export your shortlist.')
    } finally {
      setExporting(false)
    }
  }

  /** ST-35 — the card's CV: the résumé's 15-minute link, opened by the phone. */
  async function openResume(row: ShortlistRow) {
    if (!row.resume) return
    setNotice(null)
    const failed = await docs.open(row.candidateId, row.resume.id)
    if (failed) setNotice(failed)
  }

  async function confirmRemove() {
    const row = removing
    if (!row) return
    setRemoveBusy(true)
    try {
      await removeFromShortlist(row.id)
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not remove that candidate.')
    } finally {
      setRemoveBusy(false)
      setRemoving(null)
    }
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
  const empty = rows !== null && total === 0 && !error

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your shortlist." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if (empty) {
    // S3 — the Studio empty state, one way back to the feed.
    body = (
      <View style={styles.emptyWrap}>
        <StudioState icon="bookmark" title="Shortlist is empty." body="Swipe right in the feed to add someone. Candidates only see an anonymous count.">
          <Button variant="primary" size="md" icon="tri" label="Open feed" style={styles.emptyCta} onPress={() => navigation.navigate('EmployerFeed')} />
        </StudioState>
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.textSubtle}
            onRefresh={async () => {
              setRefreshing(true)
              const failed = await load()
              setRefreshing(false)
              // The list stays; the failed read says so over it.
              if (failed) setNotice(failed)
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.filtered}>
            <StudioState icon="tag" title={activeTag ? `No one tagged ‘${activeTag}’ yet.` : 'Shortlist is empty.'}>
              <Button variant="outline" size="md" label="Clear filter" onPress={() => { setTag(''); setJobFilter('') }} />
            </StudioState>
          </View>
        }
        renderItem={({ item }) => (
          <ShortlistCard
            row={item}
            slot={interestSlot(interests?.get(item.candidateId) ?? null, cfg.interestCooldownDays, now)}
            jobTitle={jobTitle(item.jobId)}
            onPlay={() => navigation.navigate('CandidateVideo', { id: item.candidateId, name: item.name, photoUrl: item.photoUrl, interviewAt: item.verifiedInterview.at })}
            onProfile={() => navigation.navigate('CandidateProfile', { id: item.candidateId })}
            onTag={(t) => setTag(t)}
            onJob={() => item.jobId && setJobFilter(item.jobId)}
            onRemove={() => setRemoving(item)}
            onEntry={() => setEditing(item)}
            opening={!!item.resume && docs.opening === item.resume.id}
            onResume={() => { openResume(item) }}
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
    <EmployerShell title="Shortlist" big={false} bar={empty} scroll={false}>
      {!empty && (
        <>
          {/* S1's bar: the title with its mono count, then Export and Sort in place of the bell. */}
          <View style={styles.bar}>
            <Text style={[text.displayXs, styles.grow]} numberOfLines={1} accessibilityRole="header">
              Shortlist
              {rows !== null && <Text style={text.metaLg}>{` ${total}`}</Text>}
            </Text>
            <EmIconButton
              name="download"
              label="Export the shortlist as CSV"
              tint={color.textSecondary}
              disabled={exporting || total === 0}
              onPress={() => { runExport() }}
            />
            <EmIconButton name="sort" label={`Sort: ${sortLabel(sort)}`} tint={color.textSecondary} disabled={total === 0} onPress={() => setPicker('sort')} />
          </View>

          {total > 0 && (
            <View style={styles.filters}>
              {tags.length > 0 && (
                <ChipRow>
                  <StudioChip label="All" count={total} dark={!activeTag} onPress={() => setTag('')} />
                  {tags.map((t) => (
                    <StudioChip key={t} label={t} icon="tag" dark={activeTag === t} onPress={() => setTag(activeTag === t ? '' : t)} />
                  ))}
                </ChipRow>
              )}
              <View style={styles.drops}>
                {jobOptions.length > 0 && (
                  <DropChip
                    icon="brief"
                    label={activeJob ? jobOptions.find((j) => j.id === activeJob)?.title ?? 'All jobs' : 'All jobs'}
                    a11y="Job"
                    on={!!activeJob}
                    onPress={() => setPicker('job')}
                  />
                )}
                <DropChip label={sortLabel(sort)} a11y="Sort" onPress={() => setPicker('sort')} />
              </View>
            </View>
          )}
        </>
      )}

      {body}

      {!!notice && <StudioToast message={notice} icon="info" style={styles.toast} />}

      <EmSheet open={picker === 'job'} onClose={() => setPicker(null)} title="Job">
        <View style={styles.pick} accessibilityRole="radiogroup" accessibilityLabel="Job">
          <EmRadioRow label="All jobs" on={!activeJob} onPress={() => { setJobFilter(''); setPicker(null) }} />
          {jobOptions.map((j) => (
            <EmRadioRow key={j.id} label={j.title} on={activeJob === j.id} onPress={() => { setJobFilter(j.id); setPicker(null) }} />
          ))}
        </View>
      </EmSheet>

      <EmSheet open={picker === 'sort'} onClose={() => setPicker(null)} title="Sort">
        <View style={styles.pick} accessibilityRole="radiogroup" accessibilityLabel="Sort">
          {SORTS.map((s) => (
            <EmRadioRow key={s.key} label={s.label} on={sort === s.key} onPress={() => { setSort(s.key); setPicker(null) }} />
          ))}
        </View>
      </EmSheet>

      <EmDialog
        open={!!removing}
        onClose={() => !removeBusy && setRemoving(null)}
        title="Remove from shortlist?"
        body={removing ? `${removing.name} leaves your private shortlist. Their note and tags go with them.` : undefined}
        actions={
          <>
            <Button variant="ghost" size="md" label="Cancel" disabled={removeBusy} onPress={() => setRemoving(null)} />
            <Button variant="dangerFill" size="md" label="Remove" busy={removeBusy} onPress={() => { confirmRemove() }} />
          </>
        }
      />

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

/** The job and sort filters under the tags: a 28 chip with a trailing chevron that opens its picker. */
function DropChip({ label: text_, icon, a11y, on, onPress }: { label: string; icon?: IconName; a11y: string; on?: boolean; onPress: () => void }) {
  const fg = on ? color.accentText : color.textSecondary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${text_}`}
      onPress={onPress}
      hitSlop={{ top: space.sm, bottom: space.sm }}
      style={({ pressed }) => [styles.drop, on && styles.dropOn, pressed && styles.pressed]}
    >
      {!!icon && <Icon name={icon} size={space.md} tint={fg} />}
      <Text style={[text.uiXsMedium, styles.dropText, { color: fg }]} numberOfLines={1}>{text_}</Text>
      <Icon name="chevD" size={space.md} tint={fg} />
    </Pressable>
  )
}

/** S1's card: who, the saved day, the note, the tags and job, then bin · note · CV (when there is a résumé) · the Interest action. */
function ShortlistCard({
  row, slot, jobTitle, opening, onPlay, onProfile, onTag, onJob, onRemove, onEntry, onResume, onInterest, onChat,
}: {
  row: ShortlistRow
  slot: Slot
  jobTitle: string | null
  onPlay: () => void
  onProfile: () => void
  onTag: (tag: string) => void
  onJob: () => void
  onRemove: () => void
  onEntry: () => void
  /** The résumé's link is being fetched. */
  opening: boolean
  onResume: () => void
  onInterest: () => void
  onChat: () => void
}) {
  const meta = metaLine(row)
  const saved = interviewDate(row.savedAt)?.split(' ').slice(0, 2).join(' ') ?? null
  const gone = !row.available
  const more = row.tags.length - 2

  return (
    <StudioCard style={styles.card}>
      <View style={[styles.body, gone && styles.dim]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[row.name, meta].filter(Boolean).join(', ')}
          accessibilityHint="Opens the profile"
          disabled={gone}
          onPress={onProfile}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          <View style={styles.head}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${row.name}’s interview`} disabled={gone} onPress={onPlay} hitSlop={space.xs}>
              <Face name={row.name} photo={row.photoUrl} size={height['control-md']} />
            </Pressable>
            <View style={styles.who}>
              <View style={styles.nameRow}>
                <Text style={[text.uiBaseSemi, styles.shrink]} numberOfLines={1}>{row.name}</Text>
                {row.verifiedInterview.verified && (
                  <View accessible accessibilityLabel="Verified interview">
                    <Icon name="check" size={spaceHalf['3.5']} tint={color.success} weight={2.5} />
                  </View>
                )}
              </View>
              {!!meta && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{meta}</Text>}
            </View>
            {!!saved && <Text style={text.metaXs} accessibilityLabel={`Saved ${saved}`}>{saved}</Text>}
          </View>
          {!!row.notes && <NoteWell>{row.notes}</NoteWell>}
        </Pressable>

        {(row.tags.length > 0 || !!jobTitle) && (
          <View style={styles.chips}>
            {row.tags.slice(0, 2).map((t) => <StudioChip key={t} label={t} on small onPress={() => onTag(t)} />)}
            {more > 0 && <Text style={[text.uiXsMedium, styles.muted]}>{`+${more}`}</Text>}
            {!!jobTitle && <StudioChip label={jobTitle} icon="brief" small onPress={onJob} />}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <IconSquare name="trash" tone="danger" label={`Remove ${row.name}`} onPress={onRemove} />
        {gone ? (
          <Quiet label="No longer on Apostrophe" />
        ) : (
          <>
            <IconSquare name="edit" label="Notes, tags and job" onPress={onEntry} />
            {!!row.resume && (
              <Button
                variant="outline"
                size="sm"
                icon="download"
                label="CV"
                accessibilityLabel={`Download ${row.name}’s résumé`}
                busy={opening}
                hitSlop={space.xs}
                onPress={onResume}
                style={styles.cv}
              />
            )}
            {slot.kind === 'chat' ? (
              <Button variant="primary" size="md" icon="chat" label="Open chat" hitSlop={space.xs} style={styles.cta} onPress={onChat} />
            ) : slot.kind === 'status' ? (
              <Quiet label={slot.label} />
            ) : (
              <Button variant="secondary" size="md" icon="heart" label="Send Interest" hitSlop={space.xs} style={styles.cta} onPress={onInterest} />
            )}
          </>
        )}
      </View>
    </StudioCard>
  )
}

/** Where the Interest stands when there is nothing to press: the quiet grey pill. */
function Quiet({ label: line }: { label: string }) {
  return (
    <View style={styles.quiet} accessible accessibilityRole="text" accessibilityLabel={line}>
      <Text style={[text.uiMdSemi, styles.muted]} numberOfLines={1}>{line}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },
  muted: { color: color.textMuted },
  pad: { flex: 1, paddingHorizontal: space.lg },
  loading: { paddingVertical: space['3xl'] },

  bar: { minHeight: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: spaceHalf['4.5'], paddingRight: space.sm },
  filters: { gap: space.sm },
  drops: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingHorizontal: space.lg },
  drop: { height: space['2xl'], flexShrink: 1, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  dropOn: { backgroundColor: color.accentSoft, borderColor: color.accentEdge },
  dropText: { flexShrink: 1 },

  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, flexGrow: 1 },
  gap: { height: spaceHalf['2.5'] },
  toast: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg },
  pick: { gap: space.sm },

  emptyWrap: { flex: 1, paddingTop: space['4xl'] + space['4xl'] + space.sm },
  emptyCta: { marginTop: spaceHalf['1.5'] },
  filtered: { paddingTop: space['4xl'] },

  card: { padding: space.md, gap: spaceHalf['2.5'] },
  body: { gap: spaceHalf['2.5'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  who: { flex: 1, minWidth: 0, gap: space['2xs'] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cta: { flex: 1, minWidth: 0, height: height['control-xs'], paddingHorizontal: space.md },
  cv: { paddingHorizontal: space.md },
  quiet: { flex: 1, minWidth: 0, height: height['control-xs'], borderRadius: radius.pill, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
})
