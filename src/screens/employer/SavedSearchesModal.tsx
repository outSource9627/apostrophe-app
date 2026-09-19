import React, { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
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

  const load = async () => {
    try {
      setLoading(true)
      const data = await listSavedSearches()
      setSearches(data)
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

  const handleApply = (s: SavedSearch) => {
    navigation.navigate('EmployerFeed')
  }

  return (
    <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved Searches</Text>
        </View>

        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading saved searches…</Text>
          </View>
        ) : searches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No saved searches yet</Text>
            <Text style={styles.emptyBody}>
              Save your candidate feed filters to quickly recall them anytime.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FeedFilters')}
              style={styles.openFiltersBtn}
            >
              <Text style={styles.openFiltersText}>Configure filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {searches.map((s) => (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.8}
                onPress={() => handleApply(s)}
                style={styles.searchItem}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.searchName}>{s.name}</Text>
                  <View style={styles.tagRow}>
                    {s.filters.city && (
                      <View style={styles.filterPill}>
                        <Text style={styles.filterPillText}>{s.filters.city}</Text>
                      </View>
                    )}
                    {s.filters.skill && (
                      <View style={styles.filterPill}>
                        <Text style={styles.filterPillText}>{s.filters.skill}</Text>
                      </View>
                    )}
                    {s.filters.availability && (
                      <View style={styles.filterPill}>
                        <Text style={styles.filterPillText}>{s.filters.availability}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDelete(s.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
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
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 22,
    color: color.text,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 13,
    color: color.textMuted,
    marginTop: space.xs,
  },
  emptyCard: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.lg,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 18,
    color: color.text,
  },
  emptyBody: {
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  openFiltersBtn: {
    backgroundColor: color.text,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  openFiltersText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: space.xs,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  searchName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    color: color.text,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  filterPill: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  filterPillText: {
    fontSize: 10,
    color: color.textMuted,
    fontWeight: '500',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    color: color.textSubtle,
  },
})
