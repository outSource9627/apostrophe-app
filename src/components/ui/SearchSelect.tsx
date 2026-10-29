import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, fontFamilyNative, fontSize, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button } from './Button'
import { Icon } from './Icon'
import { text } from './typography'

/**
 * A searchable dropdown for a master-data list — domains, languages
 * (docs/feed-shortlist-forms-mockups.html · pickers). The closed field shows
 * what is picked as chips (× takes one off without opening); tapping it opens a
 * sheet with a search box, the picked chips, and the whole list underneath.
 * Multi-pick by default; `single` reads as radios and closes on the pick.
 *
 * There is no free-text entry: the lists come from /config's master data and
 * are complete, and a typo would split the filters. A value that is not in the
 * list (a legacy free-text answer, an old saved filter) is still shown, and can
 * still be taken off, until it is changed.
 *
 * Search matches any part of the name, ignoring case and accents ("maori"
 * finds "Māori"). Long lists are virtualised.
 */
export type SearchSelectOption = {
  value: string
  label: string
  /** A grey line under the label — a domain's broad field — so similar names are easy to tell apart. */
  group?: string
}

type Base = {
  /** The sheet's title — the field's own label ("Languages"). */
  title: string
  /** One item, for the empty search: "language" → `No language matches “tulu”.` */
  noun: string
  options: readonly SearchSelectOption[]
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}
type MultiProps = Base & {
  single?: false
  value: readonly string[]
  onChange: (next: string[]) => void
  /** Chips drawn on the closed field before the rest collapse into "+n" (the feed filters use 2). */
  collapseAfter?: number
  /** The most that may be picked; at the cap the unpicked rows dim. */
  max?: number
}
type SingleProps = Base & {
  single: true
  value: string | null
  onChange: (next: string) => void
}

/** The sheet's share of the screen. */
const SHEET_SHARE = 0.85
/** 18 — the chevron and the search glyph. */
const GLYPH = space.lg + space['2xs']
/** 13 — the × on a chip and the tick in a box. */
const MARK = space.md + borderWidth.thin
const ROW = height['control-md']
/** A row with its group line under the label. */
const ROW_GROUPED = height['control-md'] + space.sm
/** The sheet's picked chips scroll after three rows, so they never squeeze the list away. */
const PICKED_MAX = height['chip-sm'] * 3 + spaceHalf['1.5'] * 2

const MARKS = /[̀-ͯ]/g

/** One character as search compares it: no accents, lower case ("Ā" → "a"). */
function foldChar(ch: string) {
  // Plain ASCII has no accents to strip; only the rest goes through normalize.
  if (ch.charCodeAt(0) < 0x80) return ch.toLowerCase()
  let s = ch
  try {
    s = s.normalize('NFD')
  } catch {
    // An engine without normalize compares the character as written.
  }
  return s.replace(MARKS, '').toLowerCase()
}

/** A label folded for search, with each folded character's index in the label as written — so a match is lit in place. */
function fold(label: string) {
  let folded = ''
  const at: number[] = []
  let i = 0
  for (const ch of label) {
    const f = foldChar(ch)
    for (let k = 0; k < f.length; k++) at.push(i)
    folded += f
    i += ch.length
  }
  return { folded, at }
}

/** Where the query sits in the label as written, or null when it does not. */
function matchIn(label: string, q: string): [number, number] | null {
  const { folded, at } = fold(label)
  const idx = folded.indexOf(q)
  if (idx < 0) return null
  const last = at[idx + q.length - 1]
  return [at[idx], last + ((label.codePointAt(last) ?? 0) > 0xffff ? 2 : 1)]
}

export function SearchSelect(props: MultiProps | SingleProps) {
  const { title, noun, options, placeholder, invalid, disabled } = props
  const single = props.single === true
  const one = props.single ? props.value : null
  const many = props.single ? null : props.value
  const picked = useMemo<readonly string[]>(() => many ?? (one ? [one] : []), [one, many])
  const max = props.single ? undefined : props.max
  const collapseAfter = props.single ? undefined : props.collapseAfter

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  // The order the list opened with: picked rows stay where they were, so a tap never moves a row out from under the finger.
  const [pinned, setPinned] = useState<readonly string[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [frame, setFrame] = useState<{ y: number; h: number } | null>(null)
  const [kbY, setKbY] = useState<number | null>(null)
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const wrapRef = useRef<React.ComponentRef<typeof View>>(null)
  const win = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  // Folded once per list, not once per keystroke.
  const foldedLabels = useMemo(() => new Map(options.map((o) => [o.value, fold(o.label).folded])), [options])
  const optionOf = (v: string): SearchSelectOption => byValue.get(v) ?? { value: v, label: v }
  const grouped = useMemo(() => options.some((o) => !!o.group), [options])
  const rowH = grouped ? ROW_GROUPED : ROW

  // The manifest says adjustResize, but with edge-to-edge the window may not shrink:
  // the sheet works out the overlap itself, as InterviewerRoomScreen's does.
  useEffect(() => {
    if (!open) return
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbY(e.endCoordinates.screenY))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbY(null))
    return () => {
      show.remove()
      hide.remove()
      setKbY(null)
    }
  }, [open])

  const needle = fold(q.trim()).folded
  const rows = useMemo(() => {
    const seen = new Set<string>()
    const out: SearchSelectOption[] = []
    const add = (o: SearchSelectOption) => {
      if (seen.has(o.value)) return
      seen.add(o.value)
      out.push(o)
    }
    if (needle) {
      // Picked values not in the list are searchable too, so they can still be found and taken off.
      for (const v of picked) if (!byValue.has(v)) add({ value: v, label: v })
      for (const o of options) add(o)
      return out.filter((o) => (foldedLabels.get(o.value) ?? fold(o.label).folded).includes(needle))
    }
    for (const v of pinned) add(byValue.get(v) ?? { value: v, label: v })
    for (const v of picked) if (!byValue.has(v)) add({ value: v, label: v })
    for (const o of options) add(o)
    return out
  }, [needle, options, byValue, foldedLabels, pinned, picked])

  function openSheet() {
    if (disabled) return
    setQ('')
    setPinned(picked)
    setOpen(true)
  }
  const close = () => {
    Keyboard.dismiss()
    setOpen(false)
  }

  function toggle(v: string) {
    if (props.single) {
      props.onChange(v)
      close()
      return
    }
    const on = props.value.includes(v)
    if (!on && max !== undefined && props.value.length >= max) return
    props.onChange(on ? props.value.filter((x) => x !== v) : [...props.value, v])
  }
  const remove = (v: string) => {
    if (!props.single) props.onChange(props.value.filter((x) => x !== v))
  }

  const atCap = max !== undefined && picked.length >= max
  const lift = kbY === null ? 0 : Math.max(0, Math.round((frame?.y ?? 0) + (frame?.h ?? win.height) - kbY))
  const room = (frame?.h ?? win.height) - lift - insets.top - space.sm
  const sheetH = Math.max(0, Math.min(Math.round(win.height * SHEET_SHARE), room))

  // ── the closed field ──
  const shown = collapseAfter !== undefined ? picked.slice(0, collapseAfter) : picked
  const more = picked.length - shown.length
  const fieldLabel = picked.length
    ? `${title}, ${picked.map((v) => optionOf(v).label).join(', ')}`
    : `${title}, ${placeholder ?? 'nothing picked'}`

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fieldLabel}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={openSheet}
        style={({ pressed }) => [
          styles.field,
          open ? styles.fieldFocus : invalid ? styles.fieldInvalid : null,
          disabled && styles.fieldOff,
          pressed && styles.pressed,
        ]}
      >
        {picked.length === 0 ? (
          <Text style={[text.uiMd, styles.placeholder]} numberOfLines={1}>{placeholder}</Text>
        ) : single ? (
          <Text style={[text.uiMd, styles.value]} numberOfLines={1}>{optionOf(picked[0]).label}</Text>
        ) : (
          <>
            {shown.map((v) => (
              <PickedChip key={v} label={optionOf(v).label} onRemove={disabled ? undefined : () => remove(v)} />
            ))}
            {more > 0 && (
              <View style={[styles.chip, styles.chipMore]}>
                <Text style={[text.uiSmMedium, styles.chipMoreText]}>{`+${more}`}</Text>
              </View>
            )}
          </>
        )}
        <View style={styles.chevron} pointerEvents="none">
          <Icon name="chevD" size={GLYPH} tint={color.textMuted} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={close} onShow={() => inputRef.current?.focus()}>
        <View
          ref={wrapRef}
          onLayout={() => wrapRef.current?.measureInWindow((_x, y, _w, h) => { if (h > 0) setFrame((f) => (f && f.y === y && f.h === h ? f : { y, h })) })}
          style={[styles.wrap, { paddingBottom: lift }]}
        >
          <Pressable accessibilityLabel="Close" onPress={close} style={styles.scrim} />
          <View style={[styles.sheet, { height: sheetH }]}>
            <View style={styles.body}>
              <Pressable accessibilityLabel="Close" onPress={close} style={styles.handleArea}>
                <View style={styles.handle} />
              </Pressable>
              <View style={styles.head}>
                <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
                {!single && <Text style={[text.uiSm, styles.muted]}>{`${picked.length} picked`}</Text>}
              </View>

              <View style={[styles.halo, searchFocused && styles.haloOn]}>
                <View style={[styles.search, searchFocused && styles.searchFocus]}>
                  <Icon name="search" size={GLYPH} tint={color.textMuted} />
                  <TextInput
                    ref={inputRef}
                    value={q}
                    onChangeText={setQ}
                    placeholder={`Search ${title.toLowerCase()}`}
                    placeholderTextColor={color.textSubtle}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    accessibilityLabel={`Search ${title.toLowerCase()}`}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    style={styles.searchInput}
                  />
                  {!!q && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" hitSlop={space.sm} onPress={() => setQ('')} style={styles.clear}>
                      <Icon name="x" size={space.md} tint={color.text} />
                    </Pressable>
                  )}
                </View>
              </View>

              {!single && picked.length > 0 && (
                <ScrollView style={styles.pickedScroll} contentContainerStyle={styles.picked} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {picked.map((v) => <PickedChip key={v} label={optionOf(v).label} onRemove={() => remove(v)} />)}
                </ScrollView>
              )}

              {!!needle && rows.length > 0 && (
                <Text style={[text.uiXsMedium, styles.matches]}>{`${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`}</Text>
              )}

              {needle && rows.length === 0 ? (
                <Text style={[text.uiMd, styles.empty]}>
                  {`No ${noun} matches “${q.trim()}”.\nCheck the spelling, or try fewer letters.`}
                </Text>
              ) : (
                <FlatList
                  data={rows}
                  extraData={picked}
                  keyExtractor={(o) => o.value}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={20}
                  getItemLayout={(_, index) => ({ length: rowH, offset: rowH * index, index })}
                  style={styles.list}
                  contentContainerStyle={single ? { paddingBottom: insets.bottom + space.md } : undefined}
                  renderItem={({ item }) => {
                    const on = picked.includes(item.value)
                    const off = !on && atCap
                    return (
                      <Row
                        option={item}
                        on={on}
                        off={off}
                        single={single}
                        needle={needle}
                        height={rowH}
                        onPress={() => toggle(item.value)}
                      />
                    )
                  }}
                />
              )}
            </View>

            {!single && (
              <View style={[styles.foot, { paddingBottom: (lift ? 0 : insets.bottom) + space.xl + space['2xs'] }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={picked.length === 0}
                  hitSlop={space.sm}
                  onPress={() => { if (!props.single) props.onChange([]) }}
                  style={({ pressed }) => [pressed && styles.pressed, picked.length === 0 && styles.dim]}
                >
                  <Text style={[text.uiMdSemi, styles.accent]}>Clear</Text>
                </Pressable>
                <Button variant="primary" size="block" label={picked.length ? `Done · ${picked.length}` : 'Done'} onPress={close} style={styles.grow} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

/** A picked value: an accent chip whose × takes it off. */
function PickedChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={[text.uiSmMedium, styles.chipText]} numberOfLines={1}>{label}</Text>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={space.sm} onPress={onRemove}>
          <Icon name="x" size={MARK} tint={color.accentText} />
        </Pressable>
      ) : (
        <Icon name="x" size={MARK} tint={color.accentText} />
      )}
    </View>
  )
}

/** One option: the label with the match lit, its group under it, and a box (or a radio) on the right. */
function Row({
  option, on, off, single, needle, height: h, onPress,
}: { option: SearchSelectOption; on: boolean; off: boolean; single: boolean; needle: string; height: number; onPress: () => void }) {
  const hit = needle ? matchIn(option.label, needle) : null
  return (
    <Pressable
      accessibilityRole={single ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: on, disabled: off }}
      accessibilityLabel={option.group ? `${option.label}, ${option.group}` : option.label}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { height: h }, pressed && styles.rowPressed]}
    >
      <View style={styles.grow}>
        <Text style={[text.uiBase, off && styles.subtle]} numberOfLines={1}>
          {hit ? (
            <>
              {option.label.slice(0, hit[0])}
              <Text style={styles.mark}>{option.label.slice(hit[0], hit[1])}</Text>
              {option.label.slice(hit[1])}
            </>
          ) : option.label}
        </Text>
        {!!option.group && <Text style={[text.uiXs, styles.subtle]} numberOfLines={1}>{option.group}</Text>}
      </View>
      {single ? (
        <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]} />
      ) : (
        <View style={[styles.box, on ? styles.boxOn : off ? styles.boxOff : styles.boxIdle]}>
          {on && <Icon name="check" size={MARK} tint={color.textInverse} weight={3.2} />}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },

  // the closed field
  field: {
    minHeight: height.control,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spaceHalf['1.5'],
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space['3xl'],
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    borderRadius: radius.tile,
  },
  fieldFocus: { borderColor: color.accent },
  fieldInvalid: { borderColor: color.dangerFill },
  fieldOff: { backgroundColor: color.surfaceMuted, borderColor: color.border },
  placeholder: { flexShrink: 1, color: color.textSubtle, paddingLeft: space.xs },
  value: { flexShrink: 1, paddingLeft: space.xs },
  chevron: { position: 'absolute', top: 0, bottom: 0, right: space.md, justifyContent: 'center' },

  chip: {
    maxWidth: '100%',
    height: height['chip-sm'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.md - borderWidth.thin,
    paddingRight: spaceHalf['1.5'],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.accentEdge,
    backgroundColor: color.accentSoft,
  },
  chipText: { flexShrink: 1, color: color.accentText },
  chipMore: { paddingRight: space.md - borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted },
  chipMoreText: { color: color.textSecondary },

  // the sheet
  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.feed,
    borderTopRightRadius: radius.feed,
    overflow: 'hidden',
  },
  body: { flex: 1, paddingHorizontal: spaceHalf['4.5'] },
  handleArea: { alignItems: 'center', paddingTop: spaceHalf['2.5'], paddingBottom: spaceHalf['3.5'] },
  handle: { width: space['3xl'], height: space.xs, borderRadius: radius.pill, backgroundColor: color.borderStrong },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  title: {
    flexShrink: 1,
    fontFamily: fontFamilyNative.bodyBold,
    fontSize: fontSize['ui-intro'],
    letterSpacing: trackingNative['snug-sm'],
    color: color.text,
  },

  // The focused search box carries a soft accent halo outside its edge; the halo takes no room.
  halo: {
    marginTop: space.md - borderWidth.stamp,
    margin: -borderWidth.stamp,
    borderWidth: borderWidth.stamp,
    borderColor: 'transparent',
    borderRadius: radius.tile + borderWidth.stamp,
  },
  haloOn: { borderColor: color.accentSoft },
  search: {
    height: height['control-md'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: spaceHalf['2.5'],
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    borderRadius: radius.tile,
    backgroundColor: color.surface,
  },
  searchFocus: { borderColor: color.accent },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-base'],
    color: color.text,
  },
  clear: {
    width: height.glyph,
    height: height.glyph,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceMuted,
  },

  pickedScroll: { flexGrow: 0, maxHeight: PICKED_MAX, marginTop: space.md },
  picked: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  matches: { color: color.textSubtle, paddingTop: space.md, paddingBottom: space['2xs'] },
  empty: {
    color: color.textMuted,
    textAlign: 'center',
    paddingVertical: space['2xl'] + space.sm,
    paddingHorizontal: spaceHalf['2.5'],
  },
  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.borderSoft,
  },
  rowPressed: { backgroundColor: color.surfaceMuted },
  mark: { fontFamily: fontFamilyNative.bodySemiBold, color: color.accent },
  box: {
    width: height.radio,
    height: height.radio,
    borderRadius: radius.sm,
    borderWidth: borderWidth.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxIdle: { borderColor: color.borderStrong, backgroundColor: color.surface },
  boxOn: { borderColor: color.accent, backgroundColor: color.accent },
  boxOff: { borderColor: color.border, backgroundColor: color.surfaceMuted },
  radio: { width: space.xl, height: space.xl, borderRadius: radius.pill },
  radioOn: { borderWidth: spaceHalf['1.5'], borderColor: color.accent },
  radioOff: { borderWidth: borderWidth.medium, borderColor: color.borderStrong },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.md,
    paddingHorizontal: spaceHalf['4.5'],
    backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
  },
})
