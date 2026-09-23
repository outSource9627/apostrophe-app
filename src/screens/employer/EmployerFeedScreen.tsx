import React, { useState, useEffect, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { height, space } from '../../theme'
import { Button, Display, EmptyState, ErrorState, Meta, Skeleton } from '../../components/ui'
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
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadFeed = useCallback(async (cursor?: string) => {
    try {
      setLoading(true)
      setLoadError(null)
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
      } else {
        setLoadError(err?.message || 'Could not load the candidate feed.')
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
        <Meta>SWIPED · LAST CANDIDATE</Meta>
        <Display level="xs" numberOfLines={1}>{undoName}</Display>
      </View>
      <Button variant="outline" size="sm" label="Undo" onPress={handleUndo} />
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
          <Button
            variant="outline"
            size="sm"
            label="Filters"
            onPress={() => navigation.navigate('FeedFilters')}
          />
        </View>

        {loading && items.length === 0 ? (
          <Skeleton lines={3} block />
        ) : loadError && items.length === 0 ? (
          <ErrorState
            title="We could not load the candidate feed."
            body={loadError}
            action={
              <Button
                variant="outline"
                size="sm"
                label="Try again"
                // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
                hitSlop={(height.tap - height['control-xs']) / 2}
                onPress={() => loadFeed()}
              />
            }
          />
        ) : cardLimitReached ? (
          <EmptyState
            title="You've reviewed today's candidates"
            body="Cards reset at midnight IST. Meanwhile, your shortlisted candidates are always reachable."
          />
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
          <EmptyState
            title="End of feed"
            body="You’ve reviewed every candidate currently available. Try broadening your filters."
            action={
              <Button
                variant="secondary"
                size="md"
                label="Adjust filters"
                onPress={() => navigation.navigate('FeedFilters')}
              />
            }
          />
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
  cardContainer: {
    alignItems: 'center',
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  undoInfo: {
    flex: 1,
    gap: space['2xs'],
  },
})
