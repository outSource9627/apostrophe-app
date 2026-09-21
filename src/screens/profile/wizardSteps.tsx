import React from 'react'
import { StyleSheet, View } from 'react-native'
import { color, space, radius, borderWidth } from '../../theme'
import { Body, Chip, Eyebrow, Field, Input, StatusPill } from '../../components/ui'

/**
 * The six step bodies of the profile wizard — the app half of the web step
 * components. Each takes the same contract: the draft the shell holds, a `patch`
 * that merges into it, the server config for option lists, and the profile for
 * read-back (pending skills, etc.). No step talks to the API — the shell owns
 * saving, so autosave and Continue cannot diverge.
 *
 * FILE UPLOADS ARE STUBBED. The photo, qualification document and résumé need a
 * native image/document picker (not yet a dependency), so those affordances say
 * what they will take and are wired to `onPick` for when the picker lands. The
 * text and choice fields — which is what completion is mostly weighted on — are
 * real and autosave.
 */
export interface Config {
  profile: {
    genders: string[]
    scoreTypes: string[]
    availability: string[]
    employmentTypes: string[]
  }
  limits: { minSkills: number }
  masterData: {
    skills: { name: string }[]
    cities: { name: string }[]
    languages: { name: string }[]
  }
}
export interface ProfileData {
  skills?: { name: string; status: string }[]
}
export interface StepProps {
  draft: Record<string, any>
  patch: (next: Record<string, unknown>) => void
  config: Config
  profile: ProfileData
}

const QUAL_LABEL: Record<string, string> = {
  MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say',
  PERCENTAGE: 'Percentage', CGPA: 'CGPA',
  IMMEDIATE: 'Immediately', DAYS_15: 'Within 15 days', DAYS_30: 'Within 30 days', DAYS_60: 'Within 60 days',
  FULL_TIME: 'Full time', PART_TIME: 'Part time', INTERNSHIP: 'Internship', CONTRACT: 'Contract', REMOTE: 'Remote', HYBRID: 'Hybrid',
}
const label = (v: string) => QUAL_LABEL[v] ?? v

/** A removable / addable chip row — the app's TagInput stand-in (no TagInput export). */
function ChipRow({
  values, onRemove, suggestions, onAdd, pending,
}: {
  values: string[]
  onRemove: (i: number) => void
  suggestions?: string[]
  onAdd?: (v: string) => void
  pending?: string[]
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.chips}>
        {values.map((v, i) => (
          <Chip key={v} label={pending?.includes(v) ? `${v}  ·  pending` : `${v}  ✕`} selected onPress={() => onRemove(i)} />
        ))}
      </View>
      {suggestions && suggestions.length > 0 && onAdd ? (
        <View style={styles.chips}>
          {suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 6).map((s) => (
            <Chip key={s} label={s} add onPress={() => onAdd(s)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function PersonalStep({ draft, patch, config }: StepProps) {
  const langs: string[] = draft.languages ?? []
  return (
    <View style={styles.stack}>
      <Field label="Date of birth">
        <Input value={String(draft.dateOfBirth ?? '')} onChangeText={(v) => patch({ dateOfBirth: v })} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="City">
        <Input value={String(draft.city ?? '')} onChangeText={(v) => patch({ city: v })} placeholder="Where you are based" />
      </Field>
      <Field label="Gender">
        <View style={styles.chips}>
          {config.profile.genders.map((g) => (
            <Chip key={g} label={label(g)} selected={draft.gender === g} onPress={() => patch({ gender: g })} />
          ))}
        </View>
      </Field>
      <Field label="Languages you speak" helper="Tap a suggestion to add.">
        <ChipRow
          values={langs}
          onRemove={(i) => patch({ languages: langs.filter((_, n) => n !== i) })}
          suggestions={config.masterData.languages.map((l) => l.name)}
          onAdd={(v) => patch({ languages: [...langs, v] })}
        />
      </Field>
    </View>
  )
}

export function EducationStep({ draft, patch, config }: StepProps) {
  return (
    <View style={styles.stack}>
      <Field label="Institution">
        <Input value={String(draft.institution ?? '')} onChangeText={(v) => patch({ institution: v })} placeholder="College or university" />
      </Field>
      <Field label="Field of study">
        <Input value={String(draft.fieldOfStudy ?? '')} onChangeText={(v) => patch({ fieldOfStudy: v })} placeholder="e.g. Commerce" />
      </Field>
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Field label="Year">
            <Input keyboardType="number-pad" value={draft.yearOfCompletion ? String(draft.yearOfCompletion) : ''} onChangeText={(v) => patch({ yearOfCompletion: v ? Number(v) : undefined })} placeholder="2023" />
          </Field>
        </View>
        <View style={styles.pairItem}>
          <Field label="Score">
            <Input keyboardType="decimal-pad" value={draft.score != null ? String(draft.score) : ''} onChangeText={(v) => patch({ score: v ? Number(v) : undefined })} placeholder="7.4" />
          </Field>
        </View>
      </View>
      <Field label="Score type">
        <View style={styles.chips}>
          {config.profile.scoreTypes.map((t) => (
            <Chip key={t} label={label(t)} selected={draft.scoreType === t} onPress={() => patch({ scoreType: t })} />
          ))}
        </View>
      </Field>
      <View style={styles.proof}>
        <View style={styles.proofHead}>
          <Eyebrow>Proof of qualification</Eyebrow>
          <StatusPill tone="warning" label="required" />
        </View>
        <Body size="sm" tone="muted">Your interviewer checks this against what you enter. Never shown to employers. PDF, JPG or PNG up to 10 MB.</Body>
        <Chip label={draft.documentKey ? 'Replace file' : 'Choose a file'} add onPress={() => patch({ __pickDoc: Date.now() })} />
      </View>
    </View>
  )
}

export function ExperienceStep({ draft, patch }: StepProps) {
  const entries: any[] = draft.experience ?? []
  const setEntry = (i: number, next: Record<string, unknown>) =>
    patch({ experience: entries.map((e, n) => (n === i ? { ...e, ...next } : e)) })
  return (
    <View style={styles.stack}>
      <Body size="sm" tone="muted">Internships and part-time work count. This step is optional.</Body>
      {entries.map((e, i) => (
        <View key={i} style={styles.entry}>
          <Field label="Company"><Input value={String(e.company ?? '')} onChangeText={(v) => setEntry(i, { company: v })} placeholder="Where you worked" /></Field>
          <Field label="Role"><Input value={String(e.role ?? '')} onChangeText={(v) => setEntry(i, { role: v })} placeholder="What you did" /></Field>
          <Chip label="Remove" onPress={() => patch({ experience: entries.filter((_, n) => n !== i) })} />
        </View>
      ))}
      <Chip label="Add another role" add onPress={() => patch({ experience: [...entries, {}] })} />
    </View>
  )
}

export function SkillsStep({ draft, patch, config, profile }: StepProps) {
  const skills: string[] = draft.skills ?? []
  const min = config.limits.minSkills
  const short = Math.max(0, min - skills.length)
  const pending = (profile.skills ?? []).filter((s) => s.status === 'PENDING_REVIEW').map((s) => s.name)
  return (
    <View style={styles.stack}>
      <Field label="Your skills" helper={`At least ${min}.`}>
        <ChipRow
          values={skills}
          pending={pending}
          onRemove={(i) => patch({ skills: skills.filter((_, n) => n !== i) })}
          suggestions={config.masterData.skills.map((s) => s.name)}
          onAdd={(v) => patch({ skills: [...skills, v] })}
        />
      </Field>
      <Body size="sm" tone={short > 0 ? 'muted' : 'default'}>
        {skills.length} of {min}{short > 0 ? ` · ${short} to go` : ' · minimum met'}
      </Body>
      {pending.length > 0 && (
        <View style={styles.pendingCard}>
          <Body size="sm" tone="default">
            {pending.join(', ')} {pending.length === 1 ? 'is' : 'are'} not in our list yet, so {pending.length === 1 ? 'it is' : 'they are'} on your profile already and queued for review. {pending.length === 1 ? 'It counts' : 'They count'} towards your {min} either way.
          </Body>
        </View>
      )}
    </View>
  )
}

export function PreferencesStep({ draft, patch, config }: StepProps) {
  const roles: string[] = draft.desiredRoles ?? []
  const locs: string[] = draft.preferredLocations ?? []
  const types: string[] = draft.employmentTypes ?? []
  const toggle = (arr: string[], v: string, key: string) =>
    patch({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] })
  return (
    <View style={styles.stack}>
      <Field label="Roles you want" helper="Tap to add.">
        <ChipRow values={roles} onRemove={(i) => patch({ desiredRoles: roles.filter((_, n) => n !== i) })} />
        <Input value="" onSubmitEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v) patch({ desiredRoles: [...roles, v] }) }} placeholder="Type a role, press return" />
      </Field>
      <Field label="Preferred locations">
        <ChipRow
          values={locs}
          onRemove={(i) => patch({ preferredLocations: locs.filter((_, n) => n !== i) })}
          suggestions={config.masterData.cities.map((c) => c.name)}
          onAdd={(v) => patch({ preferredLocations: [...locs, v] })}
        />
      </Field>
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Field label="Expected salary (min, LPA)">
            <Input keyboardType="decimal-pad" value={draft.expectedSalaryMinLpa != null ? String(draft.expectedSalaryMinLpa) : ''} onChangeText={(v) => patch({ expectedSalaryMinPaise: v ? Math.round(Number(v) * 100000 * 100) : undefined, expectedSalaryMinLpa: v ? Number(v) : undefined })} placeholder="6" />
          </Field>
        </View>
        <View style={styles.pairItem}>
          <Field label="Max, LPA">
            <Input keyboardType="decimal-pad" value={draft.expectedSalaryMaxLpa != null ? String(draft.expectedSalaryMaxLpa) : ''} onChangeText={(v) => patch({ expectedSalaryMaxPaise: v ? Math.round(Number(v) * 100000 * 100) : undefined, expectedSalaryMaxLpa: v ? Number(v) : undefined })} placeholder="9" />
          </Field>
        </View>
      </View>
      <Field label="Kind of work">
        <View style={styles.chips}>
          {config.profile.employmentTypes.map((t) => (
            <Chip key={t} label={label(t)} selected={types.includes(t)} onPress={() => toggle(types, t, 'employmentTypes')} />
          ))}
        </View>
      </Field>
      <Field label="When you can join">
        <View style={styles.chips}>
          {config.profile.availability.map((a) => (
            <Chip key={a} label={label(a)} selected={draft.availabilityToJoin === a} onPress={() => patch({ availabilityToJoin: a })} />
          ))}
        </View>
      </Field>
    </View>
  )
}

export function DocumentsStep({ draft, patch }: StepProps) {
  const links: string[] = draft.portfolioLinks ?? []
  return (
    <View style={styles.stack}>
      <Body size="sm" tone="muted">Your résumé and any supporting files. Private, reachable only through a signed link. This step is optional.</Body>
      <View style={styles.proof}>
        <Eyebrow>Résumé</Eyebrow>
        <Body size="sm" tone="muted">PDF, DOC or DOCX.</Body>
        <Chip label="Choose a file" add onPress={() => patch({ __pickResume: Date.now() })} />
      </View>
      <Field label="Portfolio links" helper="A site, a repo, a reel.">
        <ChipRow values={links} onRemove={(i) => patch({ portfolioLinks: links.filter((_, n) => n !== i) })} />
        <Input value="" onSubmitEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v) patch({ portfolioLinks: [...links, v] }) }} placeholder="https://… , press return" autoCapitalize="none" />
      </Field>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  pairItem: { flex: 1 },
  proof: { gap: space.sm, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted, padding: space.lg },
  proofHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entry: { gap: space.md, borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg },
  pendingCard: { borderRadius: radius.md, backgroundColor: color.infoSoft, padding: space.lg },
})
