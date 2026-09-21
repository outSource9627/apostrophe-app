import React, { useState, useEffect, useCallback } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, radius, space, fontFamilyNative } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import { CandidateCard } from '../../components/employer/CandidateCard'
import {
  fetchCandidateFeed,
  postSwipe,
  undoLastSwipe,
  type CandidateCard as CandidateCardType,
} from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

export function EmployerFeedScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [items, setItems] = useState<CandidateCardType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cardLimitReached, setCardLimitReached] = useState(false)
  const [undoName, setUndoName] = useState<string | null>(null)

  const loadFeed = useCallback(async (cursor?: string) => {
    try {
      setLoading(true)
      const res = await fetchCandidateFeed({ cursor, limit: 10 })
      if (cursor) {
        setItems((prev) => [...prev, ...res.items])
      } else {
        setItems(res.items)
        setCurrentIndex(0)
      }
      setNextCursor(res.nextCursor)
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED' || err?.meta?.reason === 'CARD_LIMIT_REACHED') {
        setCardLimitReached(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  useEffect(() => {
    if (currentIndex >= items.length - 2 && nextCursor && !loading) {
      loadFeed(nextCursor)
    }
  }, [currentIndex, items.length, nextCursor, loading, loadFeed])

  const handleSwipe = async (direction: 'RIGHT' | 'LEFT') => {
    const candidate = items[currentIndex]
    if (!candidate) return

    try {
      await postSwipe(candidate.id, direction)
      setUndoName(candidate.name)
      setCurrentIndex((i) => i + 1)
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED') {
        setCardLimitReached(true)
      }
    }
  }

  const handleUndo = async () => {
    if (!undoName) return
    try {
      await undoLastSwipe()
      setCurrentIndex((i) => Math.max(0, i - 1))
      setUndoName(null)
    } catch {
      // Ignored
    }
  }

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') return
    if (key === 'shortlist') navigation.navigate('EmployerShortlist')
    else if (key === 'interests') navigation.navigate('EmployerInterests')
    else if (key === 'jobs') navigation.navigate('EmployerJobs')
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  const activeCandidate = items[currentIndex]

  const undoFooter = undoName ? (
    <View style={styles.undoBar}>
      <View style={styles.undoInfo}>
        <Text style={styles.undoMeta}>SWIPED · LAST CANDIDATE</Text>
        <Text style={styles.undoName} numberOfLines={1}>{undoName}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleUndo}
        style={styles.undoBtn}
      >
        <Text style={styles.undoBtnText}>Undo</Text>
      </TouchableOpacity>
    </View>
  ) : undefined

  return (
    <EmployerShell
      onAccount={() => navigation.navigate('EmployerCompany')}
      nav={<EmployerNav current="feed" onSelect={handleNavSelect} />}
      footer={undoFooter}
    >
      <View style={styles.container}>
        {/* Header Actions Row */}
        <View style={styles.topActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('FeedFilters')}
            style={styles.filterBtn}
          >
            <Text style={styles.filterText}>⚡ Filters</Text>
          </TouchableOpacity>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Finding verified candidates…</Text>
          </View>
        ) : cardLimitReached ? (
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>DAILY LIMIT REACHED</Text>
            <Text style={styles.panelTitle}>You've reviewed today's candidates</Text>
            <Text style={styles.panelBody}>
              Cards reset at midnight IST. Meanwhile, your shortlisted candidates are always reachable.
            </Text>
          </View>
        ) : activeCandidate ? (
          <View style={styles.cardContainer}>
            <CandidateCard
              candidate={activeCandidate}
              onPressProfile={() =>
                navigation.navigate('CandidateProfile', { id: activeCandidate.id })
              }
              onPressVideo={() =>
                navigation.navigate('CandidateVideo', { id: activeCandidate.id })
              }
              onSwipe={handleSwipe}
            />
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>End of feed</Text>
            <Text style={styles.panelBody}>
              You’ve reviewed every candidate currently available. Try broadening your filters.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FeedFilters')}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Adjust filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.sm,
    paddingBottom: space.md,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: space.xs,
  },
  filterBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: space.xs,
  },
  loadingText: {
    fontSize: 13,
    color: color.textMuted,
  },
  cardContainer: {
    alignItems: 'center',
  },
  panel: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    alignItems: 'center',
    textAlign: 'center',
    gap: space.xs,
    marginTop: space.xl,
  },
  panelEyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textMuted,
  },
  panelTitle: {
    fontFamily: fontFamilyNative.display,
    fontSize: 20,
    color: color.text,
    textAlign: 'center',
  },
  panelBody: {
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: space.sm,
    backgroundColor: color.text,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  primaryBtnText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  undoInfo: {
    flex: 1,
    marginRight: space.sm,
  },
  undoMeta: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    color: color.textMuted,
  },
  undoName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 14,
    color: color.text,
  },
  undoBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
})
