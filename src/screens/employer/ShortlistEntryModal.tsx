import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { borderWidth, color, container, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmIconButton, EmSheet } from '../../components/employer/em'
import { Face, StudioChip, StudioLabel } from '../../components/employer/studio'
import { ApiClientError } from '../../lib/api'
import { updateShortlistEntry, type EmployerJobRef, type ShortlistRow } from '../../lib/api/employerShortlist'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'

export interface ShortlistEntryUpdate {
  id: string
  notes: string | null
  tags: string[]
  jobId: string | null
}

/**
 * EM-15 · Notes, tags and job (Studio S2) — a sheet over the shortlist. The
 * private note with its server limit, the entry's tags as removable chips plus
 * an input (the company's other tags are offered while typing), and the one
 * job post the candidate is linked to, as radio rows. Private to the company;
 * the candidate never sees it. Limits are the server's (note length, tag count,
 * tag length).
 */
export function ShortlistEntrySheet({
  open, row, knownTags, jobs, onClose, onSaved,
}: {
  open: boolean
  row: ShortlistRow | null
  /** Every tag the company already uses, offered while a tag is being typed. */
  knownTags: string[]
  /** The linkable jobs (live or paused). */
  jobs: EmployerJobRef[]
  onClose: () => void
  onSaved: (u: ShortlistEntryUpdate) => void
}) {
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
  // The company's other tags, narrowed by what is being typed.
  const draft = draftTag.trim().toLowerCase()
  const offered = adding
    ? [...new Map(knownTags.map((t) => [t.toLowerCase(), t])).values()]
      .filter((t) => !has(t) && (!draft || t.toLowerCase().includes(draft)))
      .sort((a, b) => a.localeCompare(b))
    : []

  async function save() {
    if (!row) return
    setSaving(true)
    setError(null)
    // A tag still being typed when Save is pressed goes with the rest.
    const pending = adding ? draftTag.trim().slice(0, cfg.tagMax) : ''
    const nextTags = pending && !has(pending) && tags.length < cfg.tagsMax ? [...tags, pending] : tags
    try {
      const res = await updateShortlistEntry(row.id, { notes: notes.trim(), tags: nextTags, jobId })
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
  const choices: { id: string | null; title: string }[] = [...jobs, ...linked, { id: null, title: 'Not linked' }]

  return (
    <EmSheet open={open} onClose={onClose} tall scroll={false}>
      <View style={styles.head}>
        <Face name={row.name} photo={row.photoUrl} size={height['chip-lg']} />
        <View style={styles.grow}>
          <Text style={text.displayXs} numberOfLines={1} accessibilityRole="header">Notes, tags and job</Text>
          <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{row.name}</Text>
        </View>
        <EmIconButton name="x" label="Close" size={height['control-xs']} tint={color.textSecondary} onPress={onClose} />
      </View>

      <ScrollView
        style={styles.grow}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <StudioLabel>Note · only your team sees it</StudioLabel>
          <View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              maxLength={cfg.noteMax}
              multiline
              textAlignVertical="top"
              placeholder="What stood out…"
              placeholderTextColor={color.textSubtle}
              accessibilityLabel="Note, only your team sees it"
              style={[text.uiMd, styles.note]}
            />
            <Text style={[text.metaSm, styles.count]} accessibilityLabel={`${notes.length} of ${cfg.noteMax} characters`}>
              {`${notes.length} / ${cfg.noteMax}`}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <StudioLabel>Tags</StudioLabel>
          <View style={styles.tags}>
            {tags.map((t) => <StudioChip key={t.toLowerCase()} label={t} on onRemove={() => toggle(t)} />)}
            {adding ? (
              <View style={styles.tagInputChip}>
                <Icon name="plus" size={space.md} tint={color.textMuted} />
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
                  accessibilityLabel="Tag name"
                  style={[text.uiSmMedium, styles.tagInput]}
                />
              </View>
            ) : (
              <StudioChip label="Tag name" icon="plus" dashed onPress={() => setAdding(true)} />
            )}
          </View>
          {offered.length > 0 && (
            <View style={styles.tags}>
              {offered.map((t) => <StudioChip key={t.toLowerCase()} label={t} icon="tag" onPress={() => { toggle(t); setDraftTag('') }} />)}
            </View>
          )}
        </View>

        {(jobs.length > 0 || linked.length > 0) && (
          <View style={styles.section}>
            <StudioLabel>Job</StudioLabel>
            <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Link to a job post">
              {choices.map((j, i) => {
                const on = jobId === j.id
                return (
                  <Pressable
                    key={j.id ?? 'none'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setJobId(j.id)}
                    style={({ pressed }) => [styles.radio, i > 0 && styles.radioRule, pressed && styles.pressed]}
                  >
                    <View style={[styles.ring, on ? styles.ringOn : styles.ringOff]} />
                    <Text style={[text.uiMd, styles.grow]} numberOfLines={1}>{j.title}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.foot}>
          {!!error && <Text style={[text.uiSm, styles.danger]} accessibilityLiveRegion="polite">{error}</Text>}
          <Button variant="secondary" size="cta" full label="Save" busy={saving} onPress={() => { save() }} />
        </View>
      </ScrollView>
    </EmSheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: spaceHalf['1.5'], paddingBottom: space.xs },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: spaceHalf['3.5'] },
  section: { gap: space.sm },

  note: { minHeight: height['note-field'] + space.xl, paddingTop: spaceHalf['2.5'], paddingHorizontal: space.md, paddingBottom: spaceHalf['6'], borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, color: color.text },
  count: { position: 'absolute', right: spaceHalf['2.5'], bottom: space.sm },

  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spaceHalf['1.5'] },
  tagInputChip: { height: height['chip-sm'], paddingLeft: space.md, paddingRight: space.sm, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderStyle: 'dashed', borderColor: color.accent, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  tagInput: { minWidth: container['label-min'], paddingVertical: 0, color: color.text },

  group: { borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.border, overflow: 'hidden' },
  radio: { minHeight: height['control-md'], flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: spaceHalf['3.5'] },
  radioRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  ring: { width: space.xl, height: space.xl, borderRadius: radius.pill },
  ringOn: { borderWidth: spaceHalf['1.5'], borderColor: color.accent },
  ringOff: { borderWidth: borderWidth.accent, borderColor: color.borderStrong },

  foot: { gap: space.sm, paddingTop: space['2xs'] },
})
