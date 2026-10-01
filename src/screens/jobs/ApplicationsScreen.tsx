import React from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { getApplications, type ApplicationRow } from '../../lib/api/jobs'
import { applicationMark, dateLine, locationLine } from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { JobsTabs, Skel, StateBlock } from '../../components/tab/kit'

/**
 * ST-40 — the employer-driven pipeline, as the refined mockup draws it
 * (docs/saved-applications-video-final.html). It scans in a glance and shows NO
 * control implying the student can move a stage — they only read it. The status
 * pill names the stage and a four-dot track shows how far it has come.
 * Rejection is muted with the employer's note verbatim; a CONNECTED row opens
 * the chat.
 */
const PALETTE = [color.accent, color.successFill, '#E0366B', '#2F6BFF', '#C77D00', color.accentDeep]
const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** The employer-driven ladder a live application climbs; a rejection is an ending, not a rung. */
const PIPELINE: ApplicationRow['status'][] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'CONNECTED']

export function ApplicationsScreen({ onFeed, onChat, onSaved }: {
  onBack?: () => void; onFeed: () => void; onChat: (connectionId: string) => void; onSaved?: () => void
}) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['applications'], queryFn: () => getApplications() })

  const tabs = (count?: number) => <JobsTabs active="Applied" counts={{ Applied: count }} onFeed={onFeed} onSaved={onSaved} />
  const frame = (c: React.ReactNode, count?: number) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {tabs(count)}
      {c}
    </View>
  )
  if (q.isPending) {
    return frame(
      <View style={styles.body}>
        {[0, 1, 2].map((i) => <Skel key={i} w="100%" h={150} />)}
      </View>,
    )
  }
  if (q.isError) {
    return frame(<StateBlock icon="alert" title="Could not load your applications." body="Nothing was changed. Pull down to try again." action="Try again" onAction={() => { void q.refetch() }} />)
  }

  const rows = q.data!.rows
  if (rows.length === 0) {
    return frame(
      <StateBlock icon="file" title="No applications yet." body="Applications you send land here, and you will see every move an employer makes." action="Find a job" onAction={onFeed} />,
      0,
    )
  }

  const renderRow = ({ item: r, index }: { item: ApplicationRow; index: number }) => {
    const mark = applicationMark(r.status)
    const rejected = r.status === 'REJECTED'
    const reached = rejected ? 0 : PIPELINE.indexOf(r.status) + 1
    return (
      <View style={[styles.card, rejected && styles.cardOut]}>
        <View style={styles.top}>
          <View style={[styles.logo, { backgroundColor: rejected ? color.textSubtle : PALETTE[(index + 4) % PALETTE.length] }]}>
            <Text style={styles.logoText}>{initialsOf(r.company.name)}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.where} numberOfLines={2}>{`${r.company.name} · ${locationLine(r.location, r.remote)}`}</Text>
          </View>
          <StatusPill tone={mark.tone} label={mark.label} />
        </View>

        {rejected ? (
          !!r.rejectionReason && (
            <View style={styles.quote}>
              <Text style={styles.quoteLabel}>THEIR NOTE</Text>
              <Text style={styles.quoteText}>{r.rejectionReason}</Text>
            </View>
          )
        ) : (
          <Track reached={reached} label={`${mark.label}, step ${reached} of ${PIPELINE.length}`} />
        )}

        <Text style={styles.date}>{`Applied ${dateLine(r.appliedAt)}`}</Text>

        {r.status === 'CONNECTED' && !!r.connectionId && (
          // Ink, not violet: every CONNECTED row can show this button at once.
          <Pressable onPress={() => onChat(r.connectionId!)} accessibilityRole="button" style={styles.chatBtn}>
            <Icon name="chat" size={18} tint={color.textInverse} />
            <Text style={styles.chatText}>Open chat</Text>
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={renderRow}
        ListHeaderComponent={tabs(rows.length)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      />
    </View>
  )
}

/** Four dots joined by a line; the furthest one reached is ringed. Read-only. */
function Track({ reached, label }: { reached: number; label: string }) {
  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={styles.track}>
      {PIPELINE.map((step, i) => (
        <React.Fragment key={step}>
          <View style={i === reached - 1 ? styles.ring : styles.noRing}>
            <View style={[styles.dot, i < reached && styles.dotOn]} />
          </View>
          {i < PIPELINE.length - 1 && <View style={[styles.line, i < reached - 1 && styles.lineOn]} />}
        </React.Fragment>
      ))}
    </View>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  list: { paddingBottom: 130 },
  gap: { height: 10 },
  grow: { flex: 1, minWidth: 0 },
  card: {
    marginHorizontal: 20, padding: 16, gap: 14, borderRadius: 20,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  cardOut: { backgroundColor: color.surfaceMuted, borderColor: 'transparent' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: FF.bodyBold, fontSize: 17, color: color.textInverse },
  title: { fontFamily: FF.bodyBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.45, color: color.text },
  where: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted, marginTop: 3 },
  date: { fontFamily: FF.body, fontSize: 13, color: color.textMuted },

  track: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: color.surfaceSunken },
  dotOn: { backgroundColor: color.accent },
  ring: { padding: 4, borderRadius: 14, backgroundColor: color.accentSoft, margin: -4 },
  noRing: {},
  line: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.surfaceSunken },
  lineOn: { backgroundColor: color.accent },

  quote: { borderLeftWidth: 3, borderLeftColor: color.borderStrong, paddingLeft: 12, paddingVertical: 2, gap: 4 },
  quoteLabel: { fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, color: color.textSubtle },
  quoteText: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.textSecondary },

  chatBtn: { height: 46, borderRadius: 14, backgroundColor: color.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chatText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.textInverse },
})
