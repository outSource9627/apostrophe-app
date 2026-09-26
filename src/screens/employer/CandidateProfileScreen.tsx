import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmError } from '../../components/employer/em'
import { FeedFace } from '../../components/employer/feed'
import { ClipPlayer, ProfileFacts, ProfileSections, VerifiedInterviewBadge } from '../../components/employer/profile'
import { ApiClientError } from '../../lib/api'
import {
  fetchCandidateDetail, fetchCandidateDocument, playSelfVideo, postSwipe, type CandidateDetail,
} from '../../lib/api/employerFeed'
import { interviewDate, nameInitials, tierLine } from '../../lib/employer/candidateFormat'
import { SendInterestSheet } from './SendInterestModal'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateProfile'>

/** Past this, the bar carries the name (EM-09b). */
const FILM_H = height['profile-film']

/**
 * EM-09 · the candidate profile page (from the shortlist, Interests, a
 * connection or an applicant): the 9:16 film (muted; a tap turns the sound on),
 * the name and the three facts; scrolled (EM-09b), the bar carries the name and
 * the verified-interview date, and the page goes on to Watch full interview and
 * the sections. The foot shortlists (a right swipe, as on the card) and sends an
 * Interest — the same sheet as everywhere.
 */
export function CandidateProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const focused = useIsFocused()
  const { id } = route.params

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [muted, setMuted] = useState(true)
  const [shortlisting, setShortlisting] = useState(false)
  const [interestOpen, setInterestOpen] = useState(false)
  const [clip, setClip] = useState<{ url: string; title?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    fetchCandidateDetail(id)
      .then(setCandidate)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the profile.'))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const back = () => navigation.goBack()

  if (!candidate) {
    return (
      <EmployerShell back={back}>
        {error ? (
          <EmError title="Couldn’t load this profile." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={load} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </EmployerShell>
    )
  }

  const c = candidate
  const date = c.verifiedInterview?.verified ? interviewDate(c.verifiedInterview.at) : null
  const poster = c.posterUrl ?? c.photoUrl
  const interestLocked = c.interest === 'SENT' || c.interest === 'ACCEPTED'
  const openFull = () => navigation.navigate('CandidateVideo', { id: c.id, name: c.name, photoUrl: c.photoUrl, interviewAt: c.verifiedInterview?.at })

  async function shortlist() {
    setShortlisting(true)
    setNotice(null)
    try {
      await postSwipe(c.id, 'RIGHT')
      setCandidate((prev) => (prev ? { ...prev, shortlisted: true } : prev))
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not shortlisted. Try again.')
    } finally {
      setShortlisting(false)
    }
  }

  async function playClip(videoId: string) {
    setNotice(null)
    try {
      const r = await playSelfVideo(c.id, videoId)
      setClip({ url: r.url, title: c.videos.find((v) => v.id === videoId)?.title ?? undefined })
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The clip did not load. Try again.')
    }
  }

  async function openDocument(docId: string) {
    setNotice(null)
    setOpeningDoc(docId)
    try {
      const r = await fetchCandidateDocument(c.id, docId)
      await Linking.openURL(r.url)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'The document did not open. Try again.')
    } finally {
      setOpeningDoc(null)
    }
  }

  return (
    <EmployerShell
      back={back}
      title={scrolled ? c.name : undefined}
      sub={scrolled && date ? `VERIFIED INTERVIEW · ${date.toUpperCase()}` : undefined}
      barBorder={scrolled}
      onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > FILM_H)}
      footer={
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.shortlisted ? 'Shortlisted' : 'Shortlist'}
            accessibilityState={{ disabled: c.shortlisted || shortlisting, selected: c.shortlisted }}
            disabled={c.shortlisted || shortlisting}
            onPress={() => { shortlist() }}
            style={({ pressed }) => [styles.save, pressed && styles.pressed]}
          >
            {shortlisting ? <ActivityIndicator color={color.textInverse} /> : (
              <Icon name="bookmark" size={space.xl} tint={color.textInverse} weight={2} fill={c.shortlisted ? color.textInverse : 'none'} />
            )}
          </Pressable>
          <Button
            variant="primary"
            size="lg"
            label={c.interest === 'ACCEPTED' ? 'Connected' : c.interest === 'SENT' ? 'Interest sent' : 'Send Interest'}
            disabled={interestLocked}
            style={styles.grow}
            onPress={() => setInterestOpen(true)}
          />
        </>
      }
    >
      <View style={styles.film}>
        {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        {!poster && !c.streamUrl && (
          <View style={styles.initialsWrap}><Text style={[text.displayPoster, styles.initials]}>{nameInitials(c.name)}</Text></View>
        )}
        {!!c.streamUrl && (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'} onPress={() => setMuted((m) => !m)} style={StyleSheet.absoluteFill}>
            <Video source={{ uri: c.streamUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" muted={muted} repeat paused={!focused || interestOpen || !!clip} />
          </Pressable>
        )}
        {c.verifiedInterview?.verified && (
          <View style={styles.filmPill} pointerEvents="none">
            <Icon name="check" size={space.md + 1} tint={color.successOnInk} weight={2.4} />
            <Text style={[text.uiXsMedium, styles.onInk]}>Verified video resume · 9:16</Text>
          </View>
        )}
        {!!c.streamUrl && (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn the sound on' : 'Mute'} onPress={() => setMuted((m) => !m)} style={styles.sound}>
            <Icon name={muted ? 'mute' : 'sound'} size={spaceHalf['4.5']} tint={color.textOnInk} />
          </Pressable>
        )}
      </View>

      <VerifiedInterviewBadge candidate={c} />
      <View style={styles.who}>
        <FeedFace name={c.name} photo={c.photoUrl} size={height.control} />
        <View style={styles.grow}>
          <Text style={text.displayHeading}>{c.name}</Text>
          <Text style={[text.uiSm, styles.muted]}>{[tierLine(c.tier, c.qualification), c.city].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <ProfileFacts candidate={c} well={false} />

      {c.hasVideo !== false && <Button variant="outline" size="pair" icon="video" label="Watch full interview" onPress={openFull} />}
      {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}
      <ProfileSections candidate={c} onPlayClip={playClip} onOpenDocument={openDocument} openingDoc={openingDoc} />

      <SendInterestSheet
        open={interestOpen}
        candidate={{ id: c.id, name: c.name, photoUrl: c.photoUrl, tier: c.tier, qualification: c.qualification, city: c.city, verified: c.verifiedInterview?.verified }}
        onClose={() => setInterestOpen(false)}
        onSent={() => setCandidate((prev) => (prev ? { ...prev, interest: 'SENT' } : prev))}
      />
      <ClipPlayer url={clip?.url ?? null} title={clip?.title} onClose={() => setClip(null)} />
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  onInk: { color: color.textOnInk },
  loading: { paddingVertical: space['3xl'] },
  film: { height: FILM_H, borderRadius: radius.xl, backgroundColor: color.inkRaised, overflow: 'hidden' },
  initialsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.onInkWash },
  filmPill: { position: 'absolute', top: spaceHalf['3.5'], left: spaceHalf['3.5'], height: height['chip-sm'] - 2, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.ctl, backgroundColor: color.onInkGlass, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  sound: { position: 'absolute', right: space.md, bottom: space.md, width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.onInkPlay, alignItems: 'center', justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  save: { width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
})
