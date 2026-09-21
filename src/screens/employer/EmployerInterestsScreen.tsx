import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
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
  fetchEmployerInterests,
  liveInterestOutcome,
  type EmployerInterestRow,
  type InterestOutcome,
} from '../../lib/api/employerInterests'
import type { RootStackParamList } from '../../../App'

export function EmployerInterestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [activeTab, setActiveTab] = useState<'all' | InterestOutcome>('all')
  const [rows, setRows] = useState<EmployerInterestRow[]>([])
  const [counts, setCounts] = useState<{ all: number; SENT: number; ACCEPTED: number; NOT_ACCEPTED: number }>({
    all: 0,
    SENT: 0,
    ACCEPTED: 0,
    NOT_ACCEPTED: 0,
  })
  const [since, setSince] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadInterests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchEmployerInterests({
        outcome: activeTab === 'all' ? undefined : activeTab,
      })
      setRows(res.rows)
      setCounts(res.counts)
      setSince(res.since)
    } catch (err) {
      console.error('Failed to load interests', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadInterests()
  }, [loadInterests])

  const handleNavSelect = (key: EmployerNavKey) => {
    if (key === 'feed') navigation.navigate('EmployerFeed')
    else if (key === 'shortlist') navigation.navigate('EmployerShortlist')
    else if (key === 'interests') loadInterests()
    else if (key === 'jobs') navigation.navigate('EmployerJobs')
    else if (key === 'chat') navigation.navigate('EmployerChats')
  }

  const now = new Date()

  return (
    <EmployerShell
      nav={<EmployerNav current="interests" onSelect={handleNavSelect} />}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>OUTBOUND REACH</Text>
          <Text style={styles.title}>Interests Sent</Text>
          <Text style={styles.subtitle}>
            {since
              ? `Tracking outreach since ${new Date(since).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
              : 'Direct introductions and invitation tracking'}
          </Text>
        </View>

        {/* Tab Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('all')}
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('SENT')}
            style={[styles.tabBtn, activeTab === 'SENT' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'SENT' && styles.tabBtnTextActive]}>
              Interest sent ({counts.SENT})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('ACCEPTED')}
            style={[styles.tabBtn, activeTab === 'ACCEPTED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'ACCEPTED' && styles.tabBtnTextActive]}>
              Accepted ({counts.ACCEPTED})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('NOT_ACCEPTED')}
            style={[styles.tabBtn, activeTab === 'NOT_ACCEPTED' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'NOT_ACCEPTED' && styles.tabBtnTextActive]}>
              Not accepted ({counts.NOT_ACCEPTED})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={color.text} size="small" />
            <Text style={styles.loadingText}>Loading interests…</Text>
          </View>
        ) : counts.all === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Interests sent yet</Text>
            <Text style={styles.emptyBody}>
              Discover candidates on the feed or shortlist and send an Interest to initiate a conversation.
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
            <Text style={styles.emptyTitle}>No entries in this tab</Text>
            <Text style={styles.emptyBody}>No candidates currently match this status.</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('all')}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>View all</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const outcome = liveInterestOutcome(row, now)
              const canResend =
                row.available &&
                outcome !== 'SENT' &&
                (!row.nextEligibleAt || new Date(row.nextEligibleAt).getTime() <= now.getTime())

              return (
                <View
                  key={row.id}
                  style={[styles.card, !row.available && styles.cardUnavailable]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.posterBox}>
                      {row.posterUrl ? (
                        <Image source={{ uri: row.posterUrl }} style={styles.posterImg} />
                      ) : (
                        <View style={styles.posterPlaceholder}>
                          <Text style={styles.monogramLetter}>{row.name.charAt(0)}</Text>
                        </View>
                      )}
                    </View>

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
                        {row.city || 'India'} · Sent{' '}
                        {new Date(row.sentAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </Text>

                      {row.job && (
                        <View style={styles.jobPill}>
                          <Text style={styles.jobPillText}>For: {row.job.title}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {row.message && (
                    <View style={styles.messageBox}>
                      <Text style={styles.messageText} numberOfLines={2}>
                        &ldquo;{row.message}&rdquo;
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardFoot}>
                    {outcome === 'ACCEPTED' ? (
                      <View style={styles.statusRow}>
                        <View style={styles.slotBadgeSuccess}>
                          <Text style={styles.slotBadgeSuccessText}>✓ Accepted</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={styles.actionBtnPrimary}
                        >
                          <Text style={styles.actionBtnPrimaryText}>Open chat</Text>
                        </TouchableOpacity>
                      </View>
                    ) : outcome === 'SENT' ? (
                      <View style={styles.statusCol}>
                        <View style={styles.slotBadgeAccent}>
                          <Text style={styles.slotBadgeAccentText}>Interest sent · Pending</Text>
                        </View>
                        <Text style={styles.expiresText}>
                          Expires {new Date(row.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.statusRow}>
                        <View style={styles.slotBadgeMuted}>
                          <Text style={styles.slotBadgeMutedText}>Not accepted</Text>
                        </View>
                        {canResend ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                              navigation.navigate('SendInterest', {
                                candidateId: row.candidateId,
                                candidateName: row.name,
                                candidateCity: row.city,
                              })
                            }
                            style={styles.resendBtn}
                          >
                            <Text style={styles.resendBtnText}>Resend</Text>
                          </TouchableOpacity>
                        ) : row.nextEligibleAt && new Date(row.nextEligibleAt).getTime() > now.getTime() ? (
                          <Text style={styles.cooldownDate}>
                            Eligible {new Date(row.nextEligibleAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </Text>
                        ) : null}
                      </View>
                    )}
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
  title: {
    fontFamily: fontFamilyNative.display,
    fontSize: 24,
    color: color.text,
  },
  subtitle: {
    fontSize: 12,
    color: color.textMuted,
  },
  tabRow: {
    gap: 6,
    paddingVertical: 2,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  tabBtnActive: {
    backgroundColor: color.text,
  },
  tabBtnText: {
    fontSize: 12,
    color: color.textMuted,
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: color.textInverse,
    fontWeight: '600',
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
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
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
    fontSize: 18,
    color: color.textSubtle,
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
  messageBox: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    padding: 8,
  },
  messageText: {
    fontSize: 12,
    color: color.text,
    fontStyle: 'italic',
  },
  cardFoot: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusCol: {
    gap: 2,
  },
  slotBadgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  slotBadgeSuccessText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.success,
  },
  slotBadgeAccent: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  slotBadgeAccentText: {
    fontSize: 10,
    fontWeight: '600',
    color: color.accent,
  },
  slotBadgeMuted: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  slotBadgeMutedText: {
    fontSize: 10,
    color: color.textMuted,
  },
  expiresText: {
    fontSize: 10,
    color: color.textMuted,
    marginTop: 2,
  },
  cooldownDate: {
    fontSize: 10,
    fontFamily: fontFamilyNative.mono,
    color: color.textMuted,
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
  resendBtn: {
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  resendBtnText: {
    fontSize: 11,
    color: color.text,
    fontWeight: '500',
  },
})
