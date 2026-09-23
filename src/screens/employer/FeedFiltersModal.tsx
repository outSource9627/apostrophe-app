import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import { Banner, Body, Button, Card, Chip, Display, Divider, Field, Input } from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { saveSearch } from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

const AVAILABILITY_OPTIONS = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'FIFTEEN_DAYS', label: '15 days' },
  { value: 'THIRTY_DAYS', label: '30 days' },
  { value: 'MORE_THAN_MONTH', label: '1+ month' },
]

export function FeedFiltersModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [city, setCity] = useState('')
  const [skill, setSkill] = useState('')
  const [availability, setAvailability] = useState('')
  const [minExp, setMinExp] = useState('')
  const [maxSalaryLakh, setMaxSalaryLakh] = useState('')
  const [searchName, setSearchName] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleApply = () => {
    navigation.navigate('EmployerFeed')
  }

  const handleSaveSearch = async () => {
    if (!searchName.trim()) return
    try {
      setSaving(true)
      setSaveError(null)
      await saveSearch(searchName.trim(), {
        city: city.trim() || undefined,
        skill: skill.trim() || undefined,
        availability: availability || undefined,
        minExperienceYears: minExp ? Number(minExp) : undefined,
        maxExpectedSalaryPaise: maxSalaryLakh ? Number(maxSalaryLakh) * 10000000 : undefined,
      })
      setSavedSuccess(true)
      setSearchName('')
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this search. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const footActions = (
    <View style={styles.footRow}>
      <Button
        variant="outline"
        size="block"
        label="Clear"
        style={styles.grow}
        onPress={() => {
          setCity('')
          setSkill('')
          setAvailability('')
          setMinExp('')
          setMaxSalaryLakh('')
        }}
      />
      <Button
        variant="primary"
        size="block"
        label="Show candidates"
        style={styles.grow}
        onPress={handleApply}
      />
    </View>
  )

  return (
    <EmployerShell
      back={{ label: 'FEED', onPress: () => navigation.goBack() }}
      footer={footActions}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Display level="sm">Filter candidate feed</Display>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('SavedSearches')}
          >
            <Body size="sm" weight="medium">
              Saved searches →
            </Body>
          </Pressable>
        </View>
        <Divider />

        {/* City */}
        <Field label="City">
          <Input
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bengaluru, Mumbai"
          />
        </Field>

        {/* Skill */}
        <Field label="Key skill">
          <Input
            value={skill}
            onChangeText={setSkill}
            placeholder="e.g. Python, React"
          />
        </Field>

        {/* Availability */}
        <Field label="Availability">
          <View style={styles.chipWrap}>
            {AVAILABILITY_OPTIONS.map((opt) => {
              const active = availability === opt.value
              return (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={active}
                  onPress={() => setAvailability(active ? '' : opt.value)}
                />
              )
            })}
          </View>
        </Field>

        {/* Minimum Experience */}
        <Field label="Minimum experience (years)">
          <Input
            value={minExp}
            onChangeText={setMinExp}
            keyboardType="numeric"
            placeholder="e.g. 2"
          />
        </Field>

        {/* Maximum Salary */}
        <Field label="Max expected salary (lakh / yr)">
          <Input
            value={maxSalaryLakh}
            onChangeText={setMaxSalaryLakh}
            keyboardType="numeric"
            placeholder="e.g. 15"
          />
        </Field>

        {/* Save Search Section */}
        <Card style={styles.saveCard}>
          <Display level="xs">Save this search</Display>
          <View style={styles.saveRow}>
            <Input
              value={searchName}
              onChangeText={setSearchName}
              placeholder="Search name"
              style={styles.grow}
            />
            <Button
              variant="secondary"
              size="lg"
              label="Save"
              busy={saving}
              onPress={handleSaveSearch}
            />
          </View>
          {!!saveError && <Banner tone="danger">{saveError}</Banner>}
          {savedSuccess && <Banner tone="success">Search saved successfully!</Banner>}
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
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  grow: {
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  saveCard: {
    padding: space.lg,
    gap: space.sm,
    marginTop: space.sm,
  },
  saveRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  footRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
})
