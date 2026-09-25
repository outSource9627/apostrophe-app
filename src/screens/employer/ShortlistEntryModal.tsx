import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmLabel, EmRadioRow, EmSheet } from '../../components/employer/em'
import { FeedFace } from '../../components/employer/feed'
import { ApiClientError } from '../../lib/api'
import { updateShortlistEntry, type EmployerJobRef, type ShortlistRow } from '../../lib/api/employerShortlist'
import { tierLine } from '../../lib/employer/candidateFormat'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'

export interface ShortlistEntryUpdate {
  id: string
  notes: string | null
  tags: string[]
  jobId: string | null
}

/**
 * EM-15 · Notes, tags and job — a sheet over the shortlist. The private note,
 * the company's tags (tap to toggle, or add a new one), and the one job post the
 * candidate is linked to. Private to the company; the candidate never sees it.
 * Limits are the server's (note length, tag count, tag length).
 */
export function ShortlistEntrySheet({
  open, row, knownTags, jobs, onClose, onSaved,
}: {
  open: boolean
  row: ShortlistRow | null
  /** Every tag the company already uses, offered as chips. */
  knownTags: string[]
  /** The linkable jobs (live or paused). */
  jobs: EmployerJobRef[]
  onClose: () => void
  onSaved: (u: ShortlistEntryUpdate) => void
}) {
  const insets = useSafeAreaInsets()
  const cfg = useShortlistConfig()
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftTag, setDraftTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && row) {
      setNotes(row.notes ?? '')
      setTags(row.tags ?? [])
      setJobId(row.jobId)
      setAdding(false)
      setDraftTag('')
      setError(null)
    }
  }, [open, row])

  if (!row) return null

  const offered = [...new Map([...knownTags, ...tags].map((t) => [t.toLowerCase(), t])).values()].sort((a, b) => a.localeCompare(b))
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase())
  const toggle = (t: string) => {
    if (has(t)) setTags(tags.filter((x) => x.toLowerCase() !== t.toLowerCase()))
    else if (tags.length >= cfg.tagsMax) setError(`Up to ${cfg.tagsMax} tags.`)
    else setTags([...tags, t])
  }
  const addTag = () => {
    const t = draftTag.trim().slice(0, cfg.tagMax)
    setAdding(false)
    setDraftTag('')
    if (t && !has(t)) toggle(t)
  }

  async function save() {
    if (!row) return
    setSaving(true)
    setError(null)
    try {
      const res = await updateShortlistEntry(row.id, { notes: notes.trim(), tags, jobId })
      onSaved({ id: row.id, notes: res.notes, tags: res.tags, jobId: res.jobId })
      onClose()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Not saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // A job linked earlier and since closed is still shown, so saving does not silently unlink it.
  const linked = row.jobId && !jobs.some((j) => j.id === row.jobId) ? [{ id: row.jobId, title: 'The job linked earlier (closed)' }] : []

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      tall
      title="Notes, tags and job"
      sub="Private to your company."
      foot={
        <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
          {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
          <Button variant="secondary" size="lg" full label="Save" busy={saving} onPress={() => { save() }} />
        </View>
      }
    >
      <View style={styles.cand}>
        <FeedFace name={row.name} photo={row.photoUrl} size={height.tap} />
        <View style={styles.grow}>
          <Text style={text.uiBaseSemi} numberOfLines={1}>{row.name}</Text>
          <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{[tierLine(row.tier, row.qualification), row.city].filter(Boolean).join(' · ')}</Text>
        </View>
        {row.verifiedInterview.verified && <Icon name="shield" size={spaceHalf['4.5']} tint={color.successFill} weight={2} />}
      </View>

      <View style={styles.field}>
        <EmLabel hint={`${notes.length} / ${cfg.noteMax}`}>Private note</EmLabel>
        <Input value={notes} onChangeText={setNotes} maxLength={cfg.noteMax} multiline textAlignVertical="top" placeholder="What stood out…" style={styles.area} />
      </View>

      <View style={styles.field}>
        <EmLabel>Tags</EmLabel>
        <View style={styles.tags}>
          {offered.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: has(t) }}
              onPress={() => toggle(t)}
              style={({ pressed }) => [styles.tag, has(t) ? styles.tagOn : styles.tagOff, pressed && styles.pressed]}
            >
              <Icon name="tag" size={space.md + 1} tint={has(t) ? color.accentText : color.textSecondary} weight={2} />
              <Text style={[text.uiSmMedium, { color: has(t) ? color.accentText : color.textSecondary }]}>{t}</Text>
            </Pressable>
          ))}
          {adding ? (
            <View style={[styles.tag, styles.tagNew]}>
              <TextInput
                autoFocus
                value={draftTag}
                onChangeText={setDraftTag}
                onSubmitEditing={addTag}
                onBlur={addTag}
                maxLength={cfg.tagMax}
                placeholder="Tag name"
                placeholderTextColor={color.textSubtle}
                returnKeyType="done"
                style={[text.uiSmMedium, styles.tagInput]}
              />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={({ pressed }) => [styles.tag, styles.tagNew, pressed && styles.pressed]}>
              <Icon name="plus" size={space.md + 1} tint={color.textMuted} weight={2} />
              <Text style={[text.uiSmMedium, styles.muted]}>New tag</Text>
            </Pressable>
          )}
        </View>
      </View>

      {(jobs.length > 0 || linked.length > 0) && (
        <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel="Link to a job post">
          <EmLabel hint="optional">Link to a job post</EmLabel>
          {[...jobs, ...linked].map((j) => <EmRadioRow key={j.id} label={j.title} on={jobId === j.id} onPress={() => setJobId(j.id)} />)}
          <EmRadioRow label="Not linked" on={!jobId} onPress={() => setJobId(null)} />
        </View>
      )}
    </EmSheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  cand: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.border },
  field: { gap: space.sm },
  area: { height: height['note-field'] + spaceHalf['4.5'], paddingTop: space.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  tag: { height: height.chip + 2, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  tagOn: { borderWidth: borderWidth.medium, borderColor: color.accent, backgroundColor: color.accentSoft },
  tagOff: { borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface },
  tagNew: { borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.borderStrong },
  tagInput: { minWidth: height['count-chip'] * 3, paddingVertical: 0, color: color.text },
  foot: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
