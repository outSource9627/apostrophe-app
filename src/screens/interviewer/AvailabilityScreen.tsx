import React, { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  ErrorState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
  Toggle,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi, type AvailabilityRuleDto, type AvailabilityOverrideDto } from '../../lib/api/interviewer'

const DAYS = [
  { weekday: 1, label: 'Mon' },
  { weekday: 2, label: 'Tue' },
  { weekday: 3, label: 'Wed' },
  { weekday: 4, label: 'Thu' },
  { weekday: 5, label: 'Fri' },
  { weekday: 6, label: 'Sat' },
  { weekday: 0, label: 'Sun' },
]

// Generate 30-min slots from 08:00 (480 min) to 22:00 (1320 min)
const SLOTS: { startMin: number; endMin: number; label: string }[] = []
for (let m = 480; m < 1320; m += 30) {
  const startHour = Math.floor(m / 60)
  const startM = m % 60
  const endHour = Math.floor((m + 30) / 60)
  const endM = (m + 30) % 60
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  SLOTS.push({
    startMin: m,
    endMin: m + 30,
    label: `${pad(startHour)}:${pad(startM)} – ${pad(endHour)}:${pad(endM)}`,
  })
}

export function AvailabilityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { availability, error, refresh } = useInterviewer()

  const [selectedDay, setSelectedDay] = useState<number>(1) // Monday default
  const [rules, setRules] = useState<AvailabilityRuleDto[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverrideDto[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (availability) {
      setRules(availability.rules || [])
      setOverrides(availability.overrides || [])
    }
  }, [availability])

  const currentDayRule = rules.find((r) => r.weekday === selectedDay)
  const currentBlocks = currentDayRule?.blocks || []

  const isSlotActive = (startMin: number, endMin: number) => {
    return currentBlocks.some(
      (b) => b.startMin <= startMin && b.endMin >= endMin,
    )
  }

  const toggleSlot = (startMin: number, endMin: number) => {
    const active = isSlotActive(startMin, endMin)
    let newBlocks = [...currentBlocks]

    if (active) {
      // Remove block
      newBlocks = newBlocks.filter(
        (b) => !(b.startMin === startMin && b.endMin === endMin),
      )
    } else {
      // Add 30-min slot block
      newBlocks.push({ startMin, endMin })
      // Sort blocks
      newBlocks.sort((a, b) => a.startMin - b.startMin)
    }

    const otherRules = rules.filter((r) => r.weekday !== selectedDay)
    setRules([...otherRules, { weekday: selectedDay, blocks: newBlocks }])
  }

  const handleSetFullDay = (enable: boolean) => {
    const otherRules = rules.filter((r) => r.weekday !== selectedDay)
    if (enable) {
      // Standard 09:00 - 18:00
      const standardBlocks = SLOTS.filter((s) => s.startMin >= 540 && s.endMin <= 1080).map((s) => ({
        startMin: s.startMin,
        endMin: s.endMin,
      }))
      setRules([...otherRules, { weekday: selectedDay, blocks: standardBlocks }])
    } else {
      setRules([...otherRules, { weekday: selectedDay, blocks: [] }])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await interviewerApi.saveAvailability({
        rules,
        overrides,
      })
      await refresh()
      Alert.alert('Saved', 'Your recurring weekly availability has been updated.')
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to update availability.')
    } finally {
      setSaving(false)
    }
  }

  // Calculate total weekly available hours
  const totalSlotsWeekly = rules.reduce((acc, r) => acc + (r.blocks?.length || 0), 0)
  const totalHoursWeekly = (totalSlotsWeekly * 30) / 60

  return (
    <InterviewerShell
      navTab="availability"
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
        <Eyebrow>WEEKLY SCHEDULE</Eyebrow>
        <Display level="lg">Manage Availability</Display>
      </View>

      {availability ? (
        <>
          <Body size="sm" tone="muted">
            Set your weekly recurring hours. Students book 20-minute sessions during your active 30-minute slots.
          </Body>

          {/* Stats row & overrides button */}
          <Card style={styles.summaryCard}>
            <View style={styles.grow}>
              <Eyebrow>Weekly Commitment</Eyebrow>
              <Display level="xs">{totalHoursWeekly} hrs / week</Display>
              <Meta style={styles.summarySub}>{totalSlotsWeekly} slots open</Meta>
            </View>
            <Button
              label={`Overrides (${overrides.length})`}
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate('InterviewerOverrides')}
            />
          </Card>

          {/* Day Selector */}
          <View style={styles.dayRow}>
            {DAYS.map((d) => {
              const isSelected = d.weekday === selectedDay
              const ruleForDay = rules.find((r) => r.weekday === d.weekday)
              const slotCount = ruleForDay?.blocks?.length || 0

              return (
                <Chip
                  key={d.weekday}
                  label={`${d.label} · ${slotCount}`}
                  selected={isSelected}
                  onPress={() => setSelectedDay(d.weekday)}
                  style={styles.dayChip}
                />
              )
            })}
          </View>

          {/* Day Actions */}
          <View style={styles.quickActions}>
            <Body size="sm" weight="semibold">
              {DAYS.find((d) => d.weekday === selectedDay)?.label} Schedule ({currentBlocks.length} slots)
            </Body>
            <View style={styles.quickActionBtns}>
              <Pressable onPress={() => handleSetFullDay(true)}>
                <Body size="xs" weight="semibold">Standard 9–6</Body>
              </Pressable>
              <Meta>•</Meta>
              <Pressable onPress={() => handleSetFullDay(false)}>
                <Body size="xs" weight="semibold" tone="muted">Clear Day</Body>
              </Pressable>
            </View>
          </View>

          {/* 30-min Slot Grid */}
          <Card>
            {SLOTS.map((s, i) => {
              const active = isSlotActive(s.startMin, s.endMin)

              return (
                <ObjectRow
                  key={`${s.startMin}-${s.endMin}`}
                  title={s.label}
                  status={
                    <Toggle
                      on={active}
                      onChange={() => toggleSlot(s.startMin, s.endMin)}
                      label={`${s.label} availability`}
                    />
                  }
                  last={i === SLOTS.length - 1}
                />
              )
            })}
          </Card>
        </>
      ) : error ? (
        <ErrorState
          title="We could not load your availability."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      ) : (
        <Skeleton lines={4} />
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  grow: {
    flex: 1,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    gap: space.md,
  },
  summarySub: {
    marginTop: space['2xs'],
  },
  dayRow: {
    flexDirection: 'row',
    gap: space['2xs'],
  },
  dayChip: {
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
})
