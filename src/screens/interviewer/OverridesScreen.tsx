import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  Input,
  ObjectRow,
  Segmented,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi, type AvailabilityOverrideDto } from '../../lib/api/interviewer'

const AVAILABILITY_OPTIONS = ['Unavailable', 'Available'] as const

export function OverridesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { availability, loading, error, refresh } = useInterviewer()

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

  if (loading && !availability) {
    return (
      <InterviewerShell back={{ label: 'Availability', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && !availability) {
    return (
      <InterviewerShell back={{ label: 'Availability', onPress: () => navigation.goBack() }}>
        <ErrorState
          title="We could not load your overrides."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
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
        <Display level="lg">Date Overrides</Display>
        <Body size="sm" tone="muted">
          Block off holidays, travel days, or add special availability outside your recurring weekly routine.
        </Body>
      </View>

      {/* Add Override Form */}
      <Card style={styles.addCard}>
        <Body size="sm" weight="semibold">
          Add Specific Date Exception
        </Body>
        <Field label="Date (YYYY-MM-DD)">
          <Input
            value={newDate}
            onChangeText={setNewDate}
            placeholder="2026-10-15"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </Field>

        <Field
          label="Availability Type"
          helper={
            isAvailable
              ? 'Special hours apply: 9 AM – 6 PM.'
              : 'Blocked off all day — no bookings allowed.'
          }
        >
          <Segmented
            options={AVAILABILITY_OPTIONS}
            value={isAvailable ? 'Available' : 'Unavailable'}
            onChange={(next) => setIsAvailable(next === 'Available')}
          />
        </Field>

        <Button
          label="Add Override"
          variant="secondary"
          onPress={handleAddOverride}
        />
      </Card>

      {/* Overrides List */}
      <View style={styles.listSection}>
        <Body size="sm" weight="semibold">
          {`Active Exceptions (${overrides.length})`}
        </Body>

        {overrides.length === 0 ? (
          <Card>
            <EmptyState
              title="No date overrides"
              body="Your regular weekly recurring schedule will apply on all days."
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {overrides.map((o) => (
              <Card key={o.date} style={styles.overrideCard}>
                <ObjectRow
                  last
                  title={o.date}
                  meta={
                    o.available
                      ? 'Special availability · 9 AM – 6 PM'
                      : 'Blocked off — regular hours do not apply'
                  }
                  status={
                    <StatusPill
                      tone={o.available ? 'success' : 'neutral'}
                      label={o.available ? 'Available' : 'Unavailable'}
                    />
                  }
                />
                <View style={styles.actionsRow}>
                  <Button
                    label="Remove"
                    variant="destructive"
                    size="sm"
                    onPress={() => handleRemoveOverride(o.date)}
                  />
                </View>
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
  addCard: {
    padding: space.md,
    gap: space.sm,
  },
  listSection: {
    gap: space.xs,
  },
  list: {
    gap: space.sm,
  },
  overrideCard: {
    padding: space.md,
    gap: space.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
})
