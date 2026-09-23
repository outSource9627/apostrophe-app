import React, { useState, useEffect } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import {
  Button,
  Card,
  Display,
  Divider,
  EmptyState,
  ErrorState,
  Skeleton,
  Tag,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  listSavedSearches,
  deleteSavedSearch,
  type SavedSearch,
} from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

export function SavedSearchesModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listSavedSearches()
      setSearches(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('We could not load your saved searches.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string) => {
    setSearches((prev) => prev.filter((s) => s.id !== id))
    try {
      await deleteSavedSearch(id)
    } catch {
      load()
    }
  }

  const handleApply = (_s: SavedSearch) => {
    navigation.navigate('EmployerFeed')
  }

  return (
    <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Display level="sm">Saved Searches</Display>
        </View>
        <Divider />

        {loading ? (
          <Skeleton lines={3} />
        ) : error ? (
          <ErrorState
            title="We could not load your saved searches."
            body={error.message}
            action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
          />
        ) : searches.length === 0 ? (
          <EmptyState
            title="No saved searches yet"
            body="Save your candidate feed filters to quickly recall them anytime."
            action={
              <Button
                variant="outline"
                size="sm"
                label="Configure filters"
                onPress={() => navigation.navigate('FeedFilters')}
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {searches.map((s) => {
              const tags = [s.filters.city, s.filters.skill, s.filters.availability].filter(
                Boolean,
              ) as string[]
              return (
                <Card key={s.id} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Apply ${s.name}`}
                    onPress={() => handleApply(s)}
                    style={styles.cardInfo}
                  >
                    <Display level="xs" numberOfLines={1}>
                      {s.name}
                    </Display>
                    {tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {tags.map((t, i) => (
                          <Tag key={i} label={t} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.actionRow}>
                    <Button
                      variant="destructive"
                      size="sm"
                      label="Delete"
                      onPress={() => handleDelete(s.id)}
                    />
                  </View>
                </Card>
              )
            })}
          </View>
        )}
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
    gap: space['2xs'],
  },
  list: {
    gap: space.sm,
  },
  card: {
    padding: space.lg,
    gap: space.sm,
  },
  cardInfo: {
    gap: space.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})
