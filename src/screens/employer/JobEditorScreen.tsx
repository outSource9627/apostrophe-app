import React, { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  createEmployerJob,
  submitEmployerJob,
  type JobDraftInput,
} from '../../lib/api/employerJobs'
import type { RootStackParamList } from '../../../App'

export function JobEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Engineering')
  const [vacancies, setVacancies] = useState('1')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [salaryMinLpa, setSalaryMinLpa] = useState('6')
  const [salaryMaxLpa, setSalaryMaxLpa] = useState('12')
  const [description, setDescription] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (submitForReview: boolean) => {
    try {
      setSaving(true)
      setError(null)

      if (title.trim().length < 3) {
        setError('Role title must be at least 3 characters.')
        return
      }
      if (description.trim().length < 30) {
        setError('Description must be at least 30 characters.')
        return
      }

      const minPaise = Math.round(parseFloat(salaryMinLpa || '0') * 100000 * 100)
      const maxPaise = Math.round(parseFloat(salaryMaxLpa || '0') * 100000 * 100)

      const payload: JobDraftInput = {
        title: title.trim(),
        category,
        vacancies: parseInt(vacancies || '1', 10),
        description: description.trim(),
        responsibilities: ['Build robust features', 'Collaborate across team'],
        requirements: ['Relevant experience in domain', 'Problem solving ability'],
        benefits: ['Competitive compensation', 'Growth opportunities'],
        minQualification: 'BTECH',
        experienceMinYears: 0,
        experienceMaxYears: 3,
        salaryMinPaise: minPaise,
        salaryMaxPaise: maxPaise,
        location: location.trim() || (remote ? 'Remote' : 'India'),
        remote,
        employmentType: 'FULL_TIME',
      }

      const job = await createEmployerJob(payload)

      if (submitForReview) {
        await submitEmployerJob(job.id)
      }

      navigation.goBack()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save job.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <EmployerShell
      back={{ label: 'JOBS', onPress: () => navigation.goBack() }}
      footer={
        <View style={styles.footRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSave(false)}
            disabled={saving}
            style={styles.draftBtn}
          >
            <Text style={styles.draftBtnText}>Save draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSave(true)}
            disabled={saving}
            style={[styles.submitBtn, saving && styles.btnDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={color.textInverse} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit for review</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Post a Job</Text>
          <Text style={styles.subtitle}>
            New postings are reviewed within 12 hours before going live to verified students.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Role Title */}
        <View style={styles.field}>
          <Text style={styles.label}>ROLE TITLE *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Frontend Engineer, Product Designer"
            placeholderTextColor={color.textMuted}
            style={styles.input}
          />
        </View>

        {/* Category & Vacancies */}
        <View style={styles.rowFields}>
          <View style={[styles.field, { flex: 2 }]}>
            <Text style={styles.label}>CATEGORY</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Engineering, Design"
              placeholderTextColor={color.textMuted}
              style={styles.input}
            />
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>VACANCIES</Text>
            <TextInput
              value={vacancies}
              onChangeText={setVacancies}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </View>

        {/* Location & Remote */}
        <View style={styles.field}>
          <Text style={styles.label}>OFFICE LOCATION</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Bangalore, Mumbai"
            placeholderTextColor={color.textMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchTitle}>Remote friendly</Text>
            <Text style={styles.switchBody}>Accept applications from anywhere</Text>
          </View>
          <Switch
            value={remote}
            onValueChange={setRemote}
            trackColor={{ false: color.border, true: color.text }}
          />
        </View>

        {/* Compensation (LPA) */}
        <View style={styles.rowFields}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>MIN SALARY (₹ LPA)</Text>
            <TextInput
              value={salaryMinLpa}
              onChangeText={setSalaryMinLpa}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>MAX SALARY (₹ LPA)</Text>
            <TextInput
              value={salaryMaxLpa}
              onChangeText={setSalaryMaxLpa}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>ROLE DESCRIPTION *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            placeholder="Describe the mission, key responsibilities, and qualifications required…"
            placeholderTextColor={color.textMuted}
            style={styles.textArea}
          />
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
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    gap: 4,
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: color.text,
  },
  subtitle: {
    fontSize: 12,
    color: color.textMuted,
    lineHeight: 16,
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
  field: {
    gap: 4,
  },
  rowFields: {
    flexDirection: 'row',
    gap: space.sm,
  },
  label: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.textSubtle,
  },
  input: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    fontSize: 14,
    color: color.text,
  },
  textArea: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.sm,
    fontSize: 14,
    color: color.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.sm,
  },
  switchInfo: {
    gap: 2,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  switchBody: {
    fontSize: 11,
    color: color.textMuted,
  },
  footRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  draftBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: {
    color: color.text,
    fontSize: 14,
    fontWeight: '500',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: color.text,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: color.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
})
