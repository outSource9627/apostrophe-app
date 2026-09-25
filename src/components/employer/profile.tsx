import React from 'react'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import type { CandidateCard, CandidateDetail } from '../../lib/api/employerFeed'
import {
  clipLength, experienceLine, fileSize, interviewDate, joinsLine, joinsSentence, monthYear, salaryLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { label } from '../../lib/profile/labels'
import { EmBadge, EmIconButton, EmMono } from './em'

/**
 * The candidate profile's parts (Employer Android EM-09 and the feed's profile
 * sheet, `H.profileSecs` with `phone`): the head beside the film, the three
 * facts, and one white card per section. A section with nothing in it is not
 * drawn — except experience and self-uploaded videos, which say so out loud,
 * so a fresher's profile reads as finished. There is no score, rating or
 * interviewer note anywhere here; the API sends none.
 */

type Candidate = CandidateCard | CandidateDetail

/** 'VERIFIED INTERVIEW · 12 SEP 2026', when the interview is verified. */
export function VerifiedInterviewBadge({ candidate }: { candidate: Candidate }) {
  const date = candidate.verifiedInterview?.verified ? interviewDate(candidate.verifiedInterview.at) : null
  if (!date) return null
  return <EmBadge label={`Verified interview · ${date}`} tone="green" icon="check" small />
}

/** The head: a 96 × 170 film thumb with a play disc, and the name and facts beside it. */
export function ProfileHead({ candidate, onPlay }: { candidate: Candidate; onPlay?: () => void }) {
  const poster = candidate.posterUrl ?? candidate.photoUrl
  const sub = [tierLine(candidate.tier, candidate.qualification)].filter(Boolean).join(' · ')
  const where = [candidate.city, experienceLine(candidate.experienceYears)].filter(Boolean).join(' · ')
  return (
    <View style={styles.head}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Watch ${candidate.name}’s full interview`}
        disabled={!onPlay}
        onPress={onPlay}
        style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
      >
        {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        {!!onPlay && (
          <View style={styles.thumbDisc}><Icon name="tri" size={space.md} tint={color.ink} fill={color.ink} weight={1.5} /></View>
        )}
      </Pressable>
      <View style={styles.headText}>
        <VerifiedInterviewBadge candidate={candidate} />
        <Text style={text.displaySm}>{candidate.name}</Text>
        {!!sub && <Text style={[text.uiXs, styles.muted]}>{sub}</Text>}
        {!!where && <Text style={[text.uiXs, styles.secondary]}>{where}</Text>}
        {candidate.languages?.length > 0 && <Text style={[text.uiXs, styles.secondary]}>{candidate.languages.join(', ')}</Text>}
      </View>
    </View>
  )
}

/** EXPECTED · JOINS · SHORTLISTED — the three facts, on a muted well. Unknown ones are left out. */
export function ProfileFacts({ candidate, well = true }: { candidate: Candidate; well?: boolean }) {
  const facts: [string, string][] = []
  const salary = salaryLine(candidate.expectedSalary)
  if (salary) facts.push(['EXPECTED', salary])
  const joins = joinsLine(candidate.availability)
  if (joins) facts.push(['JOINS', joins])
  if (candidate.shortlistCount > 0) facts.push(['SHORTLISTED', `${candidate.shortlistCount} ${candidate.shortlistCount === 1 ? 'employer' : 'employers'}`])
  if (facts.length === 0) return null
  return (
    <View style={[styles.facts, well ? styles.factsWell : styles.factsCard]}>
      {facts.map(([k, v]) => (
        <View key={k} style={styles.fact}>
          <Text style={[text.metaXs, styles.mono, styles.muted]}>{k}</Text>
          <Text style={text.uiMdSemi} numberOfLines={1}>{v}</Text>
        </View>
      ))}
    </View>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.box}>
      <EmMono>{title}</EmMono>
      {children}
    </View>
  )
}

function Line({ title, meta, body }: { title: string; meta?: string | null; body?: string | null }) {
  return (
    <View style={styles.line}>
      <Text style={text.uiMdSemi}>{title}</Text>
      {!!meta && <Text style={[text.uiXs, styles.muted]}>{meta}</Text>}
      {!!body && <Text style={[text.uiSm, styles.secondary]}>{body}</Text>}
    </View>
  )
}

export function ProfileSections({
  candidate, onPlayClip, onOpenDocument, openingDoc,
}: {
  candidate: CandidateDetail
  onPlayClip?: (videoId: string) => void
  onOpenDocument?: (docId: string) => void
  /** The document whose link is being fetched. */
  openingDoc?: string | null
}) {
  const edu = candidate.education
  const eduTitle = edu ? [edu.qualification ? label(edu.qualification) : null, edu.fieldOfStudy].filter(Boolean).join(', ') : ''
  const eduMeta = edu
    ? [edu.institution, edu.year ?? edu.yearOfCompletion, edu.score != null ? `${edu.scoreType ? label(edu.scoreType) : 'Score'} ${edu.score}` : null]
        .filter(Boolean)
        .join(' · ')
    : ''

  const prefs = candidate.preferences
  const roles = [...(prefs?.desiredRoles ?? []), ...(prefs?.targetRoles ?? [])]
  const locations = [...(prefs?.preferredLocations ?? []), ...(prefs?.remote ? ['open to remote'] : [])]
  const prefRows: [string, string][] = []
  if (roles.length) prefRows.push(['ROLES', roles.join(', ')])
  if (locations.length) prefRows.push(['LOCATIONS', locations.join(', ')])
  if (prefs?.employmentTypes?.length) prefRows.push(['EMPLOYMENT TYPE', prefs.employmentTypes.map(label).join(', ')])
  const joins = joinsSentence(prefs?.availabilityToJoin ?? candidate.availability)
  if (joins) prefRows.push(['JOINS', joins])
  const salary = salaryLine({
    minPaise: prefs?.expectedSalaryMinPaise ?? candidate.expectedSalary?.minPaise ?? null,
    maxPaise: prefs?.expectedSalaryMaxPaise ?? candidate.expectedSalary?.maxPaise ?? null,
  })
  if (salary) prefRows.push(['EXPECTED SALARY', salary])

  const experience = candidate.experience ?? []
  const videos = candidate.videos ?? []
  const documents = candidate.documents ?? []

  return (
    <>
      {edu && (eduTitle || eduMeta) ? (
        <Box title="EDUCATION"><Line title={eduTitle || 'Education'} meta={eduMeta} /></Box>
      ) : null}

      <Box title="EXPERIENCE">
        {experience.length > 0 ? (
          experience.map((x, i) => (
            <Line
              key={i}
              title={[x.title, x.company].filter(Boolean).join(' · ')}
              meta={[monthYear(x.from), x.to ? monthYear(x.to) : 'Present'].filter(Boolean).join(' – ')}
              body={x.description}
            />
          ))
        ) : (
          <Text style={[text.uiMd, styles.muted]}>No work experience listed.</Text>
        )}
      </Box>

      {candidate.skills?.length > 0 && (
        <Box title="SKILLS">
          <View style={styles.tags}>
            {candidate.skills.map((s) => (
              <View key={s} style={styles.tag}><Text style={[text.metaMd, styles.mono, styles.secondary]}>{s.toUpperCase()}</Text></View>
            ))}
          </View>
        </Box>
      )}

      {prefRows.length > 0 && (
        <Box title="PREFERENCES">
          <View style={styles.prefs}>
            {prefRows.map(([k, v]) => (
              <View key={k} style={styles.pref}>
                <Text style={[text.metaSm, styles.mono, styles.subtle]}>{k}</Text>
                <Text style={text.uiMd}>{v}</Text>
              </View>
            ))}
          </View>
        </Box>
      )}

      <Box title="SELF-UPLOADED VIDEOS">
        {videos.length > 0 ? (
          videos.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Play ${v.title || `clip ${v.slot}`}, self-uploaded, not verified`}
              disabled={!onPlayClip}
              onPress={() => onPlayClip?.(v.id)}
              style={({ pressed }) => [styles.clip, pressed && styles.pressed]}
            >
              <View style={styles.clipThumb}><Icon name="tri" size={space.md + 2} tint={color.textInverse} fill={color.textInverse} weight={1.5} /></View>
              <View style={styles.grow}>
                <Text style={text.uiMdMedium} numberOfLines={1}>{v.title || `Clip ${v.slot}`}</Text>
                <EmBadge label="Self-uploaded · not verified" tone="amber" small />
              </View>
              {!!clipLength(v.durationSec) && <Text style={[text.metaMd, styles.mono, styles.muted]}>{clipLength(v.durationSec)}</Text>}
            </Pressable>
          ))
        ) : (
          <Text style={[text.uiMd, styles.muted]}>None uploaded.</Text>
        )}
      </Box>

      {documents.length > 0 && (
        <Box title="DOCUMENTS">
          {documents.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={`Download ${d.name || label(d.kind)}`}
              disabled={!onOpenDocument || openingDoc === d.id}
              onPress={() => onOpenDocument?.(d.id)}
              style={({ pressed }) => [styles.doc, pressed && styles.pressed]}
            >
              <View style={styles.docTile}><Text style={[text.metaXs, styles.docExt]}>{d.contentType?.includes('pdf') ? 'PDF' : 'DOC'}</Text></View>
              <View style={styles.grow}>
                <Text style={text.uiMdMedium} numberOfLines={1}>{d.name || label(d.kind)}</Text>
                <Text style={[text.metaSm, styles.mono, styles.subtle]}>{[label(d.kind), fileSize(d.sizeBytes)].filter(Boolean).join(' · ').toUpperCase()}</Text>
              </View>
              {openingDoc === d.id ? <ActivityIndicator color={color.textSecondary} /> : <Icon name="download" size={space.lg + 2} tint={color.textSecondary} />}
            </Pressable>
          ))}
        </Box>
      )}
    </>
  )
}

/** A self-uploaded clip, full screen with the platform's controls. Marked unverified, as everywhere. */
export function ClipPlayer({ url, title, onClose }: { url: string | null; title?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={!!url} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.player, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.sm }]}>
        <View style={styles.playerTop}>
          <View style={styles.grow}>
            {!!title && <Text style={[text.uiBaseSemi, styles.onInk]} numberOfLines={1}>{title}</Text>}
            <EmBadge label="Self-uploaded · not verified" tone="amber" small />
          </View>
          <EmIconButton name="x" label="Close" tint={color.textOnInk} onPress={onClose} />
        </View>
        {!!url && <Video source={{ uri: url }} style={styles.grow} resizeMode="contain" controls paused={false} />}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space.xs },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  onInk: { color: color.textOnInk },
  mono: { letterSpacing: trackingNative.eyebrow },

  head: { flexDirection: 'row', gap: space.md },
  thumb: { width: height['profile-thumb-w'], height: height['profile-thumb-h'], borderRadius: radius.tile, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbDisc: { width: height.chip + 4, height: height.chip + 4, borderRadius: radius.pill, backgroundColor: color.onInkBadge, alignItems: 'center', justifyContent: 'center', paddingLeft: space['2xs'] },
  headText: { flex: 1, minWidth: 0, gap: spaceHalf['1.5'] },

  facts: { flexDirection: 'row', gap: spaceHalf['1.5'], padding: space.md, borderRadius: radius.panel },
  factsWell: { backgroundColor: color.surfaceMuted },
  factsCard: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  fact: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },

  box: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  line: { borderLeftWidth: borderWidth.accent, borderLeftColor: color.border, paddingLeft: space.md, gap: space['2xs'] + 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  tag: { height: height['chip-sm'], paddingHorizontal: spaceHalf['2.5'] + 1, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, justifyContent: 'center' },
  prefs: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spaceHalf['3.5'], columnGap: space.xl },
  pref: { width: '45%', flexGrow: 1, gap: space['2xs'] + 1 },
  clip: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: spaceHalf['2.5'], borderRadius: radius.tile, borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.warningEdgeStrong, backgroundColor: color.warningWash },
  clipThumb: { width: height.tap, height: height.fab + space.xs, borderRadius: radius.ctl, backgroundColor: color.textSecondary, alignItems: 'center', justifyContent: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, backgroundColor: color.surfaceMuted, minHeight: height.tap },
  docTile: { width: spaceHalf['6'] + space.xs + 2, height: height['chip-lg'], borderRadius: radius.sm, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.xs },
  docExt: { color: color.danger },

  player: { flex: 1, backgroundColor: color.inkDeep, gap: space.md },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
})
