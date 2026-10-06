import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, opacity, space, spaceHalf, trackingNative } from '../../theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmSheet } from '../../components/employer/em'
import { StudioChip } from '../../components/employer/studio'
import { fetchMatchCount, type CandidateFilters, type CandidateMatchCount } from '../../lib/api/employerFeed'
import { getConfig, type AppConfig } from '../../lib/api/config'
import {
  EXPERIENCE_FLOORS, SALARY_BANDS, bandFilters, bandLabel, bandOf, filterCount, filterOptions, normalize, rowLabel,
} from '../../lib/employer/feedFilters'

/**
 * EM-11 · Filters, the bottom sheet over the feed (Studio · F7: mono group
 * labels, violet chips with a check when on, the live count on the Show button
 * and the narrowest filter called out above it). Ten groups of chips in the
 * design's order; several values in one group are any-of, groups AND together.
 * The count under the title is the server's (GET /employers/feed/match-count,
 * free) for the draft as it stands. Show saves the whole sheet on the server,
 * so the filters stay on until cleared — on this phone and on the web.
 *
 * The long lists (field of study, skills, cities, languages) come from the
 * server's master data: what is chosen shows first, then the first few of the
 * rest, and a search finds any other.
 */
export function FeedFiltersSheet({
  open, applied, onClose, onApply, onSaveAs,
}: {
  open: boolean
  applied: CandidateFilters
  onClose: () => void
  onApply: (next: CandidateFilters) => void
  onSaveAs: (draft: CandidateFilters) => void
}) {
  const [draft, setDraft] = useState<CandidateFilters>(applied)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [matches, setMatches] = useState<CandidateMatchCount | null>(null)
  const insets = useSafeAreaInsets()

  // A fresh draft each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(applied)
  }, [open, applied])

  useEffect(() => {
    let alive = true
    getConfig().then((c) => alive && setConfig(c)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // The live count, debounced so a run of taps asks once.
  const key = JSON.stringify(normalize(draft))
  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      fetchMatchCount(normalize(draft))
        .then((r) => alive && setMatches(r))
        .catch(() => alive && setMatches(null))
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // `key` is the draft's canonical form; the draft object itself changes identity on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  const o = useMemo(() => filterOptions(config), [config])
  const n = normalize(draft)
  const set = (patch: Partial<CandidateFilters>) => setDraft((d) => normalize({ ...d, ...patch }))
  const toggle = <T extends string | number>(list: T[] | undefined, v: T): T[] =>
    list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v].slice(0, o.listMax)
  const band = bandOf(n)

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      tall
      foot={
        <View style={[styles.footWrap, { paddingBottom: space.md + insets.bottom }]}>
          {!!matches?.narrowest && matches.narrowest.matchesWithout > (matches.matches ?? 0) && (
            <View style={styles.narrow}>
              <Icon name="alert" size={space.md + 2} tint={color.warning} />
              <Text style={[text.uiXs, styles.muted, styles.grow]} numberOfLines={2}>
                <Text style={styles.strong}>{rowLabel(matches.narrowest.key)}</Text>
                {` is your narrowest filter · ${(matches.narrowest.matchesWithout - matches.matches).toLocaleString('en-IN')} more without it`}
              </Text>
            </View>
          )}
          <View style={styles.foot}>
            <Button variant="outline" size="md" icon="bookmark" label="Save" onPress={() => onSaveAs(n)} />
            <Button
              variant="primary"
              size="md"
              label={matches === null ? 'Show' : `Show ${matches.matches.toLocaleString('en-IN')} ${matches.matches === 1 ? 'candidate' : 'candidates'}`}
              onPress={() => onApply(n)}
              style={styles.grow}
            />
          </View>
          <Text style={[text.uiXs, styles.subtle, styles.note]}>Filters stay on until cleared, across sessions.</Text>
        </View>
      }
    >
      <View style={styles.head}>
        <Text style={[text.displayCard, styles.grow]} accessibilityRole="header">Filters</Text>
        <Pressable accessibilityRole="button" disabled={filterCount(n) === 0} onPress={() => setDraft({})} hitSlop={space.sm} style={({ pressed }) => [pressed && styles.pressed, filterCount(n) === 0 && styles.off]}>
          <Text style={[text.uiMdSemi, styles.accent]}>Clear all</Text>
        </Pressable>
      </View>

      <Group title={rowLabel('tier')}>
        {o.tiers.map((t) => <Pick key={t.value} label={t.label} on={!!n.tiers?.includes(t.value)} onPress={() => set({ tiers: toggle(n.tiers, t.value) })} />)}
      </Group>

      <ListGroup title={rowLabel('fieldOfStudy')} noun="field" all={o.domains} chosen={n.domains} onChange={(domains) => set({ domains })} />
      <ListGroup title={rowLabel('skills')} noun="skill" all={o.skills} chosen={n.skills} onChange={(skills) => set({ skills })} />

      <ListGroup title={rowLabel('location')} noun="city" all={o.cities} chosen={n.cities} onChange={(cities) => set({ cities })}>
        {o.locationModes
          .filter((m) => m.value !== 'LIVES' || (n.cities?.length ?? 0) > 0)
          .map((m) => (
            <Pick
              key={m.value}
              label={m.label}
              on={!!n.locationModes?.includes(m.value)}
              onPress={() => set({ locationModes: toggle(n.locationModes, m.value) })}
            />
          ))}
      </ListGroup>

      <Group title={rowLabel('experience')}>
        {EXPERIENCE_FLOORS.map((y) => (
          <Pick key={y} label={`${y}+ yrs`} on={n.minExperienceYears === y} onPress={() => set({ minExperienceYears: n.minExperienceYears === y ? undefined : y })} />
        ))}
      </Group>

      <Group title={rowLabel('salary')}>
        {SALARY_BANDS.map((b) => (
          <Pick
            key={b.key}
            label={bandLabel(b)}
            on={band?.key === b.key}
            onPress={() => set(band?.key === b.key ? { minExpectedSalaryPaise: undefined, maxExpectedSalaryPaise: undefined } : bandFilters(b))}
          />
        ))}
      </Group>

      <ListGroup title={rowLabel('languages')} noun="language" all={o.languages} chosen={n.languages} onChange={(languages) => set({ languages })} />

      <Group title={rowLabel('availability')} hint="Joins within">
        {o.availability.map((a) => (
          <Pick key={a.value} label={a.label} on={n.joinsWithin === a.value} onPress={() => set({ joinsWithin: n.joinsWithin === a.value ? undefined : a.value })} />
        ))}
      </Group>

      <Group title={rowLabel('employmentType')}>
        {o.employmentTypes.map((t) => (
          <Pick key={t.value} label={t.label} on={!!n.employmentTypes?.includes(t.value)} onPress={() => set({ employmentTypes: toggle(n.employmentTypes, t.value) })} />
        ))}
      </Group>

      <Group title={rowLabel('recency')}>
        {o.recency.map((r) => (
          <Pick
            key={r.value}
            label={r.label}
            on={n.interviewedWithinDays === r.value}
            onPress={() => set({ interviewedWithinDays: n.interviewedWithinDays === r.value ? undefined : r.value })}
          />
        ))}
      </Group>
    </EmSheet>
  )
}

/** A filter value: violet with a check when chosen, white when not. */
function Pick({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <StudioChip label={label} on={on} icon={on ? 'check' : undefined} onPress={onPress} />
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={[text.metaSm, styles.mono, styles.muted]}>{title}</Text>
        {!!hint && <Text style={[text.uiXs, styles.subtle]}>{hint}</Text>}
      </View>
      <View style={styles.chips}>{children}</View>
    </View>
  )
}

const SHOWN = 8

/**
 * A master-data list: what is chosen first, then the first few of the rest.
 * A search box appears once the list is longer than that, and finds any value.
 */
function ListGroup({
  title, noun, all, chosen = [], onChange, children,
}: { title: string; noun: string; all: string[]; chosen?: string[]; onChange: (next: string[]) => void; children?: React.ReactNode }) {
  const [q, setQ] = useState('')
  const lower = chosen.map((c) => c.toLowerCase())
  const rest = all.filter((v) => !lower.includes(v.toLowerCase()))
  const needle = q.trim().toLowerCase()
  const shown = (needle ? rest.filter((v) => v.toLowerCase().includes(needle)) : rest).slice(0, SHOWN)
  if (all.length === 0 && chosen.length === 0 && !children) return null
  return (
    <View style={styles.group}>
      <Text style={[text.metaSm, styles.mono, styles.muted]}>{title}</Text>
      {all.length > SHOWN && (
        <Input value={q} onChangeText={setQ} placeholder={`Find a ${noun}`} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      )}
      <View style={styles.chips}>
        {chosen.map((v) => <Pick key={`on-${v}`} label={v} on onPress={() => onChange(chosen.filter((c) => c !== v))} />)}
        {shown.map((v) => <Pick key={v} label={v} on={false} onPress={() => onChange([...chosen, v])} />)}
        {children}
      </View>
      {!!needle && shown.length === 0 && <Text style={[text.uiXs, styles.subtle]}>{`No ${noun} matches “${q.trim()}”.`}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  subtle: { color: color.textSubtle },
  muted: { color: color.textMuted },
  accent: { color: color.accent },
  strong: { color: color.text, fontFamily: text.uiXsSemi.fontFamily },
  mono: { letterSpacing: trackingNative.eyebrow },
  pressed: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  narrow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  group: { gap: spaceHalf['2.5'] },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  footWrap: { backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  note: { paddingHorizontal: space.lg, paddingTop: space.sm },
})
