import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { EmSheet } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import {
  deleteSavedSearch, listSavedSearches, saveSearch, type CandidateFilters, type SavedSearch,
} from '../../lib/api/employerFeed'
import { filterCount, filterSummary } from '../../lib/employer/feedFilters'

/**
 * EM-12 · Saved searches, the sheet over the feed. Each row is a named filter
 * set: its name, the filters in one line, how many rows it sets (and IN USE
 * when it is what the feed is showing), Delete and Apply. The foot saves the
 * current filters under a name — a name used before is replaced, as the server
 * does it.
 */
export function SavedSearchesSheet({
  open, current, onClose, onApply,
}: {
  open: boolean
  /** What "Save" names: the feed's filters, or the draft handed over from the Filters sheet. */
  current: CandidateFilters
  onClose: () => void
  onApply: (search: SavedSearch) => void
}) {
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<SavedSearch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listSavedSearches())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your saved searches.')
    }
  }, [])

  useEffect(() => {
    if (open) {
      setName('')
      setSaveError(null)
      load()
    }
  }, [open, load])

  const empty = filterCount(current) === 0
  const trimmed = name.trim()

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const row = await saveSearch(trimmed, current)
      setRows((prev) => [row, ...(prev ?? []).filter((r) => r.id !== row.id && r.name !== row.name)])
      setName('')
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Not saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      await deleteSavedSearch(id)
      setRows((prev) => (prev ?? []).filter((r) => r.id !== id))
    } catch {
      /* the row stays; nothing changed */
    } finally {
      setBusyId(null)
    }
  }

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      tall
      title="Saved searches"
      sub="Apply one to reload its filters."
      foot={
        <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
          <View style={styles.saveRow}>
            <View style={styles.grow}>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={empty ? 'Set some filters first' : 'Name current filters'}
                editable={!empty}
                maxLength={80}
                returnKeyType="done"
              />
            </View>
            <Button variant="secondary" size="block" label="Save" busy={saving} disabled={empty || trimmed.length < 2} onPress={() => { save() }} />
          </View>
          {!!saveError && <Text style={[text.uiXs, styles.danger]}>{saveError}</Text>}
        </View>
      }
    >
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={[text.uiMd, styles.muted]}>{error}</Text>
          <Button variant="outline" size="sm" label="Try again" onPress={() => { load() }} />
        </View>
      ) : rows!.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[text.uiMd, styles.muted]}>No saved searches yet. Set filters, then name them below.</Text>
        </View>
      ) : (
        rows!.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={text.uiBaseSemi}>{r.name}</Text>
            {!!filterSummary(r.filters) && <Text style={[text.uiXs, styles.muted]}>{filterSummary(r.filters)}</Text>}
            <View style={styles.rowFoot}>
              <Text style={[text.metaSm, styles.subtle, styles.mono]}>
                {`${r.count} ${r.count === 1 ? 'FILTER' : 'FILTERS'}${r.inUse ? ' · IN USE' : ''}`}
              </Text>
              <View style={styles.actions}>
                <Button variant="dangerText" size="sm" label="Delete" busy={busyId === r.id} onPress={() => { remove(r.id) }} />
                <Button variant="outline" size="sm" label="Apply" onPress={() => onApply(r)} style={styles.slim} />
              </View>
            </View>
          </View>
        ))
      )}
    </EmSheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  slim: { paddingHorizontal: spaceHalf['3.5'] },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space.xl },
  empty: { paddingVertical: space.lg, gap: space.md, alignItems: 'flex-start' },
  row: { borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.panel, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], gap: space.sm },
  rowFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  foot: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.background },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
