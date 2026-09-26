import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../ui'
import { Icon } from '../ui/Icon'
import { EmIconButton } from './em'
import {
  COMPANY_PROOF_KINDS, EMPLOYER_UPLOAD, EmployerUploadError, checkEmployerFile, megabytes, pickEmployerDocument,
  uploadEmployerDocument, type DocKind, type PickedFile, type RequirementKey,
} from '../../lib/api/employer'
import { ACCEPTABLE, DOC_KIND_LABEL, SLOT_EXPLANATION } from '../../lib/employer/state'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'

/**
 * EM-05 · one slot per requirement, drawn as the design's drop zone (H.drop):
 * dashed and empty, violet while uploading with the percentage and a cancel,
 * red with the file and the fault, and a file tile once uploaded.
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
 * The line under a refused file name (EM-05 · "14.2 MB. Upload up to 10 MB."):
 * the fact and the fix, in the design's few words. Never "Upload failed".
 */
function refusalLine(e: EmployerUploadError): string {
  if (e.fault === 'type') {
    const what = describeType(e.fileName)
    return what ? `This is ${what}. Upload a PDF, JPG or PNG.` : 'Not a PDF, JPG or PNG. Upload one of those.'
  }
  if (e.fault === 'size') return `${megabytes(e.sizeBytes)}. Upload up to 10 MB.`
  return e.message
}

const kindsFor = (requirement: Exclude<RequirementKey, 'WORK_EMAIL'>, kinds?: readonly DocKind[]): readonly DocKind[] =>
  kinds?.length ? kinds : requirement === 'PHOTO_ID' ? ['PHOTO_ID'] : COMPANY_PROOF_KINDS

export function DocumentSlot({
  requirement, kinds, value, onChange, onStatusChange, disabled = false, compact = false, ref,
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
  /** The smaller drop without its button (a reviewer's request inside EM-06b). */
  compact?: boolean
  ref?: React.Ref<DocumentSlotHandle>
}) {
  const choices = kindsFor(requirement, kinds)
  const [kind, setKind] = useState<DocKind>(choices[0])
  // The kind as chosen right now: a switch mid-upload files the document under
  // the new choice, and a switch after it re-labels the uploaded file.
  const kindNow = useRef(kind)
  const [phase, setPhase] = useState<Phase>({ t: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const alive = useRef(true)

  // A choice list that changes under the slot (a new request) re-points the selection.
  const selected = choices.includes(kind) ? kind : choices[0]
  kindNow.current = selected
  const pickKind = (k: DocKind) => {
    setKind(k)
    if (value && value.kind !== k) onChange({ ...value, kind: k })
  }

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
    async (file: PickedFile, _as: DocKind) => {
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
        onChange({ kind: kindNow.current, key, name: file.name, size: file.size })
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

  // ── settled (H.drop 'done') ────────────────────────────────────────────────
  if (value && phase.t === 'idle') {
    return (
      <View style={styles.slot}>
        {choices.length > 1 && <KindChoice choices={choices} value={selected} onChange={pickKind} disabled={disabled} />}
        <View style={[styles.drop, styles.dropDone]}>
          <View style={styles.ext}><Text style={[text.metaXs, styles.extText]}>{extOf(value.name)}</Text></View>
          <View style={styles.grow}>
            <Text style={text.uiBaseMedium} numberOfLines={1}>{value.name}</Text>
            <Text style={[text.metaMd, styles.mono, styles.ok]} numberOfLines={1}>
              {`${KIND_SHORT[value.kind].toUpperCase()} · ${megabytes(value.size)} · UPLOADED`}
            </Text>
          </View>
          <Button variant="ghost" size="sm" label="Replace" disabled={disabled} onPress={() => { choose() }} style={styles.slim} />
        </View>
      </View>
    )
  }

  // ── uploading (H.drop 'up') ────────────────────────────────────────────────
  if (phase.t === 'uploading') {
    const pct = Math.round(phase.fraction * 100)
    return (
      <View style={styles.slot}>
        {choices.length > 1 && <KindChoice choices={choices} value={selected} onChange={pickKind} disabled={disabled} />}
        <View style={[styles.drop, styles.dropUp]} accessibilityLabel={`Uploading ${phase.file.name}, ${pct}%`}>
          <View style={styles.line}>
            <Icon name="file" size={space.xl} tint={color.accent} />
            <Text style={[text.uiBaseMedium, styles.grow]} numberOfLines={1}>{phase.file.name}</Text>
            <Text style={[text.metaBase, styles.mono, styles.pct]}>{`${pct}%`}</Text>
            <EmIconButton
              name="x"
              label={`Cancel uploading ${phase.file.name}`}
              size={height.radio + 8}
              iconSize={space.md + 3}
              onPress={() => abort.current?.abort()}
            />
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        </View>
      </View>
    )
  }

  // ── stopped: the network, not the file ─────────────────────────────────────
  if (phase.t === 'stopped') {
    const { file } = phase
    return (
      <View style={styles.slot}>
        <View style={[styles.drop, styles.dropStopped]} accessibilityLiveRegion="polite">
          <Icon name="refresh" size={space.xl} tint={color.textMuted} weight={2} />
          <View style={styles.grow}>
            <Text style={text.uiBaseMedium} numberOfLines={1}>{file.name}</Text>
            <Text style={[text.uiSm, styles.muted]}>Upload stopped. The file is still chosen.</Text>
          </View>
          <Button variant="outline" size="sm" label="Try again" disabled={disabled} onPress={() => { send(file, selected) }} style={styles.slim} />
        </View>
      </View>
    )
  }

  // ── refused: a named fault (H.drop 'err') ──────────────────────────────────
  if (phase.t === 'refused') {
    return (
      <View style={styles.slot}>
        {choices.length > 1 && <KindChoice choices={choices} value={selected} onChange={pickKind} disabled={disabled} />}
        <View style={[styles.drop, styles.dropErr]} accessibilityRole="alert">
          <Icon name="alert" size={space.xl} tint={color.danger} weight={2} />
          <View style={styles.grow}>
            <Text style={text.uiBaseMedium} numberOfLines={1}>{phase.error.fileName}</Text>
            <Text style={[text.uiSm, styles.danger]}>{refusalLine(phase.error)}</Text>
          </View>
          <Button variant="outline" size="sm" label="Retry" disabled={disabled} onPress={() => { choose() }} style={styles.slim} />
        </View>
      </View>
    )
  }

  // ── idle (H.drop 'empty') ──────────────────────────────────────────────────
  const idOnly = choices.every((k) => k === 'PHOTO_ID')
  return (
    <View style={styles.slot}>
      {choices.length > 1 && <KindChoice choices={choices} value={selected} onChange={pickKind} disabled={disabled} />}
      <Text style={[text.uiSm, styles.muted]}>{idOnly ? SLOT_EXPLANATION.PHOTO_ID : ACCEPTABLE[selected]}</Text>
      <DropZone
        title={idOnly ? 'Upload photo ID' : `Upload ${KIND_SHORT[selected]}`}
        accessibilityLabel={`Choose a file for ${idOnly ? 'your photo ID' : DOC_KIND_LABEL[selected]}`}
        compact={compact}
        disabled={disabled}
        onPress={() => { choose() }}
      />
    </View>
  )
}

/**
 * The empty drop (H.drop 'empty'): dashed, the violet upload mark, a title and
 * the file rule, and a Choose file button unless `compact`. Also drawn on EM-06b,
 * where it opens EM-05 at the requested document.
 */
export function DropZone({
  title, sub, onPress, compact, disabled, accessibilityLabel,
}: { title: string; sub?: string; onPress: () => void; compact?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  const maxMb = useEmployerConfig().documentMaxMb ?? EMPLOYER_UPLOAD.maxBytes / 1_048_576
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.drop, styles.dropEmpty, compact && styles.dropCompact, pressed && styles.pressed]}
    >
      <View style={styles.dropMark}><Icon name="upload" size={space.xl} tint={color.accent} /></View>
      <View style={styles.grow}>
        <Text style={text.uiBaseSemi}>{title}</Text>
        <Text style={[text.uiSm, styles.muted]}>{sub ?? `PDF, JPG, PNG · ${maxMb} MB`}</Text>
      </View>
      {!compact && (
        <View pointerEvents="none">
          <Button variant="outline" size="sm" label="Choose file" disabled={disabled} style={styles.slim} />
        </View>
      )}
    </Pressable>
  )
}

/** The short kind names the segmented control and the file meta use (the design's GST · CIN · Company PAN). */
const KIND_SHORT: Record<DocKind, string> = { GST: 'GST', CIN: 'CIN', PAN: 'Company PAN', PHOTO_ID: 'Photo ID' }

/** 'PDF', 'JPG', 'PNG' — the tag on the file tile. */
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE')

/** The segmented company-proof choice (H.seg): one slot, three kinds, a radio group. */
function KindChoice({
  choices, value, onChange, disabled,
}: { choices: readonly DocKind[]; value: DocKind; onChange: (k: DocKind) => void; disabled: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Company document" style={styles.seg}>
      {choices.map((k) => {
        const on = k === value
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(k)}
            hitSlop={{ top: space.xs, bottom: space.xs }}
            style={({ pressed }) => [styles.segItem, on && styles.segOn, pressed && styles.pressed]}
          >
            <Text style={[on ? text.uiSmSemi : text.uiSmMedium, { color: on ? color.text : color.textMuted }]} numberOfLines={1}>
              {KIND_SHORT[k]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  ok: { color: color.success },
  pct: { color: color.accentText },
  mono: { letterSpacing: trackingNative.eyebrow },
  slot: { gap: spaceHalf['2.5'] },
  slim: { paddingHorizontal: spaceHalf['3.5'] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  drop: { borderRadius: radius.panel, paddingVertical: spaceHalf['3.5'], paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'] },
  dropEmpty: { borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.borderStrong, backgroundColor: color.surface, padding: spaceHalf['4.5'], gap: space.lg },
  dropCompact: { padding: space.lg },
  dropMark: { width: height.tap, height: height.tap, borderRadius: radius.tile, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  dropUp: { flexDirection: 'column', alignItems: 'stretch', gap: spaceHalf['2.5'], borderWidth: borderWidth.thin, borderColor: color.accentMuted, backgroundColor: color.accentWash },
  dropErr: { borderWidth: borderWidth.medium, borderColor: color.dangerBorder, backgroundColor: color.dangerGround },
  dropStopped: { borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted },
  dropDone: { borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface },
  track: { height: space.xs, borderRadius: radius.bar, backgroundColor: color.accentEdge, overflow: 'hidden' },
  fill: { height: space.xs, borderRadius: radius.bar, backgroundColor: color.accent },
  ext: { width: height.avatar, height: height.control, borderRadius: radius.ctl, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spaceHalf['1.5'] },
  extText: { color: color.danger },

  seg: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.tile, backgroundColor: color.surfaceMuted },
  segItem: { flex: 1, height: height.segment, borderRadius: radius.ctl + 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  segOn: { backgroundColor: color.surface, boxShadow: shadow.raised },
})
