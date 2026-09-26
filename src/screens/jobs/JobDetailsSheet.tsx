import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api } from '../../lib/api'
import type { JobCard, JobDetail } from '../../lib/api/jobs'
import { applicationMark, dateLine, deadlineLine, salaryRange } from '../../lib/jobs/format'
import { borderWidth, color, height, radius, space, spaceHalf } from '../../theme'
import { Button, ErrorState, Skeleton, StatusPill, text } from '../../components/ui'
import { JobBullets, JobCompany, JobFacts, JobProse, JobSkills, JobVideo } from './jobParts'

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/**
 * The deck's details view (Android M11): the full post slides up as a sheet over
 * the card the student tapped, so closing it returns them to the same place in
 * the deck. It carries the same three verbs as the deck — not interested, save,
 * apply — and a swipe verb here dismisses the sheet and moves the deck on.
 *
 * The card's own fields draw immediately; the full post (the role, what you'll
 * do, what they want, the film) loads behind them.
 *
 * The design also draws "why it matches you". The API sends no match reason, so
 * that block is not drawn rather than invented.
 */
export function JobDetailsSheet({
  card, onClose, onSkip, onSave, onApply, busy,
}: {
  card: JobCard | null
  onClose: () => void
  onSkip: () => void
  onSave: () => void
  onApply: (id: string) => void
  busy?: boolean
}) {
  const insets = useSafeAreaInsets()
  const { height: screenH } = useWindowDimensions()
  const q = useQuery({
    queryKey: ['job', card?.id],
    queryFn: () => api.get<JobDetail>(`/students/me/jobs/${card!.id}`),
    enabled: !!card,
  })

  const job = q.data
  const pay = card ? salaryRange(card.salary) : null
  const closed = card ? deadlineLine(card.applicationDeadline) === 'Closed' : false
  const applied = job?.application ?? null

  return (
    <Modal visible={!!card} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        {card && (
          <View style={[styles.sheet, { maxHeight: screenH * 0.92 }]}>
            <View style={styles.handle} />
            <View style={styles.top}>
              <View style={styles.logo}><Text style={[text.metaMd, styles.logoText]}>{initialsOf(card.company.name)}</Text></View>
              <View style={styles.grow}>
                <Text style={text.uiBaseSemi} numberOfLines={1}>{card.company.name}</Text>
                {!!card.publishedAt && <Text style={[text.uiXs, styles.subtle]}>Posted {dateLine(card.publishedAt)}</Text>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                <Svg width={height.glyph - 4} height={height.glyph - 4} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={color.text} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.head}>
                <Text style={text.displayHeading}>{card.title}</Text>
                {!!pay && <Text style={text.displaySm}>{pay}</Text>}
              </View>

              {card.video?.url ? <JobVideo url={card.video.url} /> : null}
              <JobFacts job={card} />

              {applied && (
                <View style={styles.applied}>
                  <StatusPill tone={applicationMark(applied.status).tone} label={applicationMark(applied.status).label} />
                  <Text style={[text.uiXs, styles.muted]}>Applied {dateLine(applied.appliedAt)}</Text>
                </View>
              )}

              {q.isPending ? (
                <Skeleton lines={4} block={false} />
              ) : q.isError || !job ? (
                <ErrorState title="Could not load the full post." body="The summary above is current. Try again for the rest." />
              ) : (
                <>
                  <JobProse title="The role" body={job.description} />
                  <JobBullets title="What you’ll do" items={job.responsibilities} />
                  <JobBullets title="What they’re looking for" items={job.requirements} />
                  <JobBullets title="What you get" items={job.benefits} />
                  <JobSkills skills={job.skills} />
                  <JobCompany company={job.company} />
                </>
              )}
            </ScrollView>

            <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Not interested" disabled={busy} onPress={onSkip} style={styles.round}>
                <Svg width={height.glyph} height={height.glyph} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={color.dangerFill} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={card.saved ? 'Saved' : 'Save'} disabled={busy || card.saved} onPress={onSave} style={styles.round}>
                <Svg width={height.glyph} height={height.glyph} viewBox="0 0 24 24">
                  <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke={color.text} strokeWidth={2} fill={card.saved ? color.text : 'none'} strokeLinejoin="round" />
                </Svg>
              </Pressable>
              <View style={styles.grow}>
                <Button
                  variant="primary"
                  size="lg"
                  full
                  disabled={closed || !!applied}
                  label={applied ? 'Already applied' : closed ? 'Applications closed' : 'Apply with video resume'}
                  onPress={() => onApply(card.id)}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: { backgroundColor: color.background, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: height['avatar-lg'], height: space.xs, borderRadius: radius.pill, backgroundColor: color.borderStrong, marginTop: spaceHalf['2.5'] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  logo: { width: height['deck-logo'], height: height['deck-logo'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: color.textSecondary },
  grow: { flex: 1, gap: space['2xs'] },
  subtle: { color: color.textSubtle },
  muted: { color: color.textMuted },
  close: { width: height.control, height: height.control, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  head: { gap: space.xs },
  applied: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foot: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'],
    paddingHorizontal: space.lg, paddingTop: space.md,
    backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },
  round: {
    width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill,
    borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center',
  },
})
