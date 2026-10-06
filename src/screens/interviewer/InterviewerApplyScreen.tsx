import React, { useState } from 'react'
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, fontSize, height, leadingNative, opacity, radius, space, spaceHalf } from '../../theme'
import { Banner } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import {
  AButton, AChips, AField, AInput, APhone, BrandScreen, DropTile, FieldRow, Section, SheetTitle, Swap, useFieldFocus,
} from '../../components/auth/kit'
import { useAuthConfig } from '../../components/auth/config'
import { CONNECTION_DROPPED } from '../employer/EmployerRegisterScreen'
import { ApiClientError, ErrorCode } from '../../lib/api'
import { getResumeUploadUrl, submitInterviewerApplication, type InterviewerApplicationInput } from '../../lib/api/interviewer'
import { pickChatDocument, type ChatFile } from '../../lib/chat/upload'
import type { RootStackParamList } from '../../../App'

type Key = 'name' | 'email' | 'mobile' | 'city' | 'background' | 'yearsExperience' | 'linkedinUrl' | 'domains' | 'languages' | 'resume'
type Errs = Partial<Record<Key, string>>
const ORDER: Key[] = ['name', 'email', 'mobile', 'city', 'background', 'yearsExperience', 'linkedinUrl', 'resume', 'domains', 'languages']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^[6-9]\d{9}$/
/** contracts/interviewer.ts interviewerApplicationInput — the server's own bounds. */
const LIMIT = { background: { min: 20, max: 2000 }, years: 60, picks: 12 }

/** The three things that happen after an application, in the order they happen (the mockup's next steps). */
const NEXT_STEPS = ['A person on our team reads it', 'If we go ahead, we create your account', 'Your sign-in details arrive by email']

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
 * Apply to interview, drawn as direction C (docs/registration-mockups.html
 * ?dir=C&flow=interviewer): About you, Your experience, What you can interview
 * for, then the "Application received." state. The body POST
 * /interviewers/apply validates: name, email, mobile, city, background (20+
 * characters), years, the domains and languages (the same master lists the
 * admin approves against — `config.masterData`), and an optional employer,
 * LinkedIn and résumé (PDF or Word, uploaded before submit).
 */
export function InterviewerApplyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const config = useAuthConfig()
  const ff = useFieldFocus<Key>()

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

  const domainOptions = config.data?.masterData?.domains?.map((d) => d.name) ?? []
  const languageOptions = config.data?.masterData?.languages?.map((l) => l.name) ?? []
  const resumeMaxBytes = config.data?.uploads?.RESUME?.maxBytes
  const resumeRule = resumeMaxBytes ? `PDF or Word · up to ${Math.round(resumeMaxBytes / (1024 * 1024))} MB` : 'PDF or Word'

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

  /** The banner at the top of the form, then the first field that needs an answer. */
  function land(found: Errs) {
    const first = ORDER.find((k) => found[k])
    requestAnimationFrame(() => (first ? ff.to(first) : ff.scroller.current?.scrollTo({ y: 0, animated: true })))
  }

  async function submit() {
    if (busy || uploadPct !== null) return
    const e = check()
    setErrs(e)
    setError(null)
    if (Object.keys(e).length) {
      setError('Some fields need attention.')
      land(e)
      return
    }
    Keyboard.dismiss()
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
        const found: Errs = {
          name: f.name, email: f.email, mobile: f.mobile, city: f.city, background: f.background,
          yearsExperience: f.yearsExperience, linkedinUrl: f.linkedinUrl, domains: f.domains, languages: f.languages, resume: f.resumeKey,
        }
        setErrs(found)
        setError('Some fields need attention.')
        land(found)
      } else {
        setError(err instanceof ApiClientError ? err.message : CONNECTION_DROPPED)
        requestAnimationFrame(() => ff.scroller.current?.scrollTo({ y: 0, animated: true }))
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <BrandScreen footer={<AButton label="Done" onPress={() => navigation.navigate('JoinUs')} />}>
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <Icon name="check" size={spaceHalf['6'] + spaceHalf['1.5']} tint={color.success} weight={2.4} />
          </View>
          <SheetTitle>Application received.</SheetTitle>
          <Text style={styles.doneBody}>{done}</Text>
          <View style={styles.steps}>
            {NEXT_STEPS.map((t, i) => (
              <View key={t} style={styles.step}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </BrandScreen>
    )
  }

  const chips = (options: string[], list: string[], set: (v: string[]) => void, k: Key) =>
    config.isPending ? (
      <ActivityIndicator color={color.textSubtle} style={styles.start} />
    ) : options.length === 0 ? (
      <Text style={styles.muted}>The list didn’t load. Go back and open this page again.</Text>
    ) : (
      <AChips
        options={options.map((o) => ({ value: o, label: o }))}
        selected={list}
        invalid={!!errs[k]}
        onToggle={(o) => toggle(list, set, o, k)}
      />
    )

  return (
    <BrandScreen
      title="Apply to interview"
      sub="We read every application and reply by email."
      onBack={() => navigation.goBack()}
      scrollRef={ff.scroller}
      contentRef={ff.content}
      footer={
        <>
          <AButton
            busy={busy}
            disabled={uploadPct !== null}
            label={uploadPct !== null ? 'Uploading your CV…' : busy ? 'Sending your application…' : 'Submit application'}
            onPress={() => { submit() }}
          />
          <Swap lead="Already an interviewer?" action="Sign in" onPress={() => navigation.navigate('SignIn')} />
        </>
      }
    >
      {!!error && <View style={styles.banner}><Banner tone="danger">{error}</Banner></View>}

      <Section title="About you" first>
        <AField label="Full name" error={errs.name} anchorRef={ff.anchor('name')}>
          <AInput
            icon="user"
            inputRef={ff.input('name')}
            value={name}
            onChangeText={(v) => { setName(v); clear('name') }}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            invalid={!!errs.name}
            editable={!busy}
          />
        </AField>
        <AField
          label="Email"
          helper="We write to you here, and it becomes your sign-in if you’re approved."
          error={errs.email}
          anchorRef={ff.anchor('email')}
        >
          <AInput
            icon="mail"
            inputRef={ff.input('email')}
            value={email}
            onChangeText={(v) => { setEmail(v); clear('email') }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            invalid={!!errs.email}
            editable={!busy}
          />
        </AField>
        <AField label="Mobile" error={errs.mobile} anchorRef={ff.anchor('mobile')}>
          <APhone
            inputRef={ff.input('mobile')}
            value={mobile}
            onChangeText={(v) => { setMobile(v.replace(/\D/g, '')); clear('mobile') }}
            invalid={!!errs.mobile}
            editable={!busy}
          />
        </AField>
        <AField label="City" error={errs.city} anchorRef={ff.anchor('city')}>
          <AInput
            icon="pin"
            inputRef={ff.input('city')}
            value={city}
            onChangeText={(v) => { setCity(v); clear('city') }}
            placeholder="Where you live"
            autoCapitalize="words"
            textContentType="addressCity"
            maxLength={60}
            invalid={!!errs.city}
            editable={!busy}
          />
        </AField>
      </Section>

      <Section title="Your experience">
        <AField
          label="Your background"
          hint={`${background.trim().length} / ${LIMIT.background.max}`}
          helper={`At least ${LIMIT.background.min} characters.`}
          error={errs.background}
          anchorRef={ff.anchor('background')}
        >
          <AInput
            area
            inputRef={ff.input('background')}
            value={background}
            onChangeText={(v) => { setBackground(v); clear('background') }}
            maxLength={LIMIT.background.max}
            placeholder="Where you have hired, for which roles, and how you run interviews"
            invalid={!!errs.background}
            editable={!busy}
          />
        </AField>
        <AField label="Current employer" optional>
          <AInput
            icon="brief"
            value={employer}
            onChangeText={setEmployer}
            placeholder="Where you work now"
            autoCapitalize="words"
            maxLength={120}
            editable={!busy}
          />
        </AField>
        <FieldRow>
          <AField label="Years" error={errs.yearsExperience} anchorRef={ff.anchor('yearsExperience')} style={styles.years}>
            <AInput
              inputRef={ff.input('yearsExperience')}
              value={years}
              onChangeText={(v) => { setYears(v.replace(/\D/g, '').slice(0, 2)); clear('yearsExperience') }}
              placeholder="0"
              keyboardType="number-pad"
              invalid={!!errs.yearsExperience}
              editable={!busy}
            />
          </AField>
          <AField label="LinkedIn profile" optional error={errs.linkedinUrl} anchorRef={ff.anchor('linkedinUrl')} style={styles.linkedin}>
            <AInput
              inputRef={ff.input('linkedinUrl')}
              value={linkedin}
              onChangeText={(v) => { setLinkedin(v); clear('linkedinUrl') }}
              placeholder="https://www.linkedin.com/in/…"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              invalid={!!errs.linkedinUrl}
              editable={!busy}
            />
          </AField>
        </FieldRow>
        <AField label="CV / résumé" optional error={errs.resume} anchorRef={ff.anchor('resume')}>
          {file ? (
            <DropTile
              glyph="file"
              title={file.name}
              sub={uploadPct !== null ? `Uploading · ${Math.round(uploadPct * 100)}%` : resumeKey ? 'Uploaded' : undefined}
              trailing={
                uploadPct === null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove"
                    hitSlop={space.sm}
                    onPress={() => { setFile(null); setResumeKey(null) }}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Icon name="x" size={space.lg} tint={color.textMuted} />
                  </Pressable>
                ) : null
              }
            />
          ) : (
            <DropTile title="Choose a file" sub={resumeRule} disabled={busy} onPress={() => { chooseResume() }} />
          )}
        </AField>
      </Section>

      <Section title="What you can interview for" sub={`Choose one or more · up to ${LIMIT.picks} each.`}>
        <AField label="Domains" error={errs.domains} anchorRef={ff.anchor('domains')}>
          {chips(domainOptions, domains, setDomains, 'domains')}
        </AField>
        <AField label="Languages" error={errs.languages} anchorRef={ff.anchor('languages')}>
          {chips(languageOptions, languages, setLanguages, 'languages')}
        </AField>
      </Section>
    </BrandScreen>
  )
}

const styles = StyleSheet.create({
  banner: { marginBottom: space.md },
  muted: { fontFamily: fontFamilyNative.body, fontSize: fontSize['ui-sm'], color: color.textMuted },
  pressed: { opacity: opacity.pressed },
  start: { alignSelf: 'flex-start' },
  years: { flex: 1, minWidth: 0 },
  linkedin: { flex: 2, minWidth: 0 },

  done: { alignItems: 'center', gap: space.md, paddingTop: space['3xl'] },
  doneMark: {
    width: height['deck-action'], height: height['deck-action'], borderRadius: radius.pill,
    backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center',
  },
  doneBody: {
    fontFamily: fontFamilyNative.body, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'],
    color: color.textMuted, textAlign: 'center',
  },
  steps: {
    alignSelf: 'stretch', gap: spaceHalf['2.5'], padding: space.lg, marginTop: space.xs,
    backgroundColor: color.surface, borderRadius: radius['card-lg'], borderWidth: borderWidth.thin, borderColor: color.border,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  stepNum: {
    width: height.glyph, height: height.glyph, borderRadius: radius.pill, backgroundColor: color.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontFamily: fontFamilyNative.bodyBold, fontSize: fontSize['ui-xs'], color: color.accentText, fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, fontFamily: fontFamilyNative.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.text },
})
