import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { DropZone } from '../../components/employer/DocumentSlot'
import { EmBadge, EmChip, EmDone, EmError, EmIconButton, EmSheet } from '../../components/employer/em'
import { EmDateField, EmField, EmSeg, EmSelect, todayIst, type Ymd } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { getConfig, type AppConfig } from '../../lib/api/config'
import {
  createEmployerJob, fetchEmployerJobDetail, submitEmployerJob, updateEmployerJob,
  type EmployerJobDetail, type JobDraftInput,
} from '../../lib/api/employerJobs'
import { pickVideo } from '../../lib/api/uploads'
import { VIDEO_CANCELLED, checkJobVideo, clock, endOfIstDay, hoursPhrase, uploadJobVideo, useJobConfig } from '../../lib/employer/jobs'
import { employmentLabel } from '../../lib/jobs/format'
import { label } from '../../lib/profile/labels'
import type { RootStackParamList } from '../../../App'

/** The design's benefit suggestions, as one-tap chips beside a free entry (benefits are free strings). */
const BENEFIT_SUGGESTIONS = ['Health insurance', 'PF', 'Shift allowance', 'Meals', 'Transport', 'Learning budget']
const QUAL_SHORT: Record<string, string> = { CLASS_12: 'Class 12', GRADUATION: 'Grad', POST_GRADUATION: 'PG', PHD: 'PhD' }

type Errors = Record<string, string>
type Video =
  | { phase: 'empty' }
  | { phase: 'up'; name: string; pct: number }
  | { phase: 'err'; name: string; msg: string }
  | { phase: 'ready'; name: string; durationSec: number; key?: string }

const digits = (v: string) => v.replace(/\D/g, '')
const grouped = (v: string) => (v ? Number(v).toLocaleString('en-IN') : '')
const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** The IST calendar day of an instant. */
function istYmd(iso: string): Ymd {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }
}

const STEP1 = ['title', 'category', 'department', 'vacancies', 'employmentType', 'description', 'responsibilities', 'requirements', 'minQualification']

/**
 * EM-18 · post a job, and (with an id) edit one — in the design's two steps:
 * the role and what it asks for, then pay, place, extras and the optional
 * vertical video. EM-18c is the video's states and the Submitted sheet.
 *
 * WHAT THE SERVER REQUIRES, and this screen mirrors: a post is saved whole, not
 * partially (title, category, a description of 30 characters, the minimum
 * qualification, both ends of the salary, a place and an employment type), and
 * submitting also needs a responsibility and a requirement. Editing a live or
 * paused post sends it back to moderation on the server; the screen says so.
 * Required skills are not drawn: the job takes master-data ids and nothing
 * resolves them for an employer (the web's call).
 */
export function JobEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'JobEditor'>>()
  const jobId = route.params?.id
  const { moderationHours, video: rule } = useJobConfig()

  const [config, setConfig] = useState<AppConfig | null>(null)
  const [existing, setExisting] = useState<EmployerJobDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(jobId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | undefined>(jobId)
  const [step, setStep] = useState<1 | 2>(1)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [department, setDepartment] = useState('')
  const [vacancies, setVacancies] = useState('1')
  const [employmentType, setEmploymentType] = useState('')
  const [description, setDescription] = useState('')
  const [responsibilities, setResponsibilities] = useState<string[]>([''])
  const [requirements, setRequirements] = useState<string[]>([''])
  const [minQualification, setMinQualification] = useState('')
  const [expMin, setExpMin] = useState('0')
  const [expMax, setExpMax] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [benefits, setBenefits] = useState<string[]>([])
  const [benefitDraft, setBenefitDraft] = useState('')
  const [joining, setJoining] = useState('')
  const [deadline, setDeadline] = useState<Ymd | null>(null)
  const [video, setVideo] = useState<Video>({ phase: 'empty' })
  const [hadVideo, setHadVideo] = useState(false)

  const [errors, setErrors] = useState<Errors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => { /* lists stay empty; the server still judges */ })
    return () => abort.current?.abort()
  }, [])

  useEffect(() => {
    if (!jobId) return
    let live = true
    fetchEmployerJobDetail(jobId)
      .then((j) => {
        if (!live) return
        setExisting(j)
        setTitle(j.title)
        setCategory(j.category ?? '')
        setDepartment(j.department ?? '')
        setVacancies(String(j.vacancies))
        setEmploymentType(j.employmentType ?? '')
        setDescription(j.description)
        setResponsibilities(j.responsibilities.length ? j.responsibilities : [''])
        setRequirements(j.requirements.length ? j.requirements : [''])
        setMinQualification(j.minQualification ?? '')
        setExpMin(String(j.experience.minYears))
        setExpMax(j.experience.maxYears == null ? '' : String(j.experience.maxYears))
        setSalaryMin(String(Math.round(j.salary.minPaise / 100)))
        setSalaryMax(String(Math.round(j.salary.maxPaise / 100)))
        setLocation(j.location ?? '')
        setRemote(j.remote)
        setBenefits(j.benefits)
        setJoining(j.joiningPreference ?? '')
        setDeadline(j.applicationDeadline ? istYmd(j.applicationDeadline) : null)
        if (j.video) {
          setHadVideo(true)
          setVideo({ phase: 'ready', name: 'Current job video', durationSec: j.video.durationSec })
        }
      })
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : 'Could not load this post.'))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [jobId])

  async function chooseVideo() {
    let file
    try {
      file = await pickVideo()
    } catch (e) {
      return setVideo({ phase: 'err', name: 'Video', msg: e instanceof Error ? e.message : 'The picker did not open.' })
    }
    if (!file) return
    const refused = checkJobVideo(file, rule)
    if (refused) return setVideo({ phase: 'err', name: file.name, msg: refused })
    const ctl = new AbortController()
    abort.current = ctl
    setVideo({ phase: 'up', name: file.name, pct: 0 })
    try {
      const key = await uploadJobVideo(file, { signal: ctl.signal, onProgress: (f) => setVideo({ phase: 'up', name: file.name, pct: Math.round(f * 100) }) })
      setVideo({ phase: 'ready', name: file.name, durationSec: file.durationSec, key })
      setErrors((e) => ({ ...e, video: '' }))
    } catch (e) {
      if (e instanceof Error && e.message === VIDEO_CANCELLED) return setVideo({ phase: 'empty' })
      setVideo({ phase: 'err', name: file.name, msg: e instanceof Error ? e.message : 'The upload did not finish.' })
    } finally {
      abort.current = null
    }
  }

  const setList = (set: (v: string[]) => void, list: string[], i: number, v: string) => set(list.map((x, j) => (j === i ? v : x)))
  const dropFrom = (set: (v: string[]) => void, list: string[], i: number) => set(list.length > 1 ? list.filter((_, j) => j !== i) : [''])

  function validate(forSubmit: boolean): Errors {
    const e: Errors = {}
    if (title.trim().length < 3) e.title = 'Give the role a title.'
    if (!category) e.category = 'Choose a category.'
    if (description.trim().length < 30) e.description = 'Describe the role in a few sentences (30 characters or more).'
    if (!minQualification) e.minQualification = 'Choose the minimum qualification.'
    if (!employmentType) e.employmentType = 'Choose an employment type.'
    if (!vacancies || Number(vacancies) < 1) e.vacancies = 'How many people are you hiring?'
    if (forSubmit) {
      if (!responsibilities.some((r) => r.trim())) e.responsibilities = 'List at least one responsibility.'
      if (!requirements.some((r) => r.trim())) e.requirements = 'List at least one requirement.'
    }
    if (location.trim().length < 2) e.location = 'Where is the role based?'
    if (!salaryMin) e.salaryMinPaise = 'Give the bottom of the salary range.'
    if (!salaryMax) e.salaryMaxPaise = 'Give the top of the salary range.'
    if (salaryMin && salaryMax && Number(salaryMax) < Number(salaryMin)) e.salaryMaxPaise = 'The top of the range cannot be below the bottom.'
    if (expMax !== '' && Number(expMax) < Number(expMin || 0)) e.experienceMaxYears = 'The top of the range cannot be below the bottom.'
    return e
  }

  function payload(): JobDraftInput {
    const clean = (l: string[]) => l.map((x) => x.trim()).filter(Boolean)
    const body: JobDraftInput = {
      title: title.trim(),
      category,
      department: department.trim() || undefined,
      vacancies: Number(vacancies),
      description: description.trim(),
      responsibilities: clean(responsibilities),
      requirements: clean(requirements),
      benefits: clean(benefits),
      minQualification,
      experienceMinYears: num(expMin) ?? 0,
      experienceMaxYears: num(expMax),
      salaryMinPaise: Number(salaryMin) * 100,
      salaryMaxPaise: Number(salaryMax) * 100,
      location: location.trim(),
      remote,
      employmentType,
      joiningPreference: joining || undefined,
      applicationDeadline: deadline ? endOfIstDay(deadline.y, deadline.m, deadline.d) : undefined,
    }
    if (video.phase === 'ready' && video.key) body.video = { key: video.key, durationSec: video.durationSec }
    else if (video.phase === 'empty' && hadVideo) body.video = null
    return body
  }

  function next() {
    const found = validate(false)
    const mine = Object.fromEntries(Object.entries(found).filter(([k]) => STEP1.includes(k)))
    const withLists = { ...mine, ...(responsibilities.some((r) => r.trim()) ? {} : { responsibilities: found.responsibilities ?? 'List at least one responsibility.' }), ...(requirements.some((r) => r.trim()) ? {} : { requirements: 'List at least one requirement.' }) }
    setErrors(withLists)
    if (Object.keys(withLists).length) return setBanner('Some fields need another look.')
    setBanner(null)
    setStep(2)
  }

  async function save(submit: boolean) {
    if (video.phase === 'up') return setBanner('Wait for the video to finish uploading, or remove it.')
    const found = validate(submit)
    setErrors(found)
    if (Object.keys(found).length) {
      if (Object.keys(found).some((k) => STEP1.includes(k))) setStep(1)
      return setBanner('Some fields need another look.')
    }
    setBanner(null)
    setBusy(submit ? 'submit' : 'draft')
    try {
      let id = savedId
      if (id) await updateEmployerJob(id, payload())
      else {
        id = (await createEmployerJob(payload())).id
        setSavedId(id)
      }
      const status = existing?.status ?? 'DRAFT'
      if (submit && status === 'DRAFT') await submitEmployerJob(id)
      if (submit || (existing && status !== 'DRAFT')) setSubmitted(true)
      else navigation.goBack()
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) {
        const f = { ...err.fields }
        if (f['video.durationSec']) f.video = f['video.durationSec']
        setErrors(f)
      }
      setBanner(err instanceof Error ? err.message : 'Could not save the post.')
    } finally {
      setBusy(null)
    }
  }

  const status = existing?.status
  const editingLive = status === 'PUBLISHED' || status === 'PAUSED'
  const isDraft = !status || status === 'DRAFT'
  const back = () => (step === 2 ? setStep(1) : navigation.goBack())
  const barTitle = jobId ? 'Edit job post' : 'New job post'

  if (loading || loadError || status === 'CLOSED') {
    return (
      <EmployerShell back={() => navigation.goBack()} title={barTitle}>
        {loading ? (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        ) : loadError ? (
          <EmError title="This post didn’t load." body={loadError} />
        ) : (
          <EmError title="This post is closed." body="A closed post can’t be edited. Post a new role instead." />
        )}
      </EmployerShell>
    )
  }

  const categories = (config?.masterData.jobCategories ?? []).map((c) => ({ value: c.name, label: c.name }))
  const types = (config?.profile.employmentTypes ?? []).map((t) => ({ value: t, label: employmentLabel(t as Parameters<typeof employmentLabel>[0]) }))
  const quals = (config?.qualifications ?? []).map((q) => ({ value: q.value, label: QUAL_SHORT[q.value] ?? label(q.value) }))
  const joins = (config?.profile.availability ?? []).map((a) => ({ value: a, label: label(a) }))
  const sub = editingLive ? 'SAVING SENDS IT BACK TO REVIEW' : status === 'PENDING_MODERATION' ? 'IN REVIEW' : 'DRAFT'

  const listField = (key: 'responsibilities' | 'requirements', fieldLabel: string, list: string[], set: (v: string[]) => void, placeholder: string) => (
    <EmField label={fieldLabel} error={errors[key]}>
      <View style={styles.list}>
        {list.map((item, i) => (
          <View key={i} style={styles.listRow}>
            <View style={styles.grow}>
              <Input value={item} onChangeText={(v) => setList(set, list, i, v)} placeholder={placeholder} style={styles.short} />
            </View>
            {list.length > 1 && <EmIconButton name="x" label={`Remove ${fieldLabel.toLowerCase()} ${i + 1}`} iconSize={space.lg} onPress={() => dropFrom(set, list, i)} />}
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={() => set([...list, ''])} hitSlop={space.sm} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          <Icon name="plus" size={space.lg - 1} tint={color.accent} weight={2} />
          <Text style={[text.uiSmSemi, styles.accent]}>Add</Text>
        </Pressable>
      </View>
    </EmField>
  )

  const addBenefit = () => {
    const b = benefitDraft.trim()
    if (b && !benefits.some((x) => x.toLowerCase() === b.toLowerCase())) setBenefits([...benefits, b])
    setBenefitDraft('')
  }
  const benefitChips = [...new Set([...BENEFIT_SUGGESTIONS, ...benefits])]

  return (
    <EmployerShell
      back={back}
      title={barTitle}
      sub={sub}
      right={isDraft ? <Button variant="text" size="sm" label="Save draft" busy={busy === 'draft'} disabled={!!busy} onPress={() => { save(false) }} /> : undefined}
      contentGap="lg"
      footer={
        step === 1 ? (
          <>
            <Text style={[text.metaMd, styles.muted, styles.mono]}>1 OF 2</Text>
            <View style={styles.grow} />
            <Button variant="secondary" size="cta" label="Next" onPress={next} style={styles.next} />
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            busy={busy === 'submit'}
            disabled={!!busy}
            label={isDraft ? 'Submit for review' : 'Save changes'}
            style={styles.grow}
            onPress={() => { save(true) }}
          />
        )
      }
    >
      {editingLive && <Text style={[text.uiSm, styles.warning]}>Saving changes to the role sends it back to moderation and off the student feed until it is approved again.</Text>}
      {!!banner && (
        <View style={styles.banner} accessibilityRole="alert">
          <Icon name="alert" size={space.lg - 1} tint={color.danger} weight={2} />
          <Text style={[text.uiSm, styles.danger, styles.grow]}>{banner}</Text>
        </View>
      )}

      {step === 1 ? (
        <>
          <EmField label="Job title" error={errors.title}>
            <Input value={title} invalid={!!errors.title} onChangeText={setTitle} placeholder="e.g. Operations Associate" />
          </EmField>
          <View style={styles.two}>
            <View style={styles.half}>
              <EmField label="Category" error={errors.category}>
                <EmSelect title="Category" value={category} options={categories} onChange={setCategory} invalid={!!errors.category} />
              </EmField>
            </View>
            <View style={styles.half}>
              <EmField label="Department" note="optional">
                <Input value={department} onChangeText={setDepartment} placeholder="e.g. Fulfilment" />
              </EmField>
            </View>
          </View>
          <View style={styles.two}>
            <View style={styles.half}>
              <EmField label="Vacancies" error={errors.vacancies}>
                <Input value={vacancies} invalid={!!errors.vacancies} onChangeText={(v) => setVacancies(digits(v))} keyboardType="number-pad" />
              </EmField>
            </View>
            <View style={styles.half}>
              <EmField label="Type" error={errors.employmentType}>
                <EmSelect title="Employment type" value={employmentType} options={types} onChange={setEmploymentType} invalid={!!errors.employmentType} />
              </EmField>
            </View>
          </View>
          <EmField label="Description" error={errors.description} hint={errors.description ? undefined : `${description.trim().length} characters · at least 30`}>
            <Input value={description} invalid={!!errors.description} onChangeText={setDescription} multiline textAlignVertical="top" placeholder="What the role is, and why it matters." style={styles.area} />
          </EmField>
          {listField('responsibilities', 'Responsibilities', responsibilities, setResponsibilities, 'e.g. Plan shifts for a 60-person team')}
          {listField('requirements', 'Requirements', requirements, setRequirements, 'e.g. Comfortable with Excel')}
          <EmField label="Minimum qualification" error={errors.minQualification}>
            <EmSeg label="Minimum qualification" options={quals} value={minQualification} onChange={setMinQualification} compact />
          </EmField>
        </>
      ) : (
        <>
          <EmField label="Experience range" note="years" error={errors.experienceMaxYears}>
            <View style={styles.range}>
              <View style={styles.grow}><Input value={expMin} onChangeText={(v) => setExpMin(digits(v))} keyboardType="number-pad" placeholder="0" style={styles.short} /></View>
              <Text style={[text.uiMd, styles.subtle]}>to</Text>
              <View style={styles.grow}><Input value={expMax} onChangeText={(v) => setExpMax(digits(v))} keyboardType="number-pad" placeholder="Any" style={styles.short} /></View>
            </View>
          </EmField>
          <EmField label="Salary range · per year" error={errors.salaryMinPaise ?? errors.salaryMaxPaise}>
            <View style={styles.range}>
              <View style={styles.grow}>
                <Input value={grouped(salaryMin)} onChangeText={(v) => setSalaryMin(digits(v))} keyboardType="number-pad" placeholder="₹ from" invalid={!!errors.salaryMinPaise} style={styles.short} />
              </View>
              <Text style={[text.uiMd, styles.subtle]}>to</Text>
              <View style={styles.grow}>
                <Input value={grouped(salaryMax)} onChangeText={(v) => setSalaryMax(digits(v))} keyboardType="number-pad" placeholder="₹ to" invalid={!!errors.salaryMaxPaise} style={styles.short} />
              </View>
            </View>
          </EmField>
          <EmField label="Location and mode" error={errors.location}>
            <Input value={location} invalid={!!errors.location} onChangeText={setLocation} placeholder="City" style={styles.short} />
            <EmSeg
              label="Work mode"
              options={[{ value: 'ONSITE', label: 'On-site' }, { value: 'REMOTE', label: 'Remote' }]}
              value={remote ? 'REMOTE' : 'ONSITE'}
              onChange={(v) => setRemote(v === 'REMOTE')}
              compact
            />
          </EmField>
          <EmField label="Benefits" note="optional">
            <View style={styles.chips}>
              {benefitChips.map((b) => (
                <EmChip
                  key={b}
                  compact
                  label={b}
                  on={benefits.includes(b)}
                  onPress={() => setBenefits(benefits.includes(b) ? benefits.filter((x) => x !== b) : [...benefits, b])}
                />
              ))}
            </View>
            <View style={styles.listRow}>
              <View style={styles.grow}>
                <Input value={benefitDraft} onChangeText={setBenefitDraft} onSubmitEditing={addBenefit} placeholder="Add another" returnKeyType="done" style={styles.short} />
              </View>
              <Button variant="outline" size="md" label="Add" disabled={!benefitDraft.trim()} onPress={addBenefit} />
            </View>
          </EmField>
          <View style={styles.two}>
            <View style={styles.half}>
              <EmField label="Joining" note="optional">
                <EmSelect title="Joining" value={joining} options={joins} onChange={setJoining} placeholder="Any time" />
              </EmField>
            </View>
            <View style={styles.half}>
              <EmField label="Deadline" note="optional" error={errors.applicationDeadline}>
                <EmDateField title="Application deadline" value={deadline} onChange={setDeadline} min={todayIst()} />
              </EmField>
            </View>
          </View>
          <EmField label="Job video" note={`optional${rule.maxSeconds ? ` · up to ${rule.maxSeconds} s` : ''}`} error={errors.video}>
            <VideoSlot video={video} maxSeconds={rule.maxSeconds} onPick={() => { chooseVideo() }} onCancel={() => abort.current?.abort()} onRemove={() => setVideo({ phase: 'empty' })} />
          </EmField>
        </>
      )}

      <EmSheet open={submitted} onClose={() => navigation.goBack()} scroll={false}>
        <EmDone
          icon="clock"
          tone="amber"
          title="Submitted for review"
          body={`${title.trim() || 'The post'} goes live once approved${moderationHours ? `, usually within ${hoursPhrase(moderationHours)}` : ''}.`}
          actions={<Button variant="secondary" size="cta" label="Back to jobs" style={styles.grow} onPress={() => navigation.popTo('EmployerJobs')} />}
        />
      </EmSheet>
    </EmployerShell>
  )
}

/** EM-18c · the job video: empty (dashed), uploading (violet, %, cancel), refused (red, Replace), attached (the 9:16 tile). */
function VideoSlot({
  video, maxSeconds, onPick, onCancel, onRemove,
}: { video: Video; maxSeconds?: number; onPick: () => void; onCancel: () => void; onRemove: () => void }) {
  if (video.phase === 'up') {
    return (
      <View style={[styles.drop, styles.dropUp]} accessibilityLabel={`Uploading ${video.name}, ${video.pct}%`}>
        <View style={styles.line}>
          <Icon name="file" size={space.xl} tint={color.accent} />
          <Text style={[text.uiBaseMedium, styles.grow]} numberOfLines={1}>{video.name}</Text>
          <Text style={[text.metaBase, styles.accentText]}>{`${video.pct}%`}</Text>
          <EmIconButton name="x" label={`Cancel uploading ${video.name}`} size={height.radio + 8} iconSize={space.md + 3} onPress={onCancel} />
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${video.pct}%` }]} /></View>
      </View>
    )
  }
  if (video.phase === 'err') {
    return (
      <View style={[styles.drop, styles.dropErr]} accessibilityRole="alert">
        <Icon name="alert" size={space.xl} tint={color.danger} weight={2} />
        <View style={styles.grow}>
          <Text style={text.uiBaseMedium} numberOfLines={1}>{video.name}</Text>
          <Text style={[text.uiSm, styles.danger]}>{video.msg}</Text>
        </View>
        <Button variant="outline" size="sm" label="Replace" onPress={onPick} style={styles.slim} />
      </View>
    )
  }
  if (video.phase === 'ready') {
    return (
      <View style={styles.ready}>
        <View style={styles.readyThumb} />
        <View style={styles.grow}>
          <Text style={[text.metaSm, styles.muted, styles.mono]}>{`9:16 · ${clock(video.durationSec)}`}</Text>
          <EmBadge label="Moderated with post" tone="amber" small />
        </View>
        <EmIconButton name="x" label="Remove the video" iconSize={space.lg} onPress={onRemove} />
      </View>
    )
  }
  return <DropZone title="Add vertical video" sub={`9:16 · MP4/MOV${maxSeconds ? ` · ≤${maxSeconds} s` : ''}`} compact onPress={onPick} />
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  warning: { color: color.warning },
  accent: { color: color.accent },
  accentText: { color: color.accentText },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  banner: { flexDirection: 'row', gap: spaceHalf['1.5'], alignItems: 'flex-start', borderRadius: radius.tile, backgroundColor: color.dangerSoft, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  two: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  half: { flex: 1, minWidth: 0 },
  area: { height: height['note-field'] + space.xl, paddingTop: space.md },
  short: { height: height.tap },
  list: { gap: spaceHalf['1.5'] },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: height.tap, paddingHorizontal: space.xs },
  range: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  next: { paddingHorizontal: space['2xl'] },
  slim: { paddingHorizontal: spaceHalf['3.5'] },

  drop: { borderRadius: radius.panel, paddingVertical: spaceHalf['3.5'], paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  dropUp: { flexDirection: 'column', alignItems: 'stretch', gap: spaceHalf['2.5'], borderWidth: borderWidth.thin, borderColor: color.accentMuted, backgroundColor: color.accentWash },
  dropErr: { borderWidth: borderWidth.medium, borderColor: color.dangerBorder, backgroundColor: color.dangerGround },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { height: space.xs, borderRadius: radius.bar, backgroundColor: color.accentEdge, overflow: 'hidden' },
  fill: { height: space.xs, borderRadius: radius.bar, backgroundColor: color.accent },
  ready: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: spaceHalf['2.5'], borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface },
  readyThumb: { width: height.tap, height: height['deck-play'] + spaceHalf['2.5'], borderRadius: radius.ctl, backgroundColor: color.accentDeep },
})
