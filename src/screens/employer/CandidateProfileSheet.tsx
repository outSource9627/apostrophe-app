import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmSheet } from '../../components/employer/em'
import { ClipPlayer, ProfileFacts, ProfileHead, ProfileSections } from '../../components/employer/profile'
import { ApiClientError } from '../../lib/api'
import {
  fetchCandidateDetail, fetchCandidateDocument, playSelfVideo, type CandidateCard, type CandidateDetail,
} from '../../lib/api/employerFeed'
import { SendInterestSheet } from './SendInterestModal'

/**
 * The feed's profile sheet (Employer Android, the EM-08 profile sheet): the
 * film thumb and the facts, Watch full interview, and the profile's sections —
 * self-uploaded clips play here, documents download through a 15-minute link.
 * The foot passes, shortlists or opens Send an Interest.
 */
export function CandidateProfileSheet({
  open, card, passDays, onClose, onPass, onShortlist, onOpenFull, onInterestSent,
}: {
  open: boolean
  card: CandidateCard
  passDays?: number
  onClose: () => void
  onPass: () => void
  onShortlist: () => void
  onOpenFull: () => void
  onInterestSent?: (candidateId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [detail, setDetail] = useState<CandidateDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interestOpen, setInterestOpen] = useState(false)
  const [clip, setClip] = useState<{ url: string; title?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setDetail(null)
    setError(null)
    setNotice(null)
    fetchCandidateDetail(card.id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load the profile.'))
    return () => {
      alive = false
    }
  }, [open, card.id])

  async function playClip(videoId: string) {
    setNotice(null)
    try {
      const r = await playSelfVideo(card.id, videoId)
      setClip({ url: r.url, title: detail?.videos.find((v) => v.id === videoId)?.title ?? undefined })
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The clip did not load. Try again.')
    }
  }

  async function openDocument(docId: string) {
    setNotice(null)
    setOpeningDoc(docId)
    try {
      const r = await fetchCandidateDocument(card.id, docId)
      await Linking.openURL(r.url)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The document did not open. Try again.')
    } finally {
      setOpeningDoc(null)
    }
  }

  const who = detail ?? card
  const interestSent = (detail?.interest ?? card.interest) === 'SENT'

  return (
    <>
      <EmSheet
        open={open && !interestOpen && !clip}
        onClose={onClose}
        tall
        foot={
          <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passDays ? `Pass, hidden for ${passDays} days` : 'Pass'}
              onPress={onPass}
              style={({ pressed }) => [styles.round, styles.pass, pressed && styles.pressed]}
            >
              <Icon name="x" size={space.xl + 2} tint={color.dangerFill} weight={2.2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shortlist"
              onPress={onShortlist}
              style={({ pressed }) => [styles.round, styles.save, pressed && styles.pressed]}
            >
              <Icon name="bookmark" size={space.xl} tint={color.textInverse} weight={2} />
            </Pressable>
            <Button
              variant="primary"
              size="lg"
              label={interestSent ? 'Interest sent' : 'Send Interest'}
              disabled={interestSent}
              style={styles.grow}
              onPress={() => setInterestOpen(true)}
            />
          </View>
        }
      >
        <ProfileHead candidate={who} onPlay={card.hasVideo ? onOpenFull : undefined} />
        <ProfileFacts candidate={who} />
        {card.hasVideo && <Button variant="outline" size="md" icon="video" label="Watch full interview" onPress={onOpenFull} />}
        {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}
        {detail ? (
          <ProfileSections candidate={detail} onPlayClip={playClip} onOpenDocument={openDocument} openingDoc={openingDoc} />
        ) : error ? (
          <View style={styles.state}>
            <Text style={[text.uiMd, styles.muted]}>{error}</Text>
          </View>
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.state} />
        )}
      </EmSheet>

      <SendInterestSheet
        open={open && interestOpen}
        candidate={{
          id: card.id,
          name: card.name,
          photoUrl: card.photoUrl,
          tier: card.tier,
          qualification: card.qualification,
          city: card.city,
          verified: card.verifiedInterview?.verified,
        }}
        onClose={() => setInterestOpen(false)}
        onSent={() => onInterestSent?.(card.id)}
      />

      <ClipPlayer url={clip?.url ?? null} title={clip?.title} onClose={() => setClip(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  state: { paddingVertical: space.xl },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
  round: { width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pass: { borderWidth: borderWidth.thin, borderColor: color.dangerBorder, backgroundColor: color.surface },
  save: { backgroundColor: color.ink },
})
