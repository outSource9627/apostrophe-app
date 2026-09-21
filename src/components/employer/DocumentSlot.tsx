import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Body, Button, Card, Eyebrow, ProgressBar, StatusPill, text, type Tone } from '../ui'
import {
  COMPANY_PROOF_KINDS, EMPLOYER_UPLOAD, EmployerUploadError, checkEmployerFile, megabytes, pickEmployerDocument,
  uploadEmployerDocument, type DocKind, type PickedFile, type RequirementKey,
} from '../../lib/api/employer'
import { ACCEPTABLE, DOC_KIND_LABEL, SLOT_EXPLANATION } from '../../lib/employer/state'
import { Glyph, TextAction } from './parts'

/**
 * EM-05 · one slot per kind of document.
 *
 * The slot owns its whole lifecycle — pick, check, presign, upload, cancel —
 * and hands the screen one thing: the uploaded key, with its kind, through
 * `onChange`. The screen decides when to attach and submit.
 *
 *   idle       what is acceptable, and the PDF, JPG or PNG · up to 10 MB
 *              constraint, BEFORE the picker opens. Company proof carries its
 *              GST / CIN / company PAN choice inside this one slot — never three
 *              slots competing — and choosing changes only the acceptable line.
 *   uploading  determinate: a real percentage and bar, the megabytes sent, and
 *              Cancel. Never a spinner.
 *   settled    only the file, its kind in the meta line, Replace and Remove.
 *              To change the kind, remove the file.
 *   refused    a danger block that names the file, the real number and one
 *              way on: wrong type, over 10 MB, or the server's own refusal.
 *   stopped    the connection dropped. Not a refusal, so not danger: the file
 *              was fine and is still chosen, and Try again sends it again.
 *
 * There is no "Upload failed. Please try again." branch, and an unreadable scan
 * cannot be caught here — a person decides that, and it arrives as the reason
 * on a rejected row (DocumentStatusRow).
 */

/** A document in the slot, uploaded and ready to attach. */
export interface SlotFile {
  kind: DocKind
  key: string
  name: string
  size: number
}

/**
 * Where the slot is, for the screen's Submit and its reason line:
 * `empty` and `settled` are at rest; `uploading` is bytes going out; `refused`
 * and `stopped` are showing a fault (and `error` names it).
 */
export type SlotStatus = 'empty' | 'uploading' | 'settled' | 'refused' | 'stopped'

export interface DocumentSlotHandle {
  /** Open the picker now — a Resubmit that goes straight to the photo ID picker. */
  pick: () => void
}

type Phase =
  | { t: 'idle' }
  | { t: 'uploading'; file: PickedFile; fraction: number }
  | { t: 'refused'; error: EmployerUploadError }
  | { t: 'stopped'; error: EmployerUploadError; file: PickedFile }

/*
  The two below are the web's (apostrophe-user components/employer/DocumentSlot.tsx),
  word for word: the same fault must read the same on both surfaces and on the
  board (EM-05 · Upload error).
*/

/** What a refused file IS, named from its extension — 'aadhaar.docx is a Word document'. */
function describeType(name: string): string | null {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'a Word document'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'a spreadsheet'
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'a presentation'
  if (['heic', 'heif'].includes(ext)) return 'a HEIC photo'
  if (ext === 'webp') return 'a WebP image'
  if (ext === 'gif') return 'a GIF'
  if (['zip', 'rar', '7z'].includes(ext)) return 'a compressed folder'
  if (ext === 'txt') return 'a text file'
  return null
}

/**
 * The sentence in the refusal block: the file, the fact, the fix. Never
 * "Upload failed. Please try again." — each fault says what it was.
 */
function refusalSentence(e: EmployerUploadError, kinds: readonly DocKind[]): string {
  const subject = kinds.length === 1 && kinds[0] === 'PHOTO_ID' ? 'card' : 'document'
  if (e.fault === 'type') {
    const what = describeType(e.fileName)
    const fact = what ? `${e.fileName} is ${what}.` : `${e.fileName} is not a PDF, JPG or PNG.`
    return `${fact} Choose a PDF, JPG or PNG of the ${subject} itself; a photo of it works.`
  }
  if (e.fault === 'size') {
    return `${e.fileName} is ${megabytes(e.sizeBytes)}, over the 10 MB limit. Scan it again at a lower quality, or take a photo of the ${subject} and choose the JPG.`
  }
  // The server's own words when it refused the presign already say what to choose.
  return /^choose\b/i.test(e.message) ? e.message : `${e.message} Choose the file again.`
}

const kindsFor = (requirement: Exclude<RequirementKey, 'WORK_EMAIL'>, kinds?: readonly DocKind[]): readonly DocKind[] =>
  kinds?.length ? kinds : requirement === 'PHOTO_ID' ? ['PHOTO_ID'] : COMPANY_PROOF_KINDS

export function DocumentSlot({
  requirement, kinds, value, onChange, onStatusChange, disabled = false, ref,
}: {
  requirement: Exclude<RequirementKey, 'WORK_EMAIL'>
  /** The choices. Defaults: GST, CIN, PAN for company proof; PHOTO_ID for the ID; a request passes what was asked for. */
  kinds?: readonly DocKind[]
  /** The uploaded document, or null while nothing is. */
  value: SlotFile | null
  onChange: (next: SlotFile | null) => void
  /**
   * Every change of SlotStatus. Submit waits on `uploading`, and stays shut
   * while a slot shows `refused` or `stopped` — even over an earlier good file
   * that a failed Replace is hiding.
   */
  onStatusChange?: (status: SlotStatus, error: EmployerUploadError | null) => void
  disabled?: boolean
  ref?: React.Ref<DocumentSlotHandle>
}) {
  const choices = kindsFor(requirement, kinds)
  const [kind, setKind] = useState<DocKind>(choices[0])
  const [phase, setPhase] = useState<Phase>({ t: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const alive = useRef(true)

  // A choice list that changes under the slot (a new request) re-points the selection.
  const selected = choices.includes(kind) ? kind : choices[0]

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      // Leaving the screen stops the bytes; nobody's mobile data finishes an
      // upload that no longer has anywhere to land.
      abort.current?.abort()
    }
  }, [])

  const status: SlotStatus = phase.t === 'idle' ? (value ? 'settled' : 'empty') : phase.t
  const fault = phase.t === 'refused' || phase.t === 'stopped' ? phase.error : null
  // Reported on a change of status, not on a new callback: a screen passing an
  // inline function would otherwise hear it on every render.
  const report = useRef(onStatusChange)
  report.current = onStatusChange
  useEffect(() => {
    report.current?.(status, fault)
  }, [status, fault])

  const send = useCallback(
    async (file: PickedFile, as: DocKind) => {
      const refused = checkEmployerFile(file)
      if (refused) {
        setPhase({ t: 'refused', error: refused })
        return
      }
      const controller = new AbortController()
      abort.current = controller
      setPhase({ t: 'uploading', file, fraction: 0 })
      try {
        const key = await uploadEmployerDocument(file, {
          signal: controller.signal,
          onProgress: (fraction) => alive.current && setPhase({ t: 'uploading', file, fraction }),
        })
        if (!alive.current) return
        setPhase({ t: 'idle' })
        onChange({ kind: as, key, name: file.name, size: file.size })
      } catch (e) {
        if (!alive.current) return
        const error =
          e instanceof EmployerUploadError
            ? e
            : new EmployerUploadError('network', 'The connection dropped and nothing was saved.', file.name, file.size)
        if (error.fault === 'cancelled') setPhase({ t: 'idle' })
        else if (error.fault === 'network') setPhase({ t: 'stopped', error, file })
        else setPhase({ t: 'refused', error })
      } finally {
        if (abort.current === controller) abort.current = null
      }
    },
    [onChange],
  )

  const choose = useCallback(async () => {
    if (disabled || abort.current) return
    try {
      const file = await pickEmployerDocument()
      if (file && alive.current) await send(file, selected)
    } catch (e) {
      if (!alive.current) return
      if (e instanceof EmployerUploadError) setPhase({ t: 'refused', error: e })
    }
  }, [disabled, send, selected])

  useImperativeHandle(ref, () => ({ pick: () => { choose() } }), [choose])

  // ── settled ────────────────────────────────────────────────────────────────
  if (value && phase.t === 'idle') {
    return (
      <Card style={styles.card}>
        <FileLine name={value.name} meta={`${DOC_KIND_LABEL[value.kind]} · ${megabytes(value.size)} · uploaded`} />
        <View style={styles.settledActions}>
          <TextAction label="Replace" underline={false} disabled={disabled} onPress={() => { choose() }} />
          <TextAction label="Remove" tone="subtle" underline={false} disabled={disabled} onPress={() => onChange(null)} />
        </View>
      </Card>
    )
  }

  // ── uploading ──────────────────────────────────────────────────────────────
  if (phase.t === 'uploading') {
    const pct = Math.round(phase.fraction * 100)
    const sent = (phase.file.size * phase.fraction) / 1048576
    return (
      <Card style={styles.card}>
        <View style={styles.well}>
          <FileLine
            name={phase.file.name}
            meta={`${DOC_KIND_LABEL[selected]} · ${sent.toFixed(1)} of ${megabytes(phase.file.size)}`}
            trailing={<Text style={[text.metaMd, styles.pct]}>{`${pct}%`}</Text>}
          />
          <View style={styles.bar}>
            <ProgressBar pct={pct} tone="ink" />
          </View>
        </View>
        <View style={styles.cancelRow}>
          <TextAction
            label="Cancel"
            tone="muted"
            accessibilityLabel={`Cancel uploading ${phase.file.name}`}
            onPress={() => abort.current?.abort()}
          />
        </View>
      </Card>
    )
  }

  // ── stopped: the network, not the file ─────────────────────────────────────
  if (phase.t === 'stopped') {
    const { file, error } = phase
    return (
      <View style={[styles.card, styles.stopped]} accessibilityLiveRegion="polite">
        <View style={styles.paperPill}>
          <Glyph name="wifiOff" size={space.md} tint={color.textMuted} />
          <Text style={[text.metaPill, { color: color.textMuted }]}>Upload stopped</Text>
        </View>
        <Body size="sm" style={styles.message}>
          {`${error.message} The file is still chosen, so try again when you have signal.`}
        </Body>
        <View style={styles.way}>
          <Button variant="outline" size="md" label="Try again" disabled={disabled} onPress={() => { send(file, selected) }} />
        </View>
      </View>
    )
  }

  // ── refused: a named fault ─────────────────────────────────────────────────
  if (phase.t === 'refused') {
    return (
      <View style={[styles.card, styles.refused]} accessibilityRole="alert">
        <View style={styles.paperPill}>
          <Text style={[text.metaPill, { color: color.danger }]}>Not accepted</Text>
        </View>
        <Body size="sm" tone="danger" style={styles.message}>
          {refusalSentence(phase.error, choices)}
        </Body>
        <View style={styles.way}>
          <Button variant="destructive" size="md" label="Choose another file" disabled={disabled} onPress={() => { choose() }} />
        </View>
      </View>
    )
  }

  // ── idle ───────────────────────────────────────────────────────────────────
  const idOnly = choices.every((k) => k === 'PHOTO_ID')
  return (
    <Card style={styles.card}>
      <Body size="sm" tone="muted">
        {idOnly ? SLOT_EXPLANATION.PHOTO_ID : SLOT_EXPLANATION.COMPANY_PROOF}
      </Body>
      {choices.length > 1 && <KindChoice choices={choices} value={selected} onChange={setKind} disabled={disabled} />}
      {!idOnly && selected !== 'PHOTO_ID' && (
        <Body size="sm" style={choices.length > 1 ? styles.acceptableAfterChoice : styles.acceptable}>
          {ACCEPTABLE[selected]}
        </Body>
      )}
      <Eyebrow tone="muted" style={styles.constraint}>
        {EMPLOYER_UPLOAD.constraint}
      </Eyebrow>
      <View style={styles.pick}>
        <Button variant="outline" size="md" label="Choose a file" disabled={disabled} onPress={() => { choose() }} />
      </View>
    </Card>
  )
}

/** The file glyph, the name, a mono meta line and an optional trailing figure. */
function FileLine({ name, meta, trailing }: { name: string; meta: string; trailing?: React.ReactNode }) {
  return (
    <View style={styles.fileLine}>
      <Glyph name="file" size={space.xl} tint={color.textMuted} />
      <View style={styles.grow}>
        <Body size="sm" weight="medium" numberOfLines={1}>
          {name}
        </Body>
        <Text style={[text.metaPill, styles.fileMeta]}>{meta}</Text>
      </View>
      {trailing}
    </View>
  )
}

/**
 * The company-proof choice: chips inside the one slot, a radio group. 36 tall
 * inside a 44 tap row; selected is ink, never crimson.
 */
function KindChoice({
  choices, value, onChange, disabled,
}: { choices: readonly DocKind[]; value: DocKind; onChange: (k: DocKind) => void; disabled: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Company proof" style={styles.choice}>
      {choices.map((k) => {
        const on = k === value
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(k)}
            style={({ pressed }) => [styles.chipTap, pressed && styles.pressed]}
          >
            <View style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
              <Body size="sm" weight="medium" tone={on ? 'inverse' : 'default'}>
                {DOC_KIND_LABEL[k]}
              </Body>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * A requirement's heading: the number, the name, its status. It sits OUTSIDE
 * the slot so it survives the slot turning into a refusal block.
 */
export function RequirementHead({
  n, title, pill,
}: { n: number; title: string; pill?: { label: string; tone: Tone } }) {
  return (
    <View style={styles.head}>
      <Text style={[text.uiSm, styles.headNumber]} accessibilityElementsHidden importantForAccessibility="no">
        {String(n).padStart(2, '0')}
      </Text>
      <Text style={[text.uiBaseSemi, styles.grow]}>{title}</Text>
      {!!pill && <StatusPill tone={pill.tone} label={pill.label} />}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  card: { padding: space.lg, borderRadius: radius.lg },

  acceptable: { marginTop: space.sm },
  acceptableAfterChoice: { marginTop: space.xs },
  constraint: { marginTop: space.md },
  pick: { marginTop: space.md, alignSelf: 'flex-start' },

  choice: { marginTop: space.sm, flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
  chipTap: { height: height.tap, justifyContent: 'center' },
  chip: {
    height: height.chip,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: space.md,
  },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipOff: { backgroundColor: color.surface, borderColor: color.borderStrong },

  fileLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fileMeta: { marginTop: space['2xs'], color: color.textSubtle },
  pct: { color: color.text },
  well: { borderRadius: radius.md, backgroundColor: color.surfaceSunken, padding: space.md },
  bar: { marginTop: space.sm },
  cancelRow: { marginTop: space.xs, flexDirection: 'row', justifyContent: 'flex-end' },
  settledActions: { flexDirection: 'row', gap: space.xl, paddingLeft: space['2xl'] },

  stopped: { backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: 'transparent' },
  refused: { backgroundColor: color.dangerSoft, borderWidth: borderWidth.thin, borderColor: color.dangerBorder },
  paperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  message: { marginTop: space.sm },
  way: { marginTop: space.md, alignSelf: 'flex-start' },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: space['2xl'] },
  headNumber: { width: space.xl, color: color.borderStrong },
})
