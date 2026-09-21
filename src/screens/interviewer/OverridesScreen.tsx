import React, { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, Field, Input } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi, type AvailabilityOverrideDto } from '../../lib/api/interviewer'

export function OverridesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { availability, refresh } = useInterviewer()

  const [overrides, setOverrides] = useState<AvailabilityOverrideDto[]>(
    availability?.overrides || [],
  )
  const [newDate, setNewDate] = useState('')
  const [isAvailable, setIsAvailable] = useState(false) // default unavailable all day
  const [saving, setSaving] = useState(false)

  const handleAddOverride = () => {
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format (e.g. 2026-10-15).')
      return
    }

    if (overrides.some((o) => o.date === newDate)) {
      Alert.alert('Duplicate Date', 'An override for this date already exists.')
      return
    }

    const nextOverrides = [
      ...overrides,
      {
        date: newDate,
        available: isAvailable,
        blocks: isAvailable ? [{ startMin: 540, endMin: 1080 }] : [],
      },
    ].sort((a, b) => a.date.localeCompare(b.date))

    setOverrides(nextOverrides)
    setNewDate('')
  }

  const handleRemoveOverride = (date: string) => {
    setOverrides(overrides.filter((o) => o.date !== date))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await interviewerApi.saveAvailability({
        rules: availability?.rules || [],
        overrides,
      })
      await refresh()
      Alert.alert('Saved', 'Date overrides have been saved.')
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to update overrides.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <InterviewerShell
      back={{ label: 'Availability', onPress: () => navigation.goBack() }}
      rightAction={
        <Button
          label={saving ? 'Saving...' : 'Save'}
          variant="primary"
          size="sm"
          disabled={saving}
          onPress={handleSave}
        />
      }
    >
      <View style={styles.header}>
        <Eyebrow>SCHEDULE EXCEPTIONS</Eyebrow>
        <Text style={styles.title}>Date Overrides</Text>
        <Text style={styles.subtitle}>
          Block off holidays, travel days, or add special availability outside your recurring weekly routine.
        </Text>
      </View>

      {/* Add Override Form */}
      <Card style={styles.addCard}>
        <Text style={styles.cardTitle}>Add Specific Date Exception</Text>
        <Field label="Date (YYYY-MM-DD)">
          <Input
            value={newDate}
            onChangeText={setNewDate}
            placeholder="2026-10-15"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </Field>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setIsAvailable(false)}
            style={[styles.togglePill, !isAvailable && styles.togglePillActive]}
          >
            <Text style={[styles.toggleText, !isAvailable && styles.toggleTextActive]}>
              Unavailable All Day
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsAvailable(true)}
            style={[styles.togglePill, isAvailable && styles.togglePillActive]}
          >
            <Text style={[styles.toggleText, isAvailable && styles.toggleTextActive]}>
              Available (9 AM – 6 PM)
            </Text>
          </Pressable>
        </View>

        <Button
          label="Add Override"
          variant="secondary"
          onPress={handleAddOverride}
        />
      </Card>

      {/* Overrides List */}
      <View style={styles.listSection}>
        <Text style={styles.listHeading}>Active Exceptions ({overrides.length})</Text>

        {overrides.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No date overrides defined.</Text>
            <Text style={styles.emptySub}>
              Your regular weekly recurring schedule will apply on all days.
            </Text>
          </Card>
        ) : (
          <View style={styles.overrideList}>
            {overrides.map((o) => (
              <Card key={o.date} style={styles.overrideItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overrideDate}>{o.date}</Text>
                  <Text style={[styles.overrideStatus, !o.available && styles.overrideUnavailable]}>
                    {o.available ? 'Special Availability (9 AM – 6 PM)' : 'Unavailable (Blocked Off)'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveOverride(o.date)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </View>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
    fontWeight: '700',
    color: color.text,
  },
  subtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    lineHeight: 20,
  },
  addCard: {
    padding: space.md,
    gap: space.sm,
  },
  cardTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '600',
    color: color.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  togglePill: {
    flex: 1,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    backgroundColor: color.surface,
  },
  togglePillActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  toggleText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  toggleTextActive: {
    color: color.surface,
  },
  listSection: {
    gap: space.xs,
  },
  listHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '600',
    color: color.text,
  },
  emptyCard: {
    padding: space.lg,
    alignItems: 'center',
    gap: space['2xs'],
  },
  emptyText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  emptySub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  overrideList: {
    gap: space.xs,
  },
  overrideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
  },
  overrideDate: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  overrideStatus: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  overrideUnavailable: {
    color: color.accent,
  },
  deleteBtn: {
    paddingHorizontal: space.xs,
    paddingVertical: space['2xs'],
  },
  deleteText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
  },
})
