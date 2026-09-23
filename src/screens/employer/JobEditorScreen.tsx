import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space } from '../../theme'
import { Banner, Body, Button, Card, Display, Field, Input, Toggle } from '../../components/ui'
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
          <Button
            variant="outline"
            size="lg"
            label="Save draft"
            disabled={saving}
            onPress={() => handleSave(false)}
            style={styles.draftBtn}
          />
          <Button
            variant="primary"
            size="lg"
            label="Submit for review"
            busy={saving}
            disabled={saving}
            onPress={() => handleSave(true)}
            style={styles.submitBtn}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Display level="lg" accessibilityRole="header">
          Post a Job
        </Display>
        <Body size="xs" tone="muted">
          New postings are reviewed within 12 hours before going live to verified students.
        </Body>
      </View>

      {!!error && <Banner tone="danger">{error}</Banner>}

      <Card style={styles.card}>
        <Field label="Role title *">
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Frontend Engineer, Product Designer"
          />
        </Field>

        <View style={styles.row}>
          <View style={styles.flex2}>
            <Field label="Category">
              <Input
                value={category}
                onChangeText={setCategory}
                placeholder="e.g. Engineering, Design"
              />
            </Field>
          </View>

          <View style={styles.flex1}>
            <Field label="Vacancies">
              <Input value={vacancies} onChangeText={setVacancies} keyboardType="number-pad" />
            </Field>
          </View>
        </View>

        <Field label="Office location">
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Bangalore, Mumbai"
          />
        </Field>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Body size="sm" weight="medium">
              Remote friendly
            </Body>
            <Body size="xs" tone="muted">
              Accept applications from anywhere
            </Body>
          </View>
          <Toggle on={remote} onChange={setRemote} label="Remote friendly" />
        </View>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Field label="Min salary (₹ LPA)">
              <Input value={salaryMinLpa} onChangeText={setSalaryMinLpa} keyboardType="decimal-pad" />
            </Field>
          </View>

          <View style={styles.flex1}>
            <Field label="Max salary (₹ LPA)">
              <Input value={salaryMaxLpa} onChangeText={setSalaryMaxLpa} keyboardType="decimal-pad" />
            </Field>
          </View>
        </View>

        <Field label="Role description *">
          <Input
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            placeholder="Describe the mission, key responsibilities, and qualifications required…"
            style={styles.textArea}
          />
        </Field>
      </Card>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  card: { padding: space.xl, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.lg,
  },
  toggleInfo: { flex: 1, gap: space['2xs'] },
  textArea: { minHeight: 120, paddingTop: space.md, textAlignVertical: 'top' },
  footRow: { flexDirection: 'row', gap: space.md },
  draftBtn: { flex: 1 },
  submitBtn: { flex: 2 },
})
