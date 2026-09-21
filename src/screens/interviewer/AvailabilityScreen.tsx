import React, { useEffect, useState } from 'react'
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
import { Button, Card, Eyebrow } from '../../components/ui'
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
  const { availability, refresh } = useInterviewer()

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
        <View>
          <Eyebrow>WEEKLY SCHEDULE</Eyebrow>
          <Text style={styles.title}>Manage Availability</Text>
        </View>
      </View>

      <Text style={styles.intro}>
        Set your weekly recurring hours. Students book 20-minute sessions during your active 30-minute slots.
      </Text>

      {/* Stats row & overrides button */}
      <View style={styles.summaryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>Weekly Commitment</Text>
          <Text style={styles.summaryValue}>{totalHoursWeekly} hrs / week</Text>
          <Text style={styles.summarySub}>{totalSlotsWeekly} slots open</Text>
        </View>
        <Button
          label={`Overrides (${overrides.length})`}
          variant="secondary"
          size="sm"
          onPress={() => navigation.navigate('InterviewerOverrides')}
        />
      </View>

      {/* Day Selector */}
      <View style={styles.dayRow}>
        {DAYS.map((d) => {
          const isSelected = d.weekday === selectedDay
          const ruleForDay = rules.find((r) => r.weekday === d.weekday)
          const slotCount = ruleForDay?.blocks?.length || 0

          return (
            <Pressable
              key={d.weekday}
              onPress={() => setSelectedDay(d.weekday)}
              style={[styles.dayTab, isSelected && styles.dayTabActive]}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                {d.label}
              </Text>
              <View
                style={[
                  styles.slotIndicator,
                  slotCount > 0 && styles.slotIndicatorActive,
                  isSelected && styles.slotIndicatorSelected,
                ]}
              >
                <Text
                  style={[
                    styles.slotIndicatorText,
                    isSelected && styles.slotIndicatorTextSelected,
                  ]}
                >
                  {slotCount}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Day Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.dayHeading}>
          {DAYS.find((d) => d.weekday === selectedDay)?.label} Schedule ({currentBlocks.length} slots)
        </Text>
        <View style={styles.quickActionBtns}>
          <Pressable onPress={() => handleSetFullDay(true)}>
            <Text style={styles.quickLink}>Standard 9–6</Text>
          </Pressable>
          <Text style={styles.bullet}>•</Text>
          <Pressable onPress={() => handleSetFullDay(false)}>
            <Text style={styles.quickLinkClear}>Clear Day</Text>
          </Pressable>
        </View>
      </View>

      {/* 30-min Slot Grid */}
      <Card style={styles.slotsCard}>
        {SLOTS.map((s) => {
          const active = isSlotActive(s.startMin, s.endMin)

          return (
            <Pressable
              key={`${s.startMin}-${s.endMin}`}
              onPress={() => toggleSlot(s.startMin, s.endMin)}
              style={[styles.slotRow, active && styles.slotRowActive]}
            >
              <Text style={[styles.slotTime, active && styles.slotTimeActive]}>
                {s.label}
              </Text>
              <View style={[styles.slotCheckbox, active && styles.slotCheckboxActive]}>
                {active && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          )
        })}
      </Card>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 22,
    fontWeight: '700',
    color: color.text,
    marginTop: 2,
  },
  intro: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceSubtle,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  summaryLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  summaryValue: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
    marginTop: 2,
  },
  summarySub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
  },
  dayRow: {
    flexDirection: 'row',
    gap: space['2xs'],
    justifyContent: 'space-between',
  },
  dayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    gap: 4,
  },
  dayTabActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  dayLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  dayLabelActive: {
    color: color.surface,
    fontWeight: '700',
  },
  slotIndicator: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  slotIndicatorActive: {
    backgroundColor: '#dbeafe',
  },
  slotIndicatorSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  slotIndicatorText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    fontWeight: '700',
    color: color.textSubtle,
  },
  slotIndicatorTextSelected: {
    color: color.surface,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space['2xs'],
  },
  dayHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  quickActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  quickLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
  },
  quickLinkClear: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  bullet: {
    fontSize: 10,
    color: color.textSubtle,
  },
  slotsCard: {
    padding: space.xs,
    gap: 2,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  slotRowActive: {
    backgroundColor: '#eff6ff',
  },
  slotTime: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 13,
    color: color.textMuted,
  },
  slotTimeActive: {
    color: color.text,
    fontWeight: '600',
  },
  slotCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  slotCheckboxActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  checkmark: {
    color: color.surface,
    fontSize: 12,
    fontWeight: '700',
  },
})
