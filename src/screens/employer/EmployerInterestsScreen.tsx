import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, opacity, radius, shadow, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmError } from '../../components/employer/em'
import { ExpiryBar, Initials, SegTabs, StudioCard, StudioState } from '../../components/employer/studio'
import {
  fetchAllEmployerInterests, interestNextEligibleAt, liveInterestOutcome, type EmployerInterestRow, type InterestOutcome,
} from '../../lib/api/employerInterests'
import { getEmployerConnections, getEmployerThreads, type EmployerConnectionRow, type ThreadDto } from '../../lib/api/employerChat'
import { formatIst, formatIstStep } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import { useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'
import { SendInterestSheet } from './SendInterestModal'
import type { RootStackParamList } from '../../../App'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** The last stretch before an Interest lapses, drawn amber. A UI choice (Studio 05 · Interests), not an admin number. */
const URGENT_WINDOW_MS = 48 * HOUR_MS
/** How often the bars and the time left move on while the screen is open, between refreshes. */
const CLOCK_TICK_MS = 60_000

const TABS: { key: InterestOutcome; label: string }[] = [
  { key: 'SENT', label: 'Awaiting' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'NOT_ACCEPTED', label: 'Not accepted' },
]

/** '26 Sep' in IST. */
const dayMon = (iso: string) => formatIstStep(iso).split(', ')[0]
/** '26 Sep 2026' in IST — compares two instants by their IST day. */
const istDay = (input: string | Date) => formatIst(input).split(' · ')[0]

/** '1 day', '2 days'; under a day, the hours. */
function timeLeft(ms: number): string {
  const h = Math.round(ms / HOUR_MS)
  if (h < 24) return h <= 0 ? 'under an hour' : `${h} hour${h === 1 ? '' : 's'}`
  const d = Math.max(1, Math.round(ms / DAY_MS))
  return `${d} day${d === 1 ? '' : 's'}`
}

/** 'Accepted today, 10:42 AM' · 'Accepted 29 Sep' · 'Accepted' when the server sent no time. */
function acceptedLine(closedAt: string | null, now: Date): string {
  if (!closedAt) return 'Accepted'
  if (istDay(closedAt) === istDay(now)) return `Accepted today, ${formatIstStep(closedAt).split(', ')[1] ?? ''}`.trim()
  return `Accepted ${dayMon(closedAt)}`
}

/** '+91 98000 00001'. Anything that is not ten digits is shown as stored (as on Account). */
function mobileLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10)
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : mobile
}

/**
 * EM-16 · Interests (outbound), Employer Android — Studio 05 (I1, I2).
 *
 * Segmented tabs for the three outcomes, each with its total (a decline and an
 * expiry are the same outcome to the sender, so there is no Expired tab).
 *
 * Awaiting (I1): the initials (an Interest row has no photo), the name, the
 * linked job, the message as a one-line quote and a bar from sent to expiry
 * that turns amber in the last 48 hours, when an amber pill says how long is
 * left. Soonest to lapse first.
 *
 * Accepted (I2): a green-edged card with the candidate's email and mobile —
 * only when their connection returns them — each opening the mail app or the
 * dialer; until then “Contact details appear here” and only Open chat. Open
 * chat goes to the thread and carries its unread count.
 *
 * Not accepted: when the next Interest can go, and Send again once it can.
 *
 * Tap a row → the candidate's profile. Pull to refresh; the clock moves on
 * between refreshes. EM-16b is the empty list.
 */
export function EmployerInterestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { state } = useEmployer()
  const verified = Boolean(state?.verified)
  const cfg = useShortlistConfig()
  const jobs = useEmployerJobRefs(verified)

  const [rows, setRows] = useState<EmployerInterestRow[] | null>(null)
  const [connections, setConnections] = useState<EmployerConnectionRow[] | null>(null)
  const [threads, setThreads] = useState<ThreadDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<InterestOutcome>('SENT')
  const [now, setNow] = useState(() => new Date())
  const [resend, setResend] = useState<EmployerInterestRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    // The connections bring the contact details and the threads the unread counts. Either failing
    // leaves the Interests standing — the card then shows the pending line and no count.
    const extras = Promise.all([
      getEmployerConnections({ status: 'ACTIVE', perPage: 100 }).then((r) => r.rows).catch(() => null),
      getEmployerThreads({ archived: false, perPage: 50 }).then((r) => r.rows).catch(() => null),
    ])
    try {
      setRows(await fetchAllEmployerInterests())
      setNow(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your sent Interests.')
    }
    const [c, t] = await extras
    if (c) setConnections(c)
    if (t) setThreads(t)
  }, [])

  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  // Expiries tick on the phone between refreshes.
  useEffect(() => {
    if (!focused) return
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [focused])

  // A SENT Interest past its expiry already reads Not accepted, without waiting for the server's sweep.
  const outcomeOf = useCallback((r: EmployerInterestRow) => liveInterestOutcome(r, now), [now])
  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, SENT: 0, ACCEPTED: 0, NOT_ACCEPTED: 0 }
    for (const r of rows ?? []) c[outcomeOf(r)] += 1
    return c
  }, [rows, outcomeOf])

  const shown = useMemo(() => {
    const list = (rows ?? []).filter((r) => outcomeOf(r) === tab)
    if (tab === 'SENT') return [...list].sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt))
    if (tab === 'ACCEPTED') return [...list].sort((a, b) => +new Date(b.closedAt ?? b.sentAt) - +new Date(a.closedAt ?? a.sentAt))
    return list
  }, [rows, tab, outcomeOf])

  /** The job's title; null while the jobs load or when the linked job is gone. */
  const jobLine = (id: string | null) => (id ? jobs?.find((j) => j.id === id)?.title ?? null : 'No job linked')
  const connectionOf = (r: EmployerInterestRow) =>
    connections?.find((c) => (!!r.threadId && c.threadId === r.threadId) || c.counterparty.id === r.candidateId) ?? null
  const unreadOf = (threadId: string | null, connectionId: string | null) =>
    threads?.find((t) => (!!threadId && t.id === threadId) || (!!connectionId && t.connectionId === connectionId))?.unread ?? 0

  const openProfile = (r: EmployerInterestRow) => navigation.navigate('CandidateProfile', { id: r.candidateId })
  const openChat = (threadId: string | null) =>
    threadId ? navigation.navigate('EmployerThread', { id: threadId }) : navigation.navigate('EmployerChats')

  const renderAwaiting = (item: EmployerInterestRow) => {
    const job = jobLine(item.jobId)
    const sent = new Date(item.sentAt).getTime()
    const ends = new Date(item.expiresAt).getTime()
    const left = Math.max(0, ends - now.getTime())
    const urgent = left <= URGENT_WINDOW_MS
    const leftLabel = timeLeft(left)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${job ? `, ${job}` : ''}. Expires in ${leftLabel}.`}
        accessibilityHint="Opens their profile"
        onPress={() => openProfile(item)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <StudioCard style={styles.card}>
          <View style={styles.head}>
            <Initials name={item.name} />
            <View style={styles.who}>
              <Text style={text.uiBaseSemi} numberOfLines={1}>{item.name}</Text>
              {!!job && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{job}</Text>}
            </View>
            {urgent && <EmBadge label={`${leftLabel.charAt(0).toUpperCase()}${leftLabel.slice(1)}`} tone="amber" icon="clock" />}
          </View>
          {!!item.message && <Text style={[text.uiSm, styles.quote]} numberOfLines={1}>{`“${item.message}”`}</Text>}
          <ExpiryBar
            fraction={ends > sent ? (now.getTime() - sent) / (ends - sent) : 1}
            urgent={urgent}
            left={`Sent ${dayMon(item.sentAt)}`}
            right={`Expires in ${leftLabel}`}
          />
        </StudioCard>
      </Pressable>
    )
  }

  const renderAccepted = (item: EmployerInterestRow) => {
    const job = jobLine(item.jobId)
    const conn = connectionOf(item)
    const email = conn?.contact?.email || null
    const mobile = conn?.contact?.mobile || null
    const hasContact = !!email || !!mobile
    const connected = item.connected || !!conn
    const threadId = item.threadId ?? conn?.threadId ?? null
    const unread = connected ? unreadOf(threadId, conn?.id ?? null) : 0
    return (
      <StudioCard style={[styles.card, styles.cardAccepted]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}${job ? `, ${job}` : ''}. Accepted.`}
          accessibilityHint="Opens their profile"
          onPress={() => openProfile(item)}
          style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        >
          <Initials name={item.name} size={height.slot + space['2xs']} />
          <View style={styles.who}>
            <Text style={text.uiBaseSemi} numberOfLines={1}>{item.name}</Text>
            {!!job && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{job}</Text>}
          </View>
          <EmBadge label="Accepted" tone="green" icon="check" />
        </Pressable>

        <View style={styles.contact}>
          {hasContact ? (
            <>
              {!!email && <ContactRow kind="mail" value={email} onPress={() => { Linking.openURL(`mailto:${email}`).catch(() => {}) }} />}
              {!!mobile && <ContactRow kind="phone" value={mobileLabel(mobile)} rule={!!email} onPress={() => { Linking.openURL(`tel:${mobile}`).catch(() => {}) }} />}
            </>
          ) : (
            <View style={styles.contactPending}>
              <Text style={[text.uiSm, styles.muted]}>Contact details appear here</Text>
            </View>
          )}
        </View>

        <View style={styles.foot}>
          <Text style={[text.uiXs, styles.muted, styles.grow]} numberOfLines={2}>{acceptedLine(item.closedAt, now)}</Text>
          {(hasContact || !connected) && (
            <Button
              variant="outline"
              size="sm"
              label="Profile"
              accessibilityLabel={`${item.name}'s profile`}
              hitSlop={space['2xs']}
              style={styles.smBtn}
              onPress={() => openProfile(item)}
            />
          )}
          {connected && <OpenChat unread={unread} onPress={() => openChat(threadId)} />}
        </View>
      </StudioCard>
    )
  }

  const renderNotAccepted = (item: EmployerInterestRow) => {
    const job = jobLine(item.jobId)
    const next = interestNextEligibleAt(item, cfg.interestCooldownDays)
    const coolingDown = !!next && next.getTime() > now.getTime()
    return (
      <StudioCard style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}${job ? `, ${job}` : ''}. Not accepted.`}
          accessibilityHint="Opens their profile"
          onPress={() => openProfile(item)}
          style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        >
          <Initials name={item.name} />
          <View style={styles.who}>
            <Text style={text.uiBaseSemi} numberOfLines={1}>{item.name}</Text>
            {!!job && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{job}</Text>}
          </View>
          <EmBadge label="Not accepted" tone="gray" />
        </Pressable>
        {!!item.message && <Text style={[text.uiSm, styles.quote]} numberOfLines={1}>{`“${item.message}”`}</Text>}
        <View style={styles.foot}>
          <Text style={[text.uiXs, styles.muted, styles.grow]} numberOfLines={2}>
            {coolingDown && next ? `Send again after ${dayMon(next.toISOString())}` : `Sent ${dayMon(item.sentAt)}`}
          </Text>
          {!coolingDown && (
            <Button
              variant="outline"
              size="sm"
              label="Send again"
              accessibilityLabel={`Send ${item.name} another Interest`}
              hitSlop={space['2xs']}
              style={styles.smBtn}
              onPress={() => setResend(item)}
            />
          )}
        </View>
      </StudioCard>
    )
  }

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
        <StudioState icon="heart" title="No Interests yet." body="Send one from your shortlist or a profile. If accepted, a chat opens.">
          <View style={styles.stateAction}>
            <Button variant="primary" label="Open shortlist" onPress={() => navigation.navigate('EmployerShortlist')} />
          </View>
        </StudioState>
      </View>
    )
  } else {
    body = (
      <>
        <View style={styles.tabs}>
          <SegTabs<InterestOutcome> items={TABS.map((t) => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} />
        </View>
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Gap}
          ListEmptyComponent={
            tab === 'SENT' ? (
              <View style={styles.emptyTab}>
                <StudioState icon="heart" title="No Interests awaiting a reply.">
                  <View style={styles.stateAction}>
                    <Button variant="primary" label="Open feed" onPress={() => navigation.navigate('EmployerFeed')} />
                  </View>
                </StudioState>
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <StudioState icon="heart" title="Nothing here." />
              </View>
            )
          }
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
            return outcome === 'SENT' ? renderAwaiting(item) : outcome === 'ACCEPTED' ? renderAccepted(item) : renderNotAccepted(item)
          }}
        />
      </>
    )
  }

  return (
    <EmployerShell title="Interests" big={false} scroll={false}>
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

/** One line of the unlocked contact well (I2): the glyph, the value, the outbound arrow. */
function ContactRow({ kind, value, rule, onPress }: { kind: 'mail' | 'phone'; value: string; rule?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={kind === 'mail' ? `Email ${value}` : `Call ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.contactRow, rule && styles.contactRule, pressed && styles.pressed]}
    >
      <Icon name={kind} size={space.lg - 1} tint={color.textMuted} />
      <Text style={[text.uiMd, styles.grow]} numberOfLines={1}>{value}</Text>
      <Icon name="arrowUR" size={spaceHalf['3.5']} tint={color.textSubtle} />
    </Pressable>
  )
}

/**
 * The card's primary action, drawn on Button's own primary values at the card's
 * height — the shared Button has no slot for the unread count the design puts
 * inside it.
 */
function OpenChat({ unread, onPress }: { unread: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Open chat, ${unread} unread` : 'Open chat'}
      hitSlop={space['2xs']}
      onPress={onPress}
      style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
    >
      <Icon name="chat" size={space.lg + space['2xs']} tint={color.textInverse} />
      <Text style={[text.uiMdSemi, styles.onAccent]}>Open chat</Text>
      {unread > 0 && (
        <View style={styles.chatCount}>
          <Text style={[text.ui2xs, styles.chatCountText]}>{unread}</Text>
        </View>
      )}
    </Pressable>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },

  tabs: { paddingHorizontal: space.lg },
  list: { paddingHorizontal: space.lg, paddingTop: spaceHalf['3.5'], paddingBottom: space.lg },
  gap: { height: spaceHalf['2.5'] },
  emptyTab: { paddingTop: space['3xl'] },
  stateAction: { marginTop: spaceHalf['1.5'] },

  card: { paddingVertical: spaceHalf['3.5'] - 1, paddingHorizontal: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  cardAccepted: { borderColor: color.successEdge, paddingVertical: spaceHalf['3.5'], gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  who: { flex: 1, minWidth: 0, gap: space['2xs'] },
  quote: { color: color.textSecondary, fontStyle: 'italic' },

  contact: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], minHeight: height.tap, paddingHorizontal: space.md },
  contactRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.surface },
  contactPending: { minHeight: height.tap, paddingHorizontal: space.md, justifyContent: 'center' },

  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** The card's small action (40; the 44 floor via hitSlop). */
  smBtn: { paddingHorizontal: space.md + 1 },
  onAccent: { color: color.textInverse },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: height['control-xs'], paddingHorizontal: space.md + 1, borderRadius: radius.pill, backgroundColor: color.accent, boxShadow: shadow.accent },
  chatCount: { minWidth: space.lg + 1, height: space.lg + 1, paddingHorizontal: space.xs + 1, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  chatCountText: { fontFamily: fontFamilyNative.bodySemiBold, color: color.accent },
})
