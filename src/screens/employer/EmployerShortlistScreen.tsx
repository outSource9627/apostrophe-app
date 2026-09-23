import React, { useState, useEffect, useCallback } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, opacity, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  Skeleton,
  StatusPill,
  Tag,
  VerifiedSeal,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import { EmployerNav, type EmployerNavKey } from '../../components/employer/EmployerNav'
import {
  fetchShortlist,
  removeFromShortlist,
  type ShortlistRow,
  type EmployerJobRef,
} from '../../lib/api/employerShortlist'
import {
  employerInterestSlot,
  type InterestSlot,
} from '../../lib/api/employerInterests'
import type { RootStackParamList } from '../../../App'

export function EmployerShortlistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [rows, setRows] = useState<ShortlistRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalAll, setTotalAll] = useState(0)
  const [facets, setFacets] = useState<{ tags: string[]; jobs: EmployerJobRef[] }>({ tags: [], jobs: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [sort, setSort] = useState<'ADDED' | 'INTERVIEWED'>('ADDED')

  const loadShortlist = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchShortlist({
        tag: selectedTag || undefined,
        sort,
      })
      setRows(res.rows)
      setTotal(res.total)
      setTotalAll(res.totalAll ?? res.total)
      if (res.facets) {
        setFacets(res.facets)
      }
    } catch (err) {
      console.error('Failed to load shortlist', err)
      setError(err instanceof Error ? err : new Error('We could not load your shortlist.'))
    } finally {
      setLoading(false)
    }
  }, [selectedTag, sort])

  useEffect(() => {
    loadShortlist()
  }, [loadShortlist])

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') navigation.navigate('EmployerFeed')
    else if (key === 'shortlist') loadShortlist()
    else if (key === 'interests') navigation.navigate('EmployerInterests')
    else if (key === 'jobs') navigation.navigate('EmployerJobs')
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  const handleRemove = (row: ShortlistRow) => {
    Alert.alert(
      'Remove from shortlist',
      `Remove ${row.name} from your shortlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromShortlist(row.id)
              setRows((prev) => prev.filter((r) => r.id !== row.id))
              setTotal((t) => Math.max(0, t - 1))
              setTotalAll((t) => Math.max(0, t - 1))
            } catch (err) {
              console.error('Failed to remove from shortlist', err)
            }
          },
        },
      ],
    )
  }

  return (
    <EmployerShell
      nav={<EmployerNav current="shortlist" onSelect={handleNavSelect} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Eyebrow>Candidate bookkeeping</Eyebrow>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSort((s) => (s === 'ADDED' ? 'INTERVIEWED' : 'ADDED'))}
            style={styles.sortToggle}
          >
            <Body size="xs" tone="muted" weight="medium">
              {sort === 'ADDED' ? 'Recently added' : 'Recently interviewed'} ▾
            </Body>
          </Pressable>
        </View>
        <Display level="lg" accessibilityRole="header">
          Shortlist
        </Display>
        {!loading && (
          <Body size="xs" tone="muted">
            {`${total} of ${totalAll} candidates`}
          </Body>
        )}
      </View>

      {/* Tags filter — a scrolling chip row, the same shape the jobs/interests status filters use. */}
      {facets.tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterRow}
        >
          <Chip label="All tags" selected={!selectedTag} onPress={() => setSelectedTag('')} />
          {facets.tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              selected={selectedTag === tag}
              onPress={() => setSelectedTag(selectedTag === tag ? '' : tag)}
            />
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {loading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState
          title="We could not load your shortlist."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => loadShortlist()} />}
        />
      ) : totalAll === 0 ? (
        <EmptyState
          title="No shortlisted candidates"
          body="Swipe right on candidates in the verified feed to save them here for evaluation."
          action={
            <Button
              variant="outline"
              size="sm"
              label="Explore candidate feed"
              onPress={() => navigation.navigate('EmployerFeed')}
            />
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No candidates match filter"
          body="Try selecting a different tag filter."
          action={<Button variant="outline" size="sm" label="Clear filters" onPress={() => setSelectedTag('')} />}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const slot: InterestSlot = employerInterestSlot({
              available: row.available,
              interest: row.interest,
              connection: row.connection,
            })

            return (
              <Card key={row.id} style={[styles.card, !row.available && styles.cardUnavailable]}>
                <View style={styles.cardTop}>
                  {/* Poster thumbnail */}
                  <View style={styles.posterBox}>
                    {row.candidate?.posterUrl ? (
                      <Image
                        source={{ uri: row.candidate.posterUrl }}
                        style={styles.posterImg}
                      />
                    ) : (
                      <View style={styles.posterPlaceholder}>
                        <Display level="xs">{row.name.charAt(0)}</Display>
                      </View>
                    )}
                  </View>

                  {/* Information */}
                  <View style={styles.cardInfo}>
                    <Pressable
                      accessibilityRole={row.available ? 'button' : undefined}
                      onPress={() => {
                        if (row.available) {
                          navigation.navigate('CandidateProfile', { id: row.candidateId })
                        }
                      }}
                    >
                      <Display level="xs">{row.name}</Display>
                    </Pressable>

                    <Body size="xs" tone="muted">
                      {row.available
                        ? [row.candidate?.qualification, row.candidate?.city].filter(Boolean).join(' · ')
                        : 'Profile unavailable'}
                    </Body>

                    {(row.candidate?.verifiedInterview?.verified || row.job) && (
                      <View style={styles.subRow}>
                        {row.candidate?.verifiedInterview?.verified && (
                          <VerifiedSeal
                            date={
                              row.candidate.verifiedInterview.at
                                ? new Date(row.candidate.verifiedInterview.at).toLocaleDateString('en-IN', {
                                    dateStyle: 'medium',
                                  })
                                : undefined
                            }
                          />
                        )}
                        {row.job && <Tag label={`Linked: ${row.job.title}`} />}
                      </View>
                    )}
                  </View>
                </View>

                {/* Notes preview */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('ShortlistEntry', {
                      row,
                      jobs: facets.jobs,
                    })
                  }
                  style={styles.notesBox}
                >
                  <Meta>Note:</Meta>
                  <Body size="xs" style={styles.notesText} numberOfLines={2}>
                    {row.notes ? `"${row.notes}"` : 'Add private notes or tags…'}
                  </Body>
                </Pressable>

                {/* Card actions footer */}
                <View style={styles.cardFoot}>
                  {/* Interest slot */}
                  {slot === 'OPEN_CHAT' ? (
                    <Button variant="secondary" size="sm" label="Open chat" />
                  ) : slot === 'SENT' ? (
                    <StatusPill tone="warning" label="Interest sent" />
                  ) : slot === 'ACCEPTED' ? (
                    <StatusPill tone="success" label="Accepted" />
                  ) : slot === 'COOLDOWN' ? (
                    <StatusPill tone="neutral" label="In cooldown" />
                  ) : slot === 'SEND' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      label="Send Interest"
                      onPress={() =>
                        navigation.navigate('SendInterest', {
                          candidateId: row.candidateId,
                          candidateName: row.name,
                          candidateHeadline: row.candidate?.qualification,
                          candidateCity: row.candidate?.city,
                          jobs: facets.jobs,
                        })
                      }
                    />
                  ) : (
                    <StatusPill tone="neutral" label="Unavailable" />
                  )}

                  {/* Edit & remove */}
                  <View style={styles.cardActionsRight}>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() =>
                        navigation.navigate('ShortlistEntry', {
                          row,
                          jobs: facets.jobs,
                        })
                      }
                    >
                      <Body size="xs" tone="muted" weight="medium">
                        Edit
                      </Body>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove from shortlist"
                      hitSlop={8}
                      onPress={() => handleRemove(row)}
                    >
                      <Body size="xs" tone="subtle">
                        ✕
                      </Body>
                    </Pressable>
                  </View>
                </View>
              </Card>
            )
          })}
        </View>
      )}
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space.xs,
    paddingBottom: space.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  sortToggle: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  tagFilterRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  list: { gap: space.sm },
  card: { padding: space.lg, gap: space.sm },
  cardUnavailable: { opacity: opacity.disabled },
  cardTop: {
    flexDirection: 'row',
    gap: space.sm,
  },
  posterBox: {
    width: 48,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: space['2xs'],
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  notesBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
    flexDirection: 'row',
    gap: space.xs,
  },
  notesText: {
    flex: 1,
    fontStyle: 'italic',
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
})
