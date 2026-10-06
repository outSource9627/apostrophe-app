import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native'
import { color, fontFamilyNative as FF, fontSize, leadingNative, space } from '../../theme'
import { Icon } from '../../components/ui/Icon'
import {
  FeedSheet, FeedSheetChips, FeedSheetCta, FeedSheetEntry, FeedSheetFace, FeedSheetFacts, FeedSheetFilm, FeedSheetHead, FeedSheetItem,
  FeedSheetNote, FeedSheetPlay, FeedSheetRound, FeedSheetSection,
} from '../../components/ui/feed-deck'
import { availabilityOf, ClipPlayer, expectedSalaryOf, experienceShort, linkUrl, portfolioLinksOf } from '../../components/employer/profile'
import { ApiClientError } from '../../lib/api'
import {
  fetchCandidateDetail, fetchCandidateDocument, playSelfVideo, type CandidateCard, type CandidateDetail, type CandidateDocumentView,
} from '../../lib/api/employerFeed'
import {
  clipLength, fileSize, joinsLine, monthYear, nameInitials, salaryLine, tierLine,
} from '../../lib/employer/candidateFormat'
import { label } from '../../lib/profile/labels'
import { SendInterestSheet } from './SendInterestModal'

/**
 * The feed's profile sheet (docs/feed-details-mockups.html · A, "Twin + dark
 * sheet"): dark like the feed, it rises over the card the employer opened it
 * from.
 *
 * Top to bottom: the face, name and tier line; the verified-interview film with
 * Watch full interview; Expected · Joins · Experience · Based in; then
 * experience, education, what they are looking for, skills, languages, the
 * self-uploaded clips (they play here), documents (a 15-minute link) and links.
 * When the profile has a résumé (ST-35) it sits right under the facts too, so
 * the CV is one tap from the top. The foot passes, shortlists or opens Send an
 * Interest. The head and the facts draw at once from the card; the rest loads
 * behind them. A section with nothing in it is not drawn.
 */
export function CandidateProfileSheet({
  open, card, passDays, onClose, onPass, onShortlist, onOpenFull, onInterestSent,
}: {
  open: boolean
  card: CandidateCard
  passDays?: number
  onClose: () => void
  onPass: () => void
  onShortlist: () => void
  onOpenFull: () => void
  onInterestSent?: (candidateId: string) => void
}) {
  const [detail, setDetail] = useState<CandidateDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interestOpen, setInterestOpen] = useState(false)
  const [clip, setClip] = useState<{ url: string; title?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setDetail(null)
    setError(null)
    setNotice(null)
    fetchCandidateDetail(card.id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load the profile.'))
    return () => {
      alive = false
    }
  }, [open, card.id])

  async function playClip(videoId: string) {
    setNotice(null)
    try {
      const r = await playSelfVideo(card.id, videoId)
      setClip({ url: r.url, title: detail?.videos.find((v) => v.id === videoId)?.title ?? undefined })
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The clip did not load. Try again.')
    }
  }

  async function openDocument(docId: string) {
    setNotice(null)
    setOpeningDoc(docId)
    try {
      const r = await fetchCandidateDocument(card.id, docId)
      await Linking.openURL(r.url)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The document did not open. Try again.')
    } finally {
      setOpeningDoc(null)
    }
  }

  const verified = !!(detail?.verifiedInterview ?? card.verifiedInterview)?.verified
  const interestSent = (detail?.interest ?? card.interest) === 'SENT'
  const sub = [tierLine(detail?.tier ?? card.tier, detail?.qualification ?? card.qualification), detail?.city ?? card.city].filter(Boolean).join(' · ')
  const facts = [
    { label: 'Expected', value: salaryLine(detail ? expectedSalaryOf(detail, card) : card.expectedSalary), pink: true },
    { label: 'Joins', value: joinsLine(detail ? availabilityOf(detail, card) : card.availability) },
    { label: 'Experience', value: experienceShort(detail?.experienceYears ?? card.experienceYears) },
    { label: 'Based in', value: detail?.city ?? card.city },
  ].filter((f): f is { label: string; value: string; pink?: boolean } => !!f.value)

  return (
    <>
      <FeedSheet
        open={open && !interestOpen && !clip}
        onClose={onClose}
        head={
          <FeedSheetHead
            lead={<FeedSheetFace initials={nameInitials(card.name)} photo={detail?.photoUrl ?? card.photoUrl} />}
            title={detail?.name ?? card.name}
            sub={sub}
            verified={verified}
            onClose={onClose}
          />
        }
        foot={
          <>
            <FeedSheetRound kind="pass" label={passDays ? `Pass, hidden for ${passDays} days` : 'Pass'} onPress={onPass} />
            <FeedSheetRound kind="like" label="Shortlist" onPress={onShortlist} />
            <FeedSheetCta label={interestSent ? 'Interest sent' : 'Send Interest'} disabled={interestSent} onPress={() => setInterestOpen(true)} />
          </>
        }
      >
        {card.hasVideo && (
          <FeedSheetFilm
            poster={card.posterUrl ?? card.photoUrl}
            title={verified ? 'Verified interview' : 'Interview film'}
            sub="The full recording, as the interviewer saw it"
            action="Watch full interview"
            onPress={onOpenFull}
          />
        )}
        <FeedSheetFacts items={facts} />
        {!!detail?.resume && (
          <ResumeItem doc={detail.resume} opening={openingDoc === detail.resume.id} onOpen={openDocument} />
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        {detail ? (
          <Sections candidate={detail} openingDoc={openingDoc} onPlayClip={playClip} onOpenDocument={openDocument} />
        ) : error ? (
          <FeedSheetNote>{error}</FeedSheetNote>
        ) : (
          <FeedSheetNote loading />
        )}
      </FeedSheet>

      <SendInterestSheet
        open={open && interestOpen}
        candidate={{
          id: card.id,
          name: card.name,
          photoUrl: card.photoUrl,
          tier: card.tier,
          qualification: card.qualification,
          city: card.city,
          verified: card.verifiedInterview?.verified,
        }}
        onClose={() => setInterestOpen(false)}
        onSent={() => onInterestSent?.(card.id)}
      />

      <ClipPlayer url={clip?.url ?? null} title={clip?.title} onClose={() => setClip(null)} />
    </>
  )
}

/** The résumé, one tap from the top of the sheet: the same row the Documents section draws for it. */
function ResumeItem({ doc, opening, onOpen }: { doc: CandidateDocumentView; opening: boolean; onOpen: (docId: string) => void }) {
  return (
    <FeedSheetItem
      lead={<View style={styles.docMark}><Icon name="file" size={space.lg} tint={color.textOnInkMuted} /></View>}
      title={label(doc.kind)}
      sub={[doc.name, fileSize(doc.sizeBytes)].filter(Boolean).join(' · ')}
      trail={opening
        ? <ActivityIndicator color={color.textOnInkMuted} />
        : <Icon name="download" size={space.lg + 2} tint={color.textOnInkMuted} />}
      label={`Download ${doc.name || label(doc.kind)}`}
      disabled={opening}
      onPress={() => onOpen(doc.id)}
    />
  )
}

function Sections({
  candidate, openingDoc, onPlayClip, onOpenDocument,
}: {
  candidate: CandidateDetail
  openingDoc: string | null
  onPlayClip: (videoId: string) => void
  onOpenDocument: (docId: string) => void
}) {
  const experience = candidate.experience ?? []
  const edu = candidate.education
  const eduTitle = edu ? [edu.qualification ? label(edu.qualification) : null, edu.fieldOfStudy].filter(Boolean).join(' · ') : ''
  const eduSub = edu
    ? [edu.institution, edu.year ?? edu.yearOfCompletion, edu.score != null ? `${edu.scoreType ? label(edu.scoreType) : 'Score'} ${edu.score}` : null]
        .filter(Boolean)
        .join(' · ')
    : ''
  const prefs = candidate.preferences
  const looking = [
    ...(prefs?.desiredRoles ?? []),
    ...(prefs?.targetRoles ?? []),
    ...(prefs?.preferredLocations ?? []),
    ...(prefs?.remote ? ['Open to remote'] : []),
    ...(prefs?.employmentTypes ?? []).map(label),
  ].filter((v, k, all) => !!v && all.indexOf(v) === k)
  const videos = candidate.videos ?? []
  const documents = candidate.documents ?? []
  const links = portfolioLinksOf(candidate.portfolioLinks)

  return (
    <>
      <FeedSheetSection title="Experience">
        {experience.length > 0 ? (
          <View style={styles.list}>
            {experience.map((x, k) => (
              <FeedSheetEntry
                key={`${k}-${x.company}`}
                icon="brief"
                title={x.title || x.company}
                sub={[x.title ? x.company : null, [monthYear(x.from), x.to ? monthYear(x.to) : 'now'].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
                body={x.description}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No work experience listed.</Text>
        )}
      </FeedSheetSection>

      {!!edu && (!!eduTitle || !!eduSub) && (
        <FeedSheetSection title="Education">
          <FeedSheetEntry icon="grad" title={eduTitle || 'Education'} sub={eduSub} />
        </FeedSheetSection>
      )}

      {looking.length > 0 && <FeedSheetSection title="Looking for"><FeedSheetChips soft items={looking} /></FeedSheetSection>}
      {candidate.skills?.length > 0 && <FeedSheetSection title="Skills"><FeedSheetChips items={candidate.skills} /></FeedSheetSection>}
      {candidate.languages?.length > 0 && <FeedSheetSection title="Languages"><FeedSheetChips items={candidate.languages} /></FeedSheetSection>}

      {videos.length > 0 && (
        <FeedSheetSection title="Self-uploaded clips">
          <View style={styles.list}>
            {videos.map((v) => (
              <FeedSheetItem
                key={v.id}
                lead={<FeedSheetPlay />}
                title={v.title || `Clip ${v.slot}`}
                sub="Self-uploaded · not verified"
                trail={clipLength(v.durationSec) ? <Text style={styles.trail}>{clipLength(v.durationSec)}</Text> : null}
                label={`Play ${v.title || `clip ${v.slot}`}, self-uploaded, not verified`}
                onPress={() => onPlayClip(v.id)}
              />
            ))}
          </View>
        </FeedSheetSection>
      )}

      {documents.length > 0 && (
        <FeedSheetSection title="Documents">
          <View style={styles.list}>
            {documents.map((d) => (
              <FeedSheetItem
                key={d.id}
                lead={<View style={styles.docMark}><Icon name="file" size={space.lg} tint={color.textOnInkMuted} /></View>}
                title={d.name || label(d.kind)}
                sub={[label(d.kind), fileSize(d.sizeBytes)].filter(Boolean).join(' · ')}
                trail={openingDoc === d.id
                  ? <ActivityIndicator color={color.textOnInkMuted} />
                  : <Icon name="download" size={space.lg + 2} tint={color.textOnInkMuted} />}
                label={`Download ${d.name || label(d.kind)}`}
                disabled={openingDoc === d.id}
                onPress={() => onOpenDocument(d.id)}
              />
            ))}
          </View>
        </FeedSheetSection>
      )}

      {links.length > 0 && (
        <FeedSheetSection title="Links">
          <View style={styles.list}>
            {links.map((l, k) => (
              <FeedSheetItem
                key={`${k}-${l}`}
                lead={<View style={styles.docMark}><Icon name="link" size={space.lg} tint={color.textOnInkMuted} /></View>}
                title={l}
                trail={<Icon name="arrowUR" size={space.lg} tint={color.textOnInkMuted} />}
                label={`Open ${l}`}
                onPress={() => { Linking.openURL(linkUrl(l)).catch(() => {}) }}
              />
            ))}
          </View>
        </FeedSheetSection>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  empty: { fontFamily: FF.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInkMuted },
  notice: { fontFamily: FF.body, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.dangerOnInk },
  trail: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], fontVariant: ['tabular-nums'], color: color.textOnInkMuted },
  docMark: { width: space['2xl'] + space['2xs'], height: space['2xl'] + space['2xs'], alignItems: 'center', justifyContent: 'center' },
})
