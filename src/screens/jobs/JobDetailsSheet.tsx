import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { JobCard, JobDetail } from '../../lib/api/jobs'
import {
  applicationMark, dateLine, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange,
} from '../../lib/jobs/format'
import { label } from '../../lib/profile/labels'
import {
  FeedSheet, FeedSheetBullets, FeedSheetChips, FeedSheetCta, FeedSheetFacts, FeedSheetHead, FeedSheetLogo, FeedSheetNote,
  FeedSheetProse, FeedSheetRound, FeedSheetSection,
} from '../../components/ui/feed-deck'
import { JobVideo } from './jobParts'

const initialsOf = (name?: string | null) =>
  (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

/**
 * The job feed's details sheet (docs/feed-details-mockups.html · A, "Twin +
 * dark sheet"). The full post slides up, dark like the feed, over the card the
 * student opened it from, so closing it returns them to the same place.
 *
 * The head and the fact grid (Pay · Type · Experience · Deadline, then where,
 * the category, the department and the openings) draw at once from the card;
 * the role, what you'll do, what they want, what you get, the skills and the
 * company load behind them. The foot carries the deck's three verbs: not
 * interested, save, and apply — a swipe verb here closes the sheet and moves
 * the deck on.
 *
 * The API sends no match reason, so none is drawn.
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
  const q = useQuery({
    queryKey: ['job', card?.id],
    queryFn: () => api.get<JobDetail>(`/students/me/jobs/${card!.id}`),
    enabled: !!card,
  })

  const job = q.data
  const applied = job?.application ?? null
  const deadline = card ? deadlineLine(card.applicationDeadline) : null
  const closed = deadline === 'Closed'

  return (
    <FeedSheet
      open={!!card}
      onClose={onClose}
      head={card && (
        <FeedSheetHead
          lead={<FeedSheetLogo initials={initialsOf(card.company?.name)} />}
          title={card.title}
          sub={[card.company?.name, card.publishedAt ? `Posted ${dateLine(card.publishedAt)}` : null].filter(Boolean).join(' · ')}
          onClose={onClose}
        />
      )}
      foot={card && (
        <>
          <FeedSheetRound kind="pass" label="Not interested" disabled={busy} onPress={onSkip} />
          <FeedSheetRound kind="like" label={card.saved ? 'Saved' : 'Save'} disabled={busy || card.saved} onPress={onSave} />
          <FeedSheetCta
            label={applied ? 'Already applied' : closed ? 'Applications closed' : 'Apply with video resume'}
            disabled={closed || !!applied}
            onPress={() => onApply(card.id)}
          />
        </>
      )}
    >
      {card && <Body card={card} job={job} loading={q.isPending} failed={q.isError} deadline={deadline} />}
    </FeedSheet>
  )
}

function Body({
  card, job, loading, failed, deadline,
}: { card: JobCard; job: JobDetail | undefined; loading: boolean; failed: boolean; deadline: string | null }) {
  const pay = salaryRange(card.salary)
  const type = employmentLabel(card.employmentType)
  const facts = [
    pay ? { label: 'Pay', value: pay, pink: true } : null,
    { label: 'Type', value: type },
    { label: 'Experience', value: experienceLine(card.experience) },
    deadline ? { label: 'Deadline', value: deadline } : null,
  ].filter((f): f is { label: string; value: string; pink?: boolean } => !!f)

  // Where, then what kind of role — each said once (a Remote job at "Remote" is already in Type).
  const said = new Set([type.toLowerCase()])
  const chips = [
    ...(locationLine(card.location, card.remote) ?? '').split(' · '),
    card.category,
    card.department,
    card.vacancies > 0 ? `${card.vacancies} ${card.vacancies === 1 ? 'opening' : 'openings'}` : null,
  ].filter((c): c is string => {
    const k = c?.trim().toLowerCase()
    if (!k || said.has(k)) return false
    said.add(k)
    return true
  })

  const application = job?.application ?? null
  const wants = job ? [...job.requirements, ...(job.minQualification ? [`${label(job.minQualification)} or above`] : [])] : []
  const company = job ? [job.company.industry, job.company.size ? `${job.company.size} people` : null, job.company.officeLocation].filter(Boolean).join(' · ') : ''

  return (
    <>
      <FeedSheetFacts items={facts} />
      <FeedSheetChips soft items={[
        ...(application ? [`${applicationMark(application.status).label} · ${dateLine(application.appliedAt)}`] : []),
        ...chips,
      ]} />
      {card.video?.url ? <JobVideo url={card.video.url} /> : null}

      {loading ? (
        <FeedSheetNote loading />
      ) : failed || !job ? (
        <FeedSheetNote>Could not load the full post. The summary above is current.</FeedSheetNote>
      ) : (
        <>
          {!!job.description && <FeedSheetSection title="The role"><FeedSheetProse>{job.description}</FeedSheetProse></FeedSheetSection>}
          {job.responsibilities.length > 0 && <FeedSheetSection title="What you’ll do"><FeedSheetBullets items={job.responsibilities} /></FeedSheetSection>}
          {wants.length > 0 && <FeedSheetSection title="What they’re looking for"><FeedSheetBullets items={wants} /></FeedSheetSection>}
          {job.benefits.length > 0 && <FeedSheetSection title="What you get"><FeedSheetBullets items={job.benefits} /></FeedSheetSection>}
          {job.skills.length > 0 && <FeedSheetSection title="Skills"><FeedSheetChips items={job.skills} /></FeedSheetSection>}
          {!!company && <FeedSheetSection title={`About ${job.company.name}`}><FeedSheetProse>{company}</FeedSheetProse></FeedSheetSection>}
        </>
      )}
    </>
  )
}
