import React from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'
import { Icon } from '../ui/Icon'
import type { CandidateCard, CandidateDetail, CandidateDocumentView } from '../../lib/api/employerFeed'
import {
  clipLength, experienceLine, fileSize, interviewDate, joinsLine, joinsSentence, monthYear, salaryLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { label } from '../../lib/profile/labels'
import { EmBadge, EmIconButton, EmMono } from './em'
import { FactTile, FilmStill, SectionBlock, SkillTags } from './studio'

/**
 * The candidate profile's parts (Employer Android EM-09 and the feed's profile
 * sheet, `H.profileSecs` with `phone`): the head beside the film, the three
 * facts, and one white card per section. A section with nothing in it is not
 * drawn — except experience and self-uploaded videos, which say so out loud,
 * so a fresher's profile reads as finished. There is no score, rating or
 * interviewer note anywhere here; the API sends none.
 */

type Candidate = CandidateCard | CandidateDetail

/** 'Verified interview · 12 Sep 2026', when the interview is verified. */
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

/** Expected · Joins · Shortlisted — the three facts, on a muted well. Unknown ones are left out. */
export function ProfileFacts({ candidate, well = true }: { candidate: Candidate; well?: boolean }) {
  const facts: [string, string][] = []
  const salary = salaryLine(candidate.expectedSalary)
  if (salary) facts.push(['Expected', salary])
  const joins = joinsLine(candidate.availability)
  if (joins) facts.push(['Joins', joins])
  if (candidate.shortlistCount > 0) facts.push(['Shortlisted', `${candidate.shortlistCount} ${candidate.shortlistCount === 1 ? 'employer' : 'employers'}`])
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
  if (roles.length) prefRows.push(['Roles', roles.join(', ')])
  if (locations.length) prefRows.push(['Locations', locations.join(', ')])
  if (prefs?.employmentTypes?.length) prefRows.push(['Employment type', prefs.employmentTypes.map(label).join(', ')])
  const joins = joinsSentence(prefs?.availabilityToJoin ?? candidate.availability)
  if (joins) prefRows.push(['Joins', joins])
  const salary = salaryLine({
    minPaise: prefs?.expectedSalaryMinPaise ?? candidate.expectedSalary?.minPaise ?? null,
    maxPaise: prefs?.expectedSalaryMaxPaise ?? candidate.expectedSalary?.maxPaise ?? null,
  })
  if (salary) prefRows.push(['Expected salary', salary])

  const experience = candidate.experience ?? []
  const videos = candidate.videos ?? []
  const documents = candidate.documents ?? []

  return (
    <>
      {edu && (eduTitle || eduMeta) ? (
        <Box title="Education"><Line title={eduTitle || 'Education'} meta={eduMeta} /></Box>
      ) : null}

      <Box title="Experience">
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
        <Box title="Skills">
          <View style={styles.tags}>
            {candidate.skills.map((s) => (
              <View key={s} style={styles.tag}><Text style={[text.metaMd, styles.mono, styles.secondary]}>{s}</Text></View>
            ))}
          </View>
        </Box>
      )}

      {prefRows.length > 0 && (
        <Box title="Preferences">
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

      <Box title="Self-uploaded videos">
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
        <Box title="Documents">
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
                <Text style={[text.metaSm, styles.mono, styles.subtle]}>{[label(d.kind), fileSize(d.sizeBytes)].filter(Boolean).join(' · ')}</Text>
              </View>
              {openingDoc === d.id ? <ActivityIndicator color={color.textSecondary} /> : <Icon name="download" size={space.lg + 2} tint={color.textSecondary} />}
            </Pressable>
          ))}
        </Box>
      )}
    </>
  )
}

// ── Studio · the profile page (docs/employer-app-studio.html · 03, P1–P2) ────
/*
 * The Candidate profile page in the Studio direction: the three fact tiles, the
 * video row, and the résumé sections (experience, education, skills, what they
 * are looking for, documents and links), each a hairline-topped SectionBlock.
 * The parts above are the feed sheet's and stay as they were.
 *
 * GET /employers/candidates/:id sends no salary, notice period, poster or
 * stream of its own; those are read from the profile's preferences and, when
 * the person is in the feed's deck, from their card. A section with nothing in
 * it is not drawn.
 */

type Paise = { minPaise: number | null; maxPaise: number | null }

/** The expectation: the detail's own, else the preferences', else the feed card's. */
export function expectedSalaryOf(c: CandidateDetail, card?: CandidateCard | null): Paise | null {
  if (c.expectedSalary) return c.expectedSalary
  const p = c.preferences
  if (p && (p.expectedSalaryMinPaise != null || p.expectedSalaryMaxPaise != null)) {
    return { minPaise: p.expectedSalaryMinPaise ?? null, maxPaise: p.expectedSalaryMaxPaise ?? null }
  }
  return card?.expectedSalary ?? null
}

/** The notice period: the detail's, else the preferences', else the feed card's. */
export const availabilityOf = (c: CandidateDetail, card?: CandidateCard | null) =>
  c.availability ?? c.preferences?.availabilityToJoin ?? card?.availability ?? null

/** '1.5 yrs', '1 yr', 'Fresher' — the tile's and the compact bar's short form. */
export function experienceShort(years: number | null | undefined): string | null {
  if (years == null) return null
  if (years <= 0) return 'Fresher'
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}

/** 'Tier 2' from the server's 'T2'; any other value as it came. */
export const tierName = (tier: string | null | undefined) => (tier ? (/^T\d$/.test(tier) ? `Tier ${tier.slice(1)}` : tier) : null)

/** 'Graduation · Tier 2 · Pune' — the head's line, in the mockup's order. */
export function personLine(c: { qualification?: string | null; tier?: string | null }, tail?: string | null): string {
  return [c.qualification ? label(c.qualification) : null, tierName(c.tier), tail].filter(Boolean).join(' · ')
}

/** Expected · Joins · Experience (P1). A fact the API did not send is left out. */
export function ProfileFactTiles({
  salary, availability, experienceYears,
}: { salary: Paise | null; availability: string | null; experienceYears: number | null | undefined }) {
  const facts: [string, string][] = []
  const pay = salaryLine(salary)
  if (pay) facts.push(['Expected', pay.replace(/ LPA$/, ' L')])
  const joins = joinsLine(availability)
  if (joins) facts.push(['Joins', joins])
  const exp = experienceShort(experienceYears)
  if (exp) facts.push(['Experience', exp])
  if (!facts.length) return null
  return (
    <View style={styles.tiles}>
      {facts.map(([k, v]) => <FactTile key={k} label={k} value={v} style={styles.tile} />)}
    </View>
  )
}

/**
 * Videos · N (P1): the verified interview first, then each self-uploaded clip,
 * marked as such. Each still is the interview's poster or the photo — the API
 * sends no frame of a self-uploaded clip.
 */
export function ProfileVideoRow({
  name, poster, interview, videos, onPlayClip,
}: {
  name: string
  poster?: string | null
  /** The verified interview's tile; null when there is none. */
  interview: { onPress: () => void; disabled?: boolean; durationSec?: number | null } | null
  videos: CandidateDetail['videos']
  onPlayClip?: (videoId: string) => void
}) {
  const clips = videos ?? []
  const count = clips.length + (interview ? 1 : 0)
  if (!count) return null
  const interviewLen = clipLength(interview?.durationSec)
  return (
    <SectionBlock label={`Videos · ${count}`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.videoScroll} contentContainerStyle={styles.videoRow}>
        {!!interview && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play ${name}’s verified interview`}
            accessibilityState={{ disabled: !!interview.disabled }}
            disabled={interview.disabled}
            onPress={interview.onPress}
            style={({ pressed }) => [styles.video, pressed && styles.pressed, interview.disabled && styles.off]}
          >
            <FilmStill name="" poster={poster} width={VIDEO_W} height={VIDEO_H} corner={radius.md} play="sm" />
            <Text style={text.uiXsSemi} numberOfLines={2}>{interviewLen ? `Interview · ${interviewLen}` : 'Interview'}</Text>
            <EmBadge label="Verified" tone="green" small />
          </Pressable>
        )}
        {clips.map((v) => {
          const title = v.title || `Clip ${v.slot}`
          const len = clipLength(v.durationSec)
          return (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Play ${title}, self-uploaded, not verified`}
              disabled={!onPlayClip}
              onPress={() => onPlayClip?.(v.id)}
              style={({ pressed }) => [styles.video, pressed && styles.pressed]}
            >
              <FilmStill name="" poster={poster} width={VIDEO_W} height={VIDEO_H} corner={radius.md} play="sm" />
              <Text style={text.uiXsSemi} numberOfLines={2}>{len ? `${title} · ${len}` : title}</Text>
              <EmBadge label="Self-uploaded" tone="amber" small />
            </Pressable>
          )
        })}
      </ScrollView>
    </SectionBlock>
  )
}

/** The scheme a portfolio link may have been saved without. */
export const linkUrl = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`)
const linkHost = (url: string) => url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]

/** The portfolio links worth drawing: the server sends plain URL strings (ST-35), so a blank one is the only thing to drop. */
export const portfolioLinksOf = (links: readonly unknown[] | null | undefined): string[] =>
  (links ?? []).filter((l): l is string => typeof l === 'string' && l.trim().length > 0)

/**
 * One document on a profile (P2's Documents · links): the PDF / DOC tile, its
 * kind over its name and size, and the download mark — a spinner while its
 * 15-minute link is being fetched. The applicant screen draws the same row.
 */
export function DocumentRow({
  doc, opening, onOpen,
}: { doc: CandidateDocumentView; opening?: boolean; onOpen?: (docId: string) => void }) {
  const sub = [doc.name, fileSize(doc.sizeBytes)].filter(Boolean).join(' · ')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Download ${doc.name || label(doc.kind)}`}
      accessibilityState={{ busy: !!opening }}
      disabled={!onOpen || opening}
      onPress={() => onOpen?.(doc.id)}
      style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
    >
      <View style={styles.fileTile}><Text style={[text.metaXs, styles.fileExt]}>{doc.contentType?.includes('pdf') ? 'PDF' : 'DOC'}</Text></View>
      <View style={styles.grow}>
        <Text style={text.uiSmMedium} numberOfLines={1}>{label(doc.kind)}</Text>
        {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
      </View>
      {opening
        ? <ActivityIndicator color={color.textMuted} />
        : <Icon name="download" size={space.lg + borderWidth.thin} tint={color.textMuted} />}
    </Pressable>
  )
}

/** One portfolio link: its host over the URL as typed. */
export function LinkRow({ url, onOpen }: { url: string; onOpen?: (url: string) => void }) {
  const host = linkHost(url) || url
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${host}`}
      disabled={!onOpen}
      onPress={() => onOpen?.(linkUrl(url))}
      style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
    >
      <View style={[styles.fileTile, styles.linkTile]}><Icon name="link" size={space.lg} tint={color.textSecondary} /></View>
      <View style={styles.grow}>
        <Text style={text.uiSmMedium} numberOfLines={1}>{host}</Text>
        <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{url}</Text>
      </View>
    </Pressable>
  )
}

/**
 * The résumé half of the page (P2): Experience as a timeline, Education,
 * Skills, Looking for, and Documents · links. Experience says so when there is
 * none, so a fresher's profile reads as finished; the others are left out.
 */
export function ProfileResume({
  candidate, onOpenDocument, openingDoc, onOpenLink,
}: {
  candidate: CandidateDetail
  onOpenDocument?: (docId: string) => void
  /** The document whose link is being fetched. */
  openingDoc?: string | null
  onOpenLink?: (url: string) => void
}) {
  const experience = candidate.experience ?? []
  const years = experienceShort(candidate.experienceYears)

  const edu = candidate.education
  const eduTitle = edu ? [edu.qualification ? label(edu.qualification) : null, edu.fieldOfStudy].filter(Boolean).join(' · ') : ''
  const score = edu?.score != null
    ? edu.scoreType === 'PERCENTAGE' ? `${edu.score}%` : edu.scoreType ? `${edu.score} ${label(edu.scoreType)}` : `Score ${edu.score}`
    : null
  const eduMeta = edu ? [edu.institution, edu.year ?? edu.yearOfCompletion, score].filter(Boolean).join(' · ') : ''

  const prefs = candidate.preferences
  const roles = [...new Set([...(prefs?.desiredRoles ?? []), ...(prefs?.targetRoles ?? [])])]
  const types = [prefs?.employmentTypes?.length ? prefs.employmentTypes.map(label).join(', ') : null, prefs?.remote ? 'open to remote' : null]
    .filter(Boolean)
    .join(' · ')
  const looking: [string, string][] = []
  if (roles.length) looking.push(['Roles', roles.join(', ')])
  if (prefs?.preferredLocations?.length) looking.push(['Locations', prefs.preferredLocations.join(', ')])
  if (types) looking.push(['Type', types.charAt(0).toUpperCase() + types.slice(1)])
  if (candidate.languages?.length) looking.push(['Languages', candidate.languages.join(', ')])

  const documents = candidate.documents ?? []
  const links = portfolioLinksOf(candidate.portfolioLinks)
  const filesLabel = documents.length && links.length ? 'Documents · links' : documents.length ? 'Documents' : 'Links'

  return (
    <>
      <SectionBlock label={years ? `Experience · ${years}` : 'Experience'}>
        {experience.length > 0 ? (
          experience.map((x, i) => {
            const when = [monthYear(x.from), x.to ? monthYear(x.to) : 'Present'].filter(Boolean).join(' – ')
            const meta = [x.company, when].filter(Boolean).join(' · ')
            return (
              <View key={`${x.title}-${i}`} style={styles.tlRow}>
                <View style={styles.tlDot} />
                <View style={styles.tlBody}>
                  {!!x.title && <Text style={text.uiBaseSemi}>{x.title}</Text>}
                  {!!meta && <Text style={[text.uiSm, styles.muted]}>{meta}</Text>}
                  {!!x.description && <Text style={[text.uiSm, styles.secondary, styles.tlDesc]}>{x.description}</Text>}
                </View>
              </View>
            )
          })
        ) : (
          <Text style={[text.uiMd, styles.muted]}>No work experience listed.</Text>
        )}
      </SectionBlock>

      {edu && (eduTitle || eduMeta) ? (
        <SectionBlock label="Education">
          <View style={styles.eduRow}>
            <View style={styles.eduMark}><Icon name="grad" size={space.lg + borderWidth.thin} tint={color.accentText} /></View>
            <View style={styles.grow}>
              {!!eduTitle && <Text style={text.uiMdSemi}>{eduTitle}</Text>}
              {!!eduMeta && <Text style={[text.uiSm, styles.muted]}>{eduMeta}</Text>}
            </View>
          </View>
        </SectionBlock>
      ) : null}

      {candidate.skills?.length > 0 && (
        <SectionBlock label="Skills">
          <SkillTags skills={candidate.skills} max={8} />
        </SectionBlock>
      )}

      {looking.length > 0 && (
        <SectionBlock label="Looking for">
          <View style={styles.looking}>
            {looking.map(([k, v]) => (
              <View key={k} style={styles.lookRow}>
                <Text style={[text.uiMd, styles.muted, styles.lookKey]}>{k}</Text>
                <Text style={[text.uiMdMedium, styles.secondary, styles.grow]}>{v}</Text>
              </View>
            ))}
          </View>
        </SectionBlock>
      )}

      {documents.length + links.length > 0 && (
        <SectionBlock label={filesLabel}>
          {documents.map((d) => (
            <DocumentRow key={d.id} doc={d} opening={openingDoc === d.id} onOpen={onOpenDocument} />
          ))}
          {links.map((l, i) => <LinkRow key={`${l}-${i}`} url={l} onOpen={onOpenLink} />)}
        </SectionBlock>
      )}
    </>
  )
}

/** The video row's still: 106 × 70 (P1). */
const VIDEO_W = height['video-thumb'] - spaceHalf['2.5']
const VIDEO_H = height.fab + spaceHalf['3.5']

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

  // Studio (P1–P2)
  off: { opacity: opacity.disabled },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: spaceHalf['3.5'] },
  tile: { paddingHorizontal: spaceHalf['2.5'] },
  videoScroll: { marginHorizontal: -space.xl },
  videoRow: { gap: space.sm, paddingHorizontal: space.xl },
  video: { width: VIDEO_W, gap: space.xs + borderWidth.thin },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  tlDot: {
    width: spaceHalf['2.5'] + borderWidth.thin,
    height: spaceHalf['2.5'] + borderWidth.thin,
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium + borderWidth.thin,
    borderColor: color.accent,
    marginTop: space.xs,
  },
  tlBody: { flex: 1, minWidth: 0, gap: space['2xs'] },
  tlDesc: { marginTop: space['2xs'] },
  eduRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eduMark: { width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.tile, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  looking: { gap: spaceHalf['1.5'] },
  lookRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'] },
  lookKey: { width: space['4xl'] + space.xl },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, minHeight: height.tap },
  fileTile: { width: height.avatar, height: height['avatar-lg'], borderRadius: radius.sm, backgroundColor: color.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  fileExt: { color: color.danger },
  linkTile: { backgroundColor: color.surfaceMuted },

  player: { flex: 1, backgroundColor: color.inkDeep, gap: space.md },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
})
