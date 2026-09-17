import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { clearFilters, putFilters, type EmploymentType, type JobFilters } from '../../lib/api/jobs'
import { activeFilterCount, employmentLabel } from '../../lib/jobs/format'
import { color, space, radius, borderWidth } from '../../theme'
import { Button, Chip, Field, Input, Meta, Sheet, Toggle } from '../../components/ui'

const TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE', 'HYBRID']

/**
 * ST-37 — seven filters, the set count, Clear all in one action. A sheet, never
 * a full page — it returns the student to their feed position. Filters PERSIST
 * server-side (shared web/app), so an empty feed offers Clear all rather than
 * reading as "no jobs".
 */
export function JobFilterSheet({ open, initial, onClose, onApply }: {
  open: boolean; initial: JobFilters; onClose: () => void; onApply: (f: JobFilters) => void
}) {
  const [f, setF] = useState<JobFilters>(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setF(initial) }, [open, initial])

  const set = (patch: Partial<JobFilters>) => setF((prev) => cleanEmpty({ ...prev, ...patch }))
  const salaryLpa = f.minSalaryPaise != null ? String(f.minSalaryPaise / 100 / 100000) : ''
  const count = activeFilterCount(f)

  async function apply() {
    setBusy(true)
    try { const r = await putFilters(f); onApply(r.filters) } catch { onApply(f) } finally { setBusy(false) }
  }
  async function clear() {
    setBusy(true)
    try { await clearFilters() } catch { /* fall through */ } finally { setBusy(false) }
    setF({}); onApply({})
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      primary={<Button variant="primary" size="block" full busy={busy} label={count > 0 ? `Show jobs · ${count} filter${count === 1 ? '' : 's'}` : 'Show all jobs'} onPress={apply} />}
      secondary={count > 0 ? <Button variant="outline" size="block" full label="Clear all" onPress={clear} /> : undefined}
    >
      <ScrollView contentContainerStyle={{ gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Field label="Role or keyword"><Input value={f.keyword ?? ''} onChangeText={(v) => set({ keyword: v })} placeholder="e.g. analyst" /></Field>
        <Field label="Location"><Input value={f.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder="City" /></Field>
        <View style={styles.toggleWrap}><Toggle on={Boolean(f.remote)} onChange={(v) => set({ remote: v || undefined })} label="Remote only" /></View>
        <Field label="Minimum salary (LPA)"><Input keyboardType="numeric" value={salaryLpa} onChangeText={(v) => { const n = Number(v); set({ minSalaryPaise: v && n > 0 ? Math.round(n * 100000 * 100) : undefined }) }} placeholder="6" /></Field>
        <Field label="Employment type">
          <View style={styles.chips}>{TYPES.map((t) => <Chip key={t} label={employmentLabel(t)} selected={f.employmentType === t} onPress={() => set({ employmentType: f.employmentType === t ? undefined : t })} />)}</View>
        </Field>
        <Field label="Industry"><Input value={f.industry ?? ''} onChangeText={(v) => set({ industry: v })} placeholder="e.g. Financial Services" /></Field>
        <Field label="Experience — up to (years)"><Input keyboardType="numeric" value={f.maxExperienceYears != null ? String(f.maxExperienceYears) : ''} onChangeText={(v) => { const n = Number(v); set({ maxExperienceYears: v && n >= 0 ? n : undefined }) }} placeholder="Your years" /></Field>
        <Field label="Company"><Input value={f.company ?? ''} onChangeText={(v) => set({ company: v })} placeholder="Company name" /></Field>
        <Meta style={{ color: color.textSubtle }}>Filters stay set across app restarts and on the web — they follow your account, not this device.</Meta>
      </ScrollView>
    </Sheet>
  )
}

function cleanEmpty(f: JobFilters): JobFilters {
  const out: JobFilters = { ...f }
  for (const k of Object.keys(out) as (keyof JobFilters)[]) {
    const v = out[k]
    if (v === undefined || v === '' || v === false) delete out[k]
  }
  return out
}

const styles = StyleSheet.create({
  toggleWrap: { borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})
