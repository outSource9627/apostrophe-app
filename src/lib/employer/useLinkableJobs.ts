import { useEffect, useState } from 'react'
import { fetchEmployerJobs, type EmployerJobRow } from '../api/employerJobs'
import type { EmployerJobRef } from '../api/employerShortlist'

/** The openings an Interest or a shortlist entry can point at: still live, or only resting. A closed one keeps its title but is no longer offered. */
const LINKABLE_STATUSES = ['PUBLISHED', 'PAUSED']

export const linkableJobs = (jobs: EmployerJobRef[]) => jobs.filter((j) => LINKABLE_STATUSES.includes(j.status))

const toRef = (j: EmployerJobRow): EmployerJobRef => ({
  id: j.id,
  title: j.title,
  location: j.location ?? '',
  status: j.status,
})

/**
 * Every job the employer has, for titles and for the link pickers (filter with
 * `linkableJobs`). Null until they load; an empty list if the request fails, so a
 * row falls back to naming no job rather than breaking.
 */
export function useEmployerJobRefs(enabled = true): EmployerJobRef[] | null {
  const [jobs, setJobs] = useState<EmployerJobRef[] | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    fetchEmployerJobs({ perPage: 100 })
      .then((res) => live && setJobs((res?.rows ?? []).map(toRef)))
      .catch(() => live && setJobs([]))
    return () => {
      live = false
    }
  }, [enabled])

  return jobs
}
