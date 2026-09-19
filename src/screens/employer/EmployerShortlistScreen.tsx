import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [sort, setSort] = useState<'ADDED' | 'INTERVIEWED'>('ADDED')

  const loadShortlist = useCallback(async () => {
    try {
      setLoading(true)
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CANDIDATE BOOKKEEPING</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Shortlist</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSort((s) => (s === 'ADDED' ? 'INTERVIEWED' : 'ADDED'))}
              style={styles.sortToggle}
            >
              <Text style={styles.sortToggleText}>
                {sort === 'ADDED' ? 'Recently added' : 'Recently interviewed'} ▾
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.counter}>
            {loading ? 'Loading…' : `${total} of ${totalAll} candidates`}
          </Text>
        </View>

        {/* Tags Filter Chips */}
        {facets.tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilterRow}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelectedTag('')}
              style={[styles.filterChip, !selectedTag && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, !selectedTag && styles.filterChipTextActive]}>
                All tags
              </Text>
            </TouchableOpacity>
            {facets.tags.map((tag) => {
              const active = selectedTag === tag
              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTag(active ? '' : tag)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading shortlist…</Text>
          </View>
        ) : totalAll === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No shortlisted candidates</Text>
            <Text style={styles.emptyBody}>
              Swipe right on candidates in the verified feed to save them here for evaluation.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EmployerFeed')}
              style={styles.exploreBtn}
            >
              <Text style={styles.exploreBtnText}>Explore candidate feed</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No candidates match filter</Text>
            <Text style={styles.emptyBody}>Try selecting a different tag filter.</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedTag('')}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const slot: InterestSlot = employerInterestSlot({
                available: row.available,
                interest: row.interest,
                connection: row.connection,
              })

              return (
                <View
                  key={row.id}
                  style={[styles.card, !row.available && styles.cardUnavailable]}
                >
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
                          <Text style={styles.monogramLetter}>{row.name.charAt(0)}</Text>
                        </View>
                      )}
                      {row.candidate?.verifiedInterview?.verified && (
                        <View style={styles.verifiedDot}>
                          <Text style={styles.verifiedDotText}>✓</Text>
                        </View>
                      )}
                    </View>

                    {/* Information */}
                    <View style={styles.cardInfo}>
                      <TouchableOpacity
                        activeOpacity={row.available ? 0.7 : 1}
                        onPress={() => {
                          if (row.available) {
                            navigation.navigate('CandidateProfile', { id: row.candidateId })
                          }
                        }}
                      >
                        <Text style={styles.candidateName}>{row.name}</Text>
                      </TouchableOpacity>

                      <Text style={styles.candidateMeta}>
                        {row.available
                          ? [row.candidate?.qualification, row.candidate?.city].filter(Boolean).join(' · ')
                          : 'Profile unavailable'}
                      </Text>

                      {row.job && (
                        <View style={styles.jobPill}>
                          <Text style={styles.jobPillText}>Linked: {row.job.title}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Notes Preview */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('ShortlistEntry', {
                        row,
                        jobs: facets.jobs,
                      })
                    }
                    style={styles.notesBox}
                  >
                    <Text style={styles.notesLabel}>NOTE:</Text>
                    <Text style={styles.notesText} numberOfLines={2}>
                      {row.notes ? `"${row.notes}"` : 'Add private notes or tags…'}
                    </Text>
                  </TouchableOpacity>

                  {/* Card Actions Footer */}
                  <View style={styles.cardFoot}>
                    {/* Interest Slot */}
                    {slot === 'OPEN_CHAT' ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.actionBtnPrimary}
                      >
                        <Text style={styles.actionBtnPrimaryText}>Open chat</Text>
                      </TouchableOpacity>
                    ) : slot === 'SENT' ? (
                      <View style={styles.slotBadgeAccent}>
                        <Text style={styles.slotBadgeAccentText}>Interest sent</Text>
                      </View>
                    ) : slot === 'ACCEPTED' ? (
                      <View style={styles.slotBadgeSuccess}>
                        <Text style={styles.slotBadgeSuccessText}>Accepted</Text>
                      </View>
                    ) : slot === 'COOLDOWN' ? (
                      <View style={styles.slotBadgeMuted}>
                        <Text style={styles.slotBadgeMutedText}>In cooldown</Text>
                      </View>
                    ) : slot === 'SEND' ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          navigation.navigate('SendInterest', {
                            candidateId: row.candidateId,
                            candidateName: row.name,
                            candidateHeadline: row.candidate?.qualification,
                            candidateCity: row.candidate?.city,
                            jobs: facets.jobs,
                          })
                        }
                        style={styles.actionBtnPrimary}
                      >
                        <Text style={styles.actionBtnPrimaryText}>Send Interest</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.slotBadgeMuted}>
                        <Text style={styles.slotBadgeMutedText}>Unavailable</Text>
                      </View>
                    )}

                    {/* Edit & Remove */}
                    <View style={styles.cardActionsRight}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('ShortlistEntry', {
                            row,
                            jobs: facets.jobs,
                          })
                        }
                        style={styles.editBtn}
                      >
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleRemove(row)}
                        style={styles.removeBtn}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
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
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: space.sm,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: color.accent,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 24,
    color: color.text,
  },
  sortToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  sortToggleText: {
    fontSize: 11,
    color: color.textMuted,
    fontWeight: '500',
  },
  counter: {
    fontSize: 12,
    color: color.textMuted,
  },
  tagFilterRow: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
  },
  filterChipActive: {
    backgroundColor: color.text,
  },
  filterChipText: {
    fontSize: 11,
    color: color.textMuted,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: color.textInverse,
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
  exploreBtn: {
    backgroundColor: color.text,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  exploreBtnText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  clearBtnText: {
    color: color.text,
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    gap: space.sm,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.xs,
  },
  cardUnavailable: {
    opacity: 0.65,
  },
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
    position: 'relative',
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
  monogramLetter: {
    fontFamily: fontFamilyNative.display,
    fontSize: 20,
    color: color.textSubtle,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: color.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    fontSize: 8,
    color: color.textInverse,
    fontWeight: 'bold',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  candidateName: {
    fontFamily: fontFamilyNative.display,
    fontSize: 16,
    color: color.text,
  },
  candidateMeta: {
    fontSize: 12,
    color: color.textMuted,
  },
  jobPill: {
    backgroundColor: color.surfaceMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  jobPillText: {
    fontSize: 10,
    color: color.textSubtle,
    fontWeight: '500',
  },
  notesBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: 6,
    flexDirection: 'row',
    gap: 4,
  },
  notesLabel: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    color: color.textSubtle,
    fontWeight: '600',
  },
  notesText: {
    flex: 1,
    fontSize: 11,
    color: color.text,
    fontStyle: 'italic',
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  actionBtnPrimary: {
    backgroundColor: color.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  actionBtnPrimaryText: {
    color: color.textInverse,
    fontSize: 11,
    fontWeight: '600',
  },
  slotBadgeAccent: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  slotBadgeAccentText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.accent,
  },
  slotBadgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  slotBadgeSuccessText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.success,
  },
  slotBadgeMuted: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  slotBadgeMutedText: {
    fontSize: 10,
    color: color.textMuted,
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: 11,
    color: color.textMuted,
    fontWeight: '500',
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeBtnText: {
    fontSize: 12,
    color: color.textSubtle,
  },
})
