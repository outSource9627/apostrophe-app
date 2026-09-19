import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  updateShortlistEntry,
  removeFromShortlist,
  type ShortlistRow,
  type EmployerJobRef,
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving || removing}
            style={[styles.saveBtn, (saving || removing) && styles.btnDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={color.textInverse} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Candidate Info Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.subtitle}>
              {row.available
                ? [row.candidate?.qualification, row.candidate?.city].filter(Boolean).join(' · ')
                : 'Profile unavailable'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleRemove}
            disabled={removing}
            style={styles.removeBtn}
          >
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Private Notes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PRIVATE NOTES</Text>
            <Text style={styles.counter}>{notes.length}/2000</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            maxLength={2000}
            multiline
            numberOfLines={4}
            placeholder="Add private evaluation notes or interview remarks…"
            placeholderTextColor={color.textMuted}
            style={styles.textArea}
          />
          {row.notesUpdatedAt && (
            <Text style={styles.editedDate}>
              Last edited {new Date(row.notesUpdatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Text>
          )}
        </View>

        {/* Tags Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TAGS ({tags.length}/20)</Text>
          </View>
          <View style={styles.tagWrap}>
            {tags.map((t) => (
              <View key={t} style={styles.tagPill}>
                <Text style={styles.tagPillText}>#{t}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                  <Text style={styles.tagPillClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {tags.length === 0 && (
              <Text style={styles.emptyNotice}>No tags assigned yet.</Text>
            )}
          </View>
          <View style={styles.tagInputRow}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              onSubmitEditing={handleAddTag}
              placeholder="Add tag (e.g. backend, priority)…"
              placeholderTextColor={color.textMuted}
              maxLength={40}
              style={styles.tagInput}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddTag}
              style={styles.addTagBtn}
            >
              <Text style={styles.addTagBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Job Association Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LINK TO JOB OPENING</Text>
          <View style={styles.jobList}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedJobId('')}
              style={[styles.jobOption, !selectedJobId && styles.jobOptionActive]}
            >
              <Text style={[styles.jobOptionText, !selectedJobId && styles.jobOptionTextActive]}>
                No job linked
              </Text>
            </TouchableOpacity>
            {jobs.map((job) => {
              const active = selectedJobId === job.id
              return (
                <TouchableOpacity
                  key={job.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedJobId(job.id)}
                  style={[styles.jobOption, active && styles.jobOptionActive]}
                >
                  <Text style={[styles.jobOptionText, active && styles.jobOptionTextActive]}>
                    {job.title} ({job.location || 'Remote'})
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamilyNative.display,
    fontSize: 20,
    color: color.text,
  },
  subtitle: {
    fontSize: 13,
    color: color.textMuted,
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeBtnText: {
    fontSize: 13,
    color: color.danger,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    padding: space.sm,
  },
  errorText: {
    fontSize: 12,
    color: color.danger,
  },
  section: {
    gap: space.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.textSubtle,
  },
  counter: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textMuted,
  },
  textArea: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    fontSize: 14,
    color: color.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editedDate: {
    fontSize: 11,
    color: color.textMuted,
    marginTop: 2,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagPillText: {
    fontSize: 12,
    color: color.text,
    fontWeight: '500',
  },
  tagPillClose: {
    fontSize: 10,
    color: color.textSubtle,
    marginLeft: 2,
  },
  emptyNotice: {
    fontSize: 12,
    color: color.textMuted,
    fontStyle: 'italic',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagInput: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    fontSize: 13,
    color: color.text,
  },
  addTagBtn: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  jobList: {
    gap: 6,
    marginTop: 4,
  },
  jobOption: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
  },
  jobOptionActive: {
    borderColor: color.text,
    backgroundColor: color.surfaceMuted,
  },
  jobOptionText: {
    fontSize: 13,
    color: color.textMuted,
  },
  jobOptionTextActive: {
    color: color.text,
    fontWeight: '600',
  },
  footRow: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  saveBtn: {
    backgroundColor: color.text,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: color.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
})
