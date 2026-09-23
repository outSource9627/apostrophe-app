import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import { Banner, Body, Button, Card, Chip, Display, Divider, Field, Input } from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  updateShortlistEntry,
  removeFromShortlist,
} from '../../lib/api/employerShortlist'
import type { RootStackParamList } from '../../../App'

export function ShortlistEntryModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'ShortlistEntry'>>()
  const { row, jobs } = route.params

  const [notes, setNotes] = useState(row.notes || '')
  const [tags, setTags] = useState<string[]>(row.tags || [])
  const [newTag, setNewTag] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string>(row.job?.id || '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase()
    if (!trimmed) return
    if (tags.length >= 20) {
      setError('Maximum 20 tags permitted.')
      return
    }
    if (trimmed.length > 40) {
      setError('Tag cannot exceed 40 characters.')
      return
    }
    if (!tags.some((t) => t.toLowerCase() === trimmed)) {
      setTags([...tags, newTag.trim()])
    }
    setNewTag('')
    setError(null)
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      await updateShortlistEntry(row.id, {
        notes: notes.trim() || undefined,
        tags,
        jobId: selectedJobId ? selectedJobId : null,
      })
      navigation.goBack()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update shortlist entry.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = () => {
    Alert.alert(
      'Remove from shortlist',
      `Are you sure you want to remove ${row.name} from your shortlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(true)
              await removeFromShortlist(row.id)
              navigation.goBack()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to remove from shortlist.')
            } finally {
              setRemoving(false)
            }
          },
        },
      ],
    )
  }

  return (
    <EmployerShell
      back={{ label: 'SHORTLIST', onPress: () => navigation.goBack() }}
      footer={
        <View style={styles.footRow}>
          <Button
            variant="primary"
            size="block"
            full
            busy={saving}
            disabled={saving || removing}
            label="Save changes"
            onPress={handleSave}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Candidate Info Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Display level="sm">{row.name}</Display>
            <Body size="sm" tone="muted">
              {row.available
                ? [row.candidate?.qualification, row.candidate?.city].filter(Boolean).join(' · ')
                : 'Profile unavailable'}
            </Body>
          </View>
          <Button
            variant="destructive"
            size="sm"
            busy={removing}
            disabled={removing}
            label="Remove"
            onPress={handleRemove}
          />
        </View>
        <Divider />

        {!!error && <Banner tone="danger">{error}</Banner>}

        <Card style={styles.card}>
          {/* Private Notes */}
          <Field label="Private notes" helper={`${notes.length}/2000 characters`}>
            <Input
              value={notes}
              onChangeText={setNotes}
              maxLength={2000}
              multiline
              numberOfLines={4}
              placeholder="Add private evaluation notes or interview remarks…"
            />
          </Field>
          {!!row.notesUpdatedAt && (
            <Body size="xs" tone="subtle">
              {`Last edited ${new Date(row.notesUpdatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
            </Body>
          )}

          <Divider />

          {/* Tags */}
          <Field label={`Tags (${tags.length}/20)`}>
            <View style={styles.chipWrap}>
              {tags.map((t) => (
                <Chip key={t} label={`#${t}  ✕`} selected onPress={() => handleRemoveTag(t)} />
              ))}
              {tags.length === 0 && (
                <Body size="sm" tone="subtle">
                  No tags assigned yet.
                </Body>
              )}
            </View>
            <View style={styles.tagInputRow}>
              <Input
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={handleAddTag}
                placeholder="Add tag (e.g. backend, priority)…"
                maxLength={40}
                style={styles.grow}
              />
              <Button variant="outline" size="md" label="Add" onPress={handleAddTag} />
            </View>
          </Field>

          <Divider />

          {/* Job Association */}
          <Field label="Link to job opening">
            <View style={styles.chipWrap}>
              <Chip label="No job linked" selected={!selectedJobId} onPress={() => setSelectedJobId('')} />
              {jobs.map((job) => (
                <Chip
                  key={job.id}
                  label={`${job.title} (${job.location || 'Remote'})`}
                  selected={selectedJobId === job.id}
                  onPress={() => setSelectedJobId(job.id)}
                />
              ))}
            </View>
          </Field>
        </Card>
      </ScrollView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.sm,
    paddingBottom: space.xl,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  card: {
    padding: space.xl,
    gap: space.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  footRow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
})
