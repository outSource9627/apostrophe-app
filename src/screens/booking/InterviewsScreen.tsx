import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { type StudentInterview } from '../../lib/api/interviews'
import { fmtShortDate, fmtTime, splitByTime } from '../../lib/interviews/slots'
import { statusMark } from '../../lib/interviews/status'
import { color, space } from '../../theme'
import { AppBar, Body, Button, Card, Display, Eyebrow, EmptyState, Meta, StatusPill } from '../../components/ui'

/**
 * ST-25 — one list, upcoming first then past, a status per row. Join shows on a
 * row only while its window is open (roomReady), never before and never after.
 */
export function InterviewsScreen({
  onBack, onOpen, onBook,
}: { onBack: () => void; onOpen: (id: string) => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interviews'], queryFn: () => api.get<{ interviews: StudentInterview[] }>('/interviews/me') })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Home" onBack={onBack} />{child}</View>
  )

  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your interviews.</Body></View>)

  const list = q.data!.interviews
  if (list.length === 0) {
    return frame(
      <View style={{ padding: space.xl, gap: space.xl, flex: 1 }}>
        <Display level="lg">My interviews</Display>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: space['4xl'] }}>
          <EmptyState
            title="Nothing booked yet."
            body="Your interview, and the video resume it becomes, both start here."
            action={<Button variant="primary" size="md" label="Book an interview" onPress={onBook} />}
          />
        </View>
      </View>,
    )
  }

  const { upcoming, past } = splitByTime(list)
  return frame(
    <ScrollView contentContainerStyle={styles.body}>
      <Display level="lg">My interviews</Display>
      {upcoming.length > 0 && (
        <View style={{ gap: space.md }}>
          <Eyebrow>Upcoming</Eyebrow>
          <View style={{ gap: space.sm }}>{upcoming.map((iv) => <Row key={iv.id} iv={iv} onOpen={() => onOpen(iv.id)} />)}</View>
        </View>
      )}
      {past.length > 0 && (
        <View style={{ gap: space.md }}>
          <Eyebrow>Past</Eyebrow>
          <View style={{ gap: space.sm }}>{past.map((iv) => <Row key={iv.id} iv={iv} onOpen={() => onOpen(iv.id)} />)}</View>
        </View>
      )}
    </ScrollView>,
  )
}

function Row({ iv, onOpen }: { iv: StudentInterview; onOpen: () => void }) {
  const mark = statusMark(iv.status)
  return (
    <Card style={styles.cardInner}>
      <Pressable onPress={onOpen} style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
          <Body weight="semibold" size="lg">{relativeWhen(iv.slotStart)}</Body>
          <Body size="sm" tone="muted">{iv.durationMin} minutes · {iv.tier}</Body>
        </View>
        <StatusPill tone={mark.tone} label={mark.label} dot={mark.live} />
      </Pressable>
      {iv.roomReady && (
        <View style={{ alignItems: 'flex-end' }}>
          <Button variant="primary" size="md" label="Join interview" onPress={onOpen} />
        </View>
      )}
    </Card>
  )
}

function relativeWhen(iso: string): string {
  const t = fmtTime(iso)
  const key = (d: Date) => {
    const s = new Date(d.getTime() + (5 * 60 + 30) * 60000)
    return `${s.getUTCFullYear()}-${s.getUTCMonth()}-${s.getUTCDate()}`
  }
  const today = key(new Date())
  const slot = key(new Date(iso))
  const tomorrow = key(new Date(Date.now() + 86400000))
  if (slot === today) return `Today · ${t}`
  if (slot === tomorrow) return `Tomorrow · ${t}`
  return `${fmtShortDate(iso)} · ${t}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  cardInner: { padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
})
