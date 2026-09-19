import React, { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
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

  const handleApply = () => {
    navigation.navigate('EmployerFeed')
  }

  const handleSaveSearch = async () => {
    if (!searchName.trim()) return
    try {
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
    } catch {
      // Ignored
    }
  }

  const footActions = (
    <View style={styles.footRow}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setCity('')
          setSkill('')
          setAvailability('')
          setMinExp('')
          setMaxSalaryLakh('')
        }}
        style={styles.clearBtn}
      >
        <Text style={styles.clearBtnText}>Clear</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleApply}
        style={styles.applyBtn}
      >
        <Text style={styles.applyBtnText}>Show candidates</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <EmployerShell
      back={{ label: 'FEED', onPress: () => navigation.goBack() }}
      footer={footActions}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Filter candidate feed</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SavedSearches')}
          >
            <Text style={styles.savedLink}>Saved searches →</Text>
          </TouchableOpacity>
        </View>

        {/* City */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CITY</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bengaluru, Mumbai"
            placeholderTextColor={color.textSubtle}
            style={styles.input}
          />
        </View>

        {/* Skill */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>KEY SKILL</Text>
          <TextInput
            value={skill}
            onChangeText={setSkill}
            placeholder="e.g. Python, React"
            placeholderTextColor={color.textSubtle}
            style={styles.input}
          />
        </View>

        {/* Availability */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>AVAILABILITY</Text>
          <View style={styles.chipsRow}>
            {AVAILABILITY_OPTIONS.map((opt) => {
              const active = availability === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.8}
                  onPress={() => setAvailability(active ? '' : opt.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Minimum Experience */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>MINIMUM EXPERIENCE (YEARS)</Text>
          <TextInput
            value={minExp}
            onChangeText={setMinExp}
            keyboardType="numeric"
            placeholder="e.g. 2"
            placeholderTextColor={color.textSubtle}
            style={styles.input}
          />
        </View>

        {/* Maximum Salary */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>MAX EXPECTED SALARY (LAKH / YR)</Text>
          <TextInput
            value={maxSalaryLakh}
            onChangeText={setMaxSalaryLakh}
            keyboardType="numeric"
            placeholder="e.g. 15"
            placeholderTextColor={color.textSubtle}
            style={styles.input}
          />
        </View>

        {/* Save Search Section */}
        <View style={styles.saveBox}>
          <Text style={styles.saveBoxTitle}>Save this search</Text>
          <View style={styles.saveInputRow}>
            <TextInput
              value={searchName}
              onChangeText={setSearchName}
              placeholder="Search name"
              placeholderTextColor={color.textSubtle}
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveSearch}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
          {savedSuccess && (
            <Text style={styles.successText}>Search saved successfully!</Text>
          )}
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
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: color.text,
  },
  savedLink: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  fieldGroup: {
    gap: space.xs,
  },
  fieldLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '600',
    color: color.textMuted,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    fontSize: 14,
    color: color.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  chipActive: {
    borderColor: color.text,
    backgroundColor: color.text,
  },
  chipText: {
    fontSize: 12,
    color: color.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: color.textInverse,
    fontWeight: '600',
  },
  saveBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.xs,
    marginTop: space.sm,
  },
  saveBoxTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 15,
    color: color.text,
  },
  saveInputRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  saveBtn: {
    backgroundColor: color.text,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    fontSize: 11,
    color: color.accent,
    fontWeight: '600',
  },
  footRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  clearBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  applyBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: color.textInverse,
  },
})
