import React, { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { ApiClientError } from '../../lib/api'
import { updateInterviewerProfile } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { pickAvatar, uploadAvatar, type AvatarFile } from '../../lib/interviewer/avatar'
import { BIO_MAX, hasChanges, initialsFrom, profileChanges, validateProfileDraft, type ProfileErrors } from '../../lib/interviewer/profile'
import { INTERVIEWER_KEY, useAppConfig, useInterviewerIdentity, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { AcChip, AcDisc, AcField, AcInput, AcLink, AcNotice, AcPage, AcPill, AcReadOnly, AcSheet, AcSkel, AcSmallBtn, SupportSheet, noticeText } from './accountKit'
import type { RootStackParamList } from '../../../App'

type Photo = { kind: 'keep' } | { kind: 'new'; file: AvatarFile } | { kind: 'removed' }
type Stage = 'idle' | 'saving' | 'saved' | 'error'
const SAVE_FAILED = 'Couldn’t save your profile. Nothing was changed. Check your connection and try again.'

/**
 * Edit profile (docs/interviewer-account-mockup.html, screen 1): the display
 * name, the photo, the languages interviewed in and a short bio — the only
 * things PATCH /interviewers/me/profile lets an interviewer change. Domains,
 * fees and load caps are the admin's and are drawn read-only. A new photo is
 * uploaded (POST …/avatar-upload, then a PUT to storage) when Save is pressed,
 * and its key goes in the same PATCH.
 */
export function InterviewerEditProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const { me, loading, refresh } = useInterviewerMe()
  const identity = useInterviewerIdentity()
  const config = useAppConfig()
  const p = me?.profile

  const base = { name: p?.name ?? identity?.name ?? '', languages: p?.languages ?? [], bio: p?.bio ?? '' }
  const [name, setName] = useState<string | null>(null)
  const [langs, setLangs] = useState<string[] | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Photo>({ kind: 'keep' })
  const [errs, setErrs] = useState<ProfileErrors>({})
  const [stage, setStage] = useState<Stage>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [photoSheet, setPhotoSheet] = useState(false)
  const [support, setSupport] = useState<string | null>(null)
  const leaving = useRef(false)

  const draft = { name: name ?? base.name, languages: langs ?? base.languages, bio: bio ?? base.bio }
  const photoKey = photo.kind === 'removed' ? null : photo.kind === 'new' ? 'pending' : undefined
  const dirty = !!p && hasChanges(profileChanges(base, draft, photoKey))
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (leaving.current || !dirtyRef.current) return
    e.preventDefault()
    Alert.alert('Discard your changes?', 'What you edited on this screen hasn’t been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { leaving.current = true; navigation.dispatch(e.data.action) } },
    ])
  }), [navigation])

  const touched = () => { if (stage === 'error' || stage === 'saved') { setStage('idle'); setMessage(null) } }
  const toggleLang = (l: string) => {
    touched()
    setErrs((x) => ({ ...x, languages: undefined }))
    setLangs((cur) => { const c = cur ?? base.languages; return c.includes(l) ? c.filter((v) => v !== l) : [...c, l] })
  }

  const options = Array.from(new Set([...(config?.masterData?.languages?.map((l) => l.name) ?? []), ...base.languages]))
  const avatarUri = photo.kind === 'new' ? photo.file.uri : photo.kind === 'removed' ? null : p?.avatarUrl
  const hasPhoto = !!avatarUri

  async function choose(source: 'library' | 'camera') {
    setPhotoSheet(false)
    try {
      const file = await pickAvatar(source)
      if (file) { touched(); setPhoto({ kind: 'new', file }) }
    } catch (e) {
      setStage('error')
      setMessage(e instanceof Error ? e.message : 'The photo picker could not open on this phone.')
    }
  }

  async function save() {
    const e = validateProfileDraft(draft)
    setErrs(e)
    if (Object.keys(e).length || !dirty || stage === 'saving') return
    setStage('saving')
    setMessage(null)
    try {
      const key = photo.kind === 'new' ? await uploadAvatar(photo.file) : photo.kind === 'removed' ? null : undefined
      await updateInterviewerProfile(profileChanges(base, draft, key))
      // The server has the change; refresh the cached profile in the background rather than holding the confirmation for it.
      void qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
      setStage('saved')
      setTimeout(() => { leaving.current = true; navigation.goBack() }, 900)
    } catch (err) {
      if (err instanceof ApiClientError && err.fields && (err.fields.name || err.fields.languages || err.fields.bio)) {
        setErrs({ name: err.fields.name, languages: err.fields.languages, bio: err.fields.bio })
        setMessage(null)
      } else {
        setMessage(err instanceof ApiClientError || err instanceof Error ? err.message || SAVE_FAILED : SAVE_FAILED)
      }
      setStage('error')
    }
  }

  const managed: { icon: IconName; label: string; value: string }[] = [
    !!p?.domains?.length && { icon: 'tag' as IconName, label: 'Domains', value: p.domains.join(', ') },
    !!p && (p.tiers ?? []).some((t) => typeof p.feePaise?.[t] === 'number') && {
      icon: 'wallet' as IconName, label: 'Fee per interview',
      value: (p.tiers ?? []).filter((t) => typeof p.feePaise?.[t] === 'number').map((t) => `${t} ${formatPaise(p.feePaise![t]!)}`).join(' · '),
    },
    (p?.loadCaps?.perDay != null || p?.loadCaps?.perWeek != null) && {
      icon: 'pie' as IconName, label: 'Load cap',
      value: [p?.loadCaps?.perDay != null ? `${p.loadCaps.perDay} a day` : null, p?.loadCaps?.perWeek != null ? `${p.loadCaps.perWeek} a week` : null].filter(Boolean).join(' · '),
    },
  ].filter(Boolean) as { icon: IconName; label: string; value: string }[]

  const footer = stage === 'saved'
    ? <AcPill tone="ok" icon="checkCircle" label="Saved" />
    : <AcPill tone={dirty ? 'on' : 'off'} label="Save changes" busy={stage === 'saving'} onPress={() => { void save() }} />

  return (
    <AcPage title="Edit profile" onBack={() => navigation.goBack()} footer={me ? footer : undefined}>
      {!me ? (
        loading ? (
          <View style={st.gap}><AcSkel h={84} w={84} r={42} /><AcSkel h={48} r={13} /><AcSkel h={48} r={13} /><AcSkel h={92} r={13} /></View>
        ) : (
          <AcNotice tone="error"><Text style={noticeText('error')}><Text style={st.bold}>Couldn’t load your profile.</Text>{' '}<Text onPress={() => { void refresh() }} style={st.retry}>Try again</Text></Text></AcNotice>
        )
      ) : (
        <>
          {stage === 'error' && <AcNotice tone="error"><Text style={noticeText('error')}>{message ?? SAVE_FAILED}</Text></AcNotice>}
          {stage === 'saved' && <AcNotice tone="ok"><Text style={noticeText('ok')}>Profile saved.</Text></AcNotice>}

          <View style={st.photo}>
            <AcDisc size={84} initials={initialsFrom(draft.name)} uri={avatarUri} />
            <AcSmallBtn icon="image" label={hasPhoto ? 'Change photo' : 'Add photo'} onPress={() => setPhotoSheet(true)} />
          </View>

          <AcField label="Display name" error={errs.name} hint="As candidates and admins see it. 2 to 80 characters.">
            <AcInput bad={!!errs.name} value={draft.name} onChangeText={(v) => { touched(); setErrs((x) => ({ ...x, name: undefined })); setName(v) }} autoComplete="name" placeholder="Your full name" accessibilityLabel="Display name" editable={stage !== 'saving'} />
          </AcField>

          <AcField label="Languages you interview in" right={<Text style={st.hint}>Pick at least one</Text>} error={errs.languages}>
            <View style={st.chips}>{options.map((l) => <AcChip key={l} label={l} on={draft.languages.includes(l)} onPress={() => toggleLang(l)} />)}</View>
          </AcField>

          <AcField label="Short bio" right={<Text style={[st.count, draft.bio.length > BIO_MAX && { color: color.danger }]}>{`${draft.bio.length}/${BIO_MAX}`}</Text>} error={errs.bio}>
            <AcInput multiline bad={!!errs.bio} value={draft.bio} onChangeText={(v) => { touched(); setErrs((x) => ({ ...x, bio: undefined })); setBio(v) }} placeholder="One or two lines about your interviewing background (optional)" accessibilityLabel="Short bio" editable={stage !== 'saving'} />
          </AcField>

          {managed.length > 0 && (
            <View style={st.managed}>
              <Text style={st.managedTitle}>Managed by Apostrophe</Text>
              {managed.map((m) => <AcReadOnly key={m.label} label={m.label} value={m.value} />)}
              <View style={st.mg}>
                <Icon name="info" size={15} tint={color.textMuted} weight={1.9} />
                <Text style={st.mgText}>{'These are set by Apostrophe. To change one, '}<AcLink label="talk to support" onPress={() => setSupport('Profile change request')} />{'.'}</Text>
              </View>
            </View>
          )}
          <Text style={st.mgText}>Email and mobile are your sign-in: see Contact and verification.</Text>
        </>
      )}

      <AcSheet open={photoSheet} title="Profile photo" onClose={() => setPhotoSheet(false)}>
        <Opt icon="user" label="Take a photo" onPress={() => { void choose('camera') }} />
        <Opt icon="image" label="Choose from library" onPress={() => { void choose('library') }} />
        {hasPhoto && <Opt icon="trash" label="Remove photo" danger onPress={() => { touched(); setPhoto({ kind: 'removed' }); setPhotoSheet(false) }} />}
        <AcPill tone="outline" label="Cancel" onPress={() => setPhotoSheet(false)} />
      </AcSheet>
      <SupportSheet subject={support} onClose={() => setSupport(null)} />
    </AcPage>
  )
}

function Opt({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const c = danger ? color.danger : color.text
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.opt, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={19} tint={danger ? color.danger : color.textSecondary} weight={1.9} />
      <Text style={[st.optText, { color: c }]}>{label}</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  gap: { gap: 14 },
  bold: { fontFamily: FF.bodyBold },
  retry: { fontFamily: FF.bodyBold, color: color.danger, textDecorationLine: 'underline' },
  photo: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: FF.body, fontSize: 12.5, color: color.textMuted },
  count: { fontFamily: FF.bodyMedium, fontSize: 12, fontVariant: ['tabular-nums'], color: color.textMuted },
  managed: { gap: 12, paddingTop: 14, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  managedTitle: { fontFamily: FF.bodySemiBold, fontSize: 13, color: color.text },
  mg: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  mgText: { flex: 1, fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted },
  opt: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6 },
  optText: { fontFamily: FF.bodySemiBold, fontSize: 15 },
})
