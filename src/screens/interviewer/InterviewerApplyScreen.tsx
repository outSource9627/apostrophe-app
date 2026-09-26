import React, { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Banner, Button, Field, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { IvLabel } from '../../components/interviewer/iv'
import { EmBar, EmChip, EmDone, EmFoot, EmTitle } from '../../components/employer/em'
import { CONNECTION_DROPPED } from '../employer/EmployerRegisterScreen'
import { ApiClientError, ErrorCode } from '../../lib/api'
import { getResumeUploadUrl, submitInterviewerApplication, type InterviewerApplicationInput } from '../../lib/api/interviewer'
import { pickChatDocument, type ChatFile } from '../../lib/chat/upload'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Key = 'name' | 'email' | 'mobile' | 'city' | 'background' | 'yearsExperience' | 'linkedinUrl' | 'domains' | 'languages' | 'resume'
type Errs = Partial<Record<Key, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^[6-9]\d{9}$/
/** contracts/interviewer.ts interviewerApplicationInput — the server's own bounds. */
const LIMIT = { background: { min: 20, max: 2000 }, years: 60, picks: 12 }

/** PUTs the file to the presigned URL the public résumé route hands out. */
async function uploadResume(file: ChatFile, onProgress: (f: number) => void): Promise<string> {
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new Error(`${file.name} could not be read from this phone.`)
  }
  const sizeBytes = body.size || file.size
  let presigned: Awaited<ReturnType<typeof getResumeUploadUrl>>
  try {
    presigned = await getResumeUploadUrl({ contentType: file.type, sizeBytes })
  } catch (e) {
    throw new Error(e instanceof ApiClientError ? e.message : CONNECTION_DROPPED)
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presigned.url)
    let typed = false
    for (const [k, v] of Object.entries(presigned.headers ?? {})) {
      if (k.toLowerCase() === 'content-length') continue
      if (k.toLowerCase() === 'content-type') typed = true
      xhr.setRequestHeader(k, v)
    }
    if (!typed) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload was refused. Try again.')))
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection.'))
    xhr.send(body)
  })
  return presigned.key
}

/**
 * Apply to interview (no artboard — the drawn screens' language). The body
 * POST /interviewers/apply validates: name, email, mobile, city, background
 * (20+ characters), years, the domains and languages (the same master lists
 * the admin approves against — `config.masterData`), and an optional employer,
 * LinkedIn and résumé (PDF or Word, uploaded before submit). The old screen
 * sent `phone`, `bio`, `domain` and `resumeUrl`, none of which the server
 * reads, so every application came back 400.
 */
export function InterviewerApplyScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const config = useAppConfig()
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [city, setCity] = useState('')
  const [background, setBackground] = useState('')
  const [employer, setEmployer] = useState('')
  const [years, setYears] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [file, setFile] = useState<ChatFile | null>(null)
  const [resumeKey, setResumeKey] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [errs, setErrs] = useState<Errs>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const domainOptions = config?.masterData?.domains?.map((d) => d.name) ?? []
  const languageOptions = config?.masterData?.languages?.map((l) => l.name) ?? []
  const clear = (k: Key) => { if (errs[k]) setErrs((x) => ({ ...x, [k]: undefined })) }
  const toggle = (list: string[], set: (v: string[]) => void, v: string, k: Key) => {
    if (list.includes(v)) set(list.filter((x) => x !== v))
    else if (list.length < LIMIT.picks) set([...list, v])
    clear(k)
  }

  async function chooseResume() {
    setErrs((x) => ({ ...x, resume: undefined }))
    let picked: ChatFile | null
    try {
      picked = await pickChatDocument()
    } catch (e) {
      setErrs((x) => ({ ...x, resume: e instanceof Error ? e.message : 'The file picker could not open.' }))
      return
    }
    if (!picked) return
    setFile(picked)
    setResumeKey(null)
    setUploadPct(0)
    try {
      setResumeKey(await uploadResume(picked, setUploadPct))
    } catch (e) {
      setErrs((x) => ({ ...x, resume: e instanceof Error ? e.message : 'Could not upload the file. Try again.' }))
      setFile(null)
    } finally {
      setUploadPct(null)
    }
  }

  function check(): Errs {
    const e: Errs = {}
    const digits = mobile.replace(/\D/g, '').slice(-10)
    if (name.trim().length < 2) e.name = 'Enter your full name'
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address'
    if (!MOBILE_RE.test(digits)) e.mobile = 'Enter a valid 10-digit Indian mobile number'
    if (city.trim().length < 2) e.city = 'Enter the city you live in'
    if (background.trim().length < LIMIT.background.min) e.background = `Tell us a little more (at least ${LIMIT.background.min} characters)`
    const y = Number(years)
    if (years.trim() === '' || !Number.isInteger(y) || y < 0 || y > LIMIT.years) e.yearsExperience = 'Enter whole years'
    if (linkedin.trim() && !/^https?:\/\/\S+$/i.test(linkedin.trim())) e.linkedinUrl = 'Enter the full link, starting https://'
    if (domains.length === 0) e.domains = 'Pick at least one domain'
    if (languages.length === 0) e.languages = 'Pick at least one language'
    return e
  }

  async function submit() {
    if (busy || uploadPct !== null) return
    const e = check()
    setErrs(e)
    setError(null)
    if (Object.keys(e).length) {
      setError('Some fields need attention.')
      scroll.current?.scrollTo({ y: 0, animated: true })
      return
    }
    setBusy(true)
    const body: InterviewerApplicationInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.replace(/\D/g, '').slice(-10),
      city: city.trim(),
      background: background.trim(),
      yearsExperience: Number(years),
      domains,
      languages,
      currentEmployer: employer.trim() || undefined,
      linkedinUrl: linkedin.trim() || undefined,
      resumeKey: resumeKey ?? undefined,
    }
    try {
      const r = await submitInterviewerApplication(body)
      setDone(r.message)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === ErrorCode.VALIDATION && err.fields) {
        const f = err.fields
        setErrs({
          name: f.name, email: f.email, mobile: f.mobile, city: f.city, background: f.background,
          yearsExperience: f.yearsExperience, linkedinUrl: f.linkedinUrl, domains: f.domains, languages: f.languages, resume: f.resumeKey,
        })
        setError('Some fields need attention.')
      } else {
        setError(err instanceof ApiClientError ? err.message : CONNECTION_DROPPED)
      }
      scroll.current?.scrollTo({ y: 0, animated: true })
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <EmBar />
        <View style={styles.centre}>
          <EmDone
            icon="check"
            tone="green"
            title="Application received."
            body={done}
            actions={<View style={styles.grow}><Button variant="secondary" size="lg" full label="Done" onPress={() => navigation.navigate('JoinUs')} /></View>}
          />
        </View>
      </View>
    )
  }

  const chips = (options: string[], list: string[], set: (v: string[]) => void, k: Key) =>
    config === null ? (
      <ActivityIndicator color={color.textSubtle} style={styles.start} />
    ) : options.length === 0 ? (
      <Text style={[text.uiSm, styles.muted]}>The list didn’t load. Go back and open this page again.</Text>
    ) : (
      <View style={styles.chips}>
        {options.map((o) => <EmChip key={o} label={o} on={list.includes(o)} onPress={() => toggle(list, set, o, k)} />)}
      </View>
    )

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <EmBar onBack={() => navigation.goBack()} />
      <ScrollView ref={scroll} style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <EmTitle eyebrow="Interviewer" title="Apply to interview" sub="We read every application and reply by email." />
        {!!error && <Banner tone="danger">{error}</Banner>}

        <IvLabel>ABOUT YOU</IvLabel>
        <Field label="Full name" error={errs.name}>
          <Input value={name} onChangeText={(v) => { setName(v); clear('name') }} placeholder="Your name" autoComplete="name" textContentType="name" invalid={!!errs.name} editable={!busy} />
        </Field>
        <Field label="Email" helper="We write to you here, and it becomes your sign-in if you’re approved." error={errs.email}>
          <Input value={email} onChangeText={(v) => { setEmail(v); clear('email') }} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" invalid={!!errs.email} editable={!busy} />
        </Field>
        <Field label="Mobile" error={errs.mobile}>
          <Input value={mobile} onChangeText={(v) => { setMobile(v); clear('mobile') }} placeholder="10-digit mobile" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" invalid={!!errs.mobile} editable={!busy} />
        </Field>
        <Field label="City" error={errs.city}>
          <Input value={city} onChangeText={(v) => { setCity(v); clear('city') }} placeholder="Where you live" invalid={!!errs.city} editable={!busy} />
        </Field>

        <IvLabel style={styles.section}>YOUR EXPERIENCE</IvLabel>
        <Field label="Your background" helper={`At least ${LIMIT.background.min} characters · ${background.trim().length}/${LIMIT.background.max}`} error={errs.background}>
          <Input value={background} onChangeText={(v) => { setBackground(v); clear('background') }} maxLength={LIMIT.background.max} multiline textAlignVertical="top" placeholder="Where you have hired, for which roles, and how you run interviews" style={styles.area} invalid={!!errs.background} editable={!busy} />
        </Field>
        <Field label="Current employer (optional)">
          <Input value={employer} onChangeText={setEmployer} placeholder="Where you work now" maxLength={120} editable={!busy} />
        </Field>
        <Field label="Years of experience" helper="Whole years, across hiring and HR roles." error={errs.yearsExperience}>
          <Input value={years} onChangeText={(v) => { setYears(v.replace(/\D/g, '').slice(0, 2)); clear('yearsExperience') }} placeholder="0" keyboardType="number-pad" invalid={!!errs.yearsExperience} editable={!busy} />
        </Field>
        <Field label="LinkedIn profile (optional)" error={errs.linkedinUrl}>
          <Input value={linkedin} onChangeText={(v) => { setLinkedin(v); clear('linkedinUrl') }} placeholder="https://www.linkedin.com/in/your-name" keyboardType="url" autoCapitalize="none" autoCorrect={false} invalid={!!errs.linkedinUrl} editable={!busy} />
        </Field>
        <Field label="CV / résumé (optional)" error={errs.resume}>
          {file ? (
            <View style={styles.file}>
              <View style={styles.fileMark}><Icon name="file" size={space.lg + 2} tint={color.accent} /></View>
              <View style={styles.grow}>
                <Text style={text.uiMdSemi} numberOfLines={1}>{file.name}</Text>
                <Text style={[text.uiXs, styles.muted]}>{uploadPct !== null ? `Uploading · ${Math.round(uploadPct * 100)}%` : resumeKey ? 'Uploaded' : ''}</Text>
              </View>
              {uploadPct === null && (
                <Pressable accessibilityRole="button" accessibilityLabel="Remove" hitSlop={space.sm} onPress={() => { setFile(null); setResumeKey(null) }} style={({ pressed }) => pressed && styles.pressed}>
                  <Icon name="x" size={space.lg} tint={color.textMuted} />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { chooseResume() }} disabled={busy} style={({ pressed }) => [styles.file, styles.fileEmpty, pressed && styles.pressed]}>
              <View style={styles.fileMark}><Icon name="upload" size={space.lg + 2} tint={color.accent} /></View>
              <View style={styles.grow}>
                <Text style={text.uiMdSemi}>Choose a file</Text>
                <Text style={[text.uiXs, styles.muted]}>PDF or Word</Text>
              </View>
            </Pressable>
          )}
        </Field>

        <IvLabel style={styles.section}>WHAT YOU CAN INTERVIEW FOR</IvLabel>
        <Field label="Domains" helper={`Choose one or more · up to ${LIMIT.picks}`} error={errs.domains}>
          {chips(domainOptions, domains, setDomains, 'domains')}
        </Field>
        <Field label="Languages" helper={`Up to ${LIMIT.picks}`} error={errs.languages}>
          {chips(languageOptions, languages, setLanguages, 'languages')}
        </Field>
      </ScrollView>
      <EmFoot>
        <View style={styles.grow}>
          <Button variant="primary" size="lg" full busy={busy} disabled={uploadPct !== null} label={uploadPct !== null ? 'Uploading your CV…' : 'Submit application'} onPress={() => { submit() }} />
        </View>
      </EmFoot>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['4.5'] },
  muted: { color: color.textMuted },
  pressed: { opacity: opacity.pressed },
  start: { alignSelf: 'flex-start' },
  section: { marginTop: space.sm },
  area: { height: height['note-field'] + space.xl, paddingTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: spaceHalf['3.5'], borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  fileEmpty: { borderStyle: 'dashed', borderColor: color.borderStrong },
  fileMark: { width: height.avatar, height: height.avatar, borderRadius: radius.tile, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
})
