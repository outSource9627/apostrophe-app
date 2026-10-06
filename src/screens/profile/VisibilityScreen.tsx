import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { borderWidth, color, fontFamilyNative as FF, fontSize } from '../../theme'
import { Icon } from '../../components/ui/Icon'
import { Btn, DetailHeader, Skel } from '../../components/tab/kit'
import { FeedVisibilitySheet } from './FeedVisibilitySheet'

interface Audience { hiddenFromFeed: boolean; published: boolean }

/**
 * ST-22 — one switch that removes the student from the employer feed. Hiding
 * never deletes and never disconnects, and the screen says so — no danger zone,
 * no crimson. Either direction asks first, in a plain ink sheet
 * (FeedVisibilitySheet), so a stray tap never moves the student in or out of
 * the feed. Until a video resume is published the
 * student is not in the feed at all, so the switch shows its not-applicable
 * state. Mirrors the web VisibilityClient. Option A of
 * docs/student-receipts-privacy-mockup.html: the switch card as the hero.
 */
export function VisibilityScreen({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [hidden, setHidden] = useState(false)
  const [changedAt, setChangedAt] = useState<string | null>(null)
  const [ask, setAsk] = useState<boolean | null>(null)

  const q = useQuery({ queryKey: ['audience'], queryFn: () => api.get<Audience>('/students/me/audience') })
  useEffect(() => { if (q.data) setHidden(q.data.hiddenFromFeed) }, [q.data])

  const mut = useMutation({
    mutationFn: (next: boolean) => api.patch('/students/me/profile', { hiddenFromFeed: next }),
    onSuccess: (_r, next) => { setHidden(next); setAsk(null); setChangedAt(new Date().toISOString()); qc.invalidateQueries({ queryKey: ['audience'] }) },
  })
  // The switch and the button only ask; the sheet's confirm saves. `next` is the hidden value.
  const toggle = (next: boolean) => { mut.reset(); setAsk(next) }

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><DetailHeader title="Visibility" onBack={onBack} />{child}</View>
  )
  if (q.isPending) return frame(<View style={styles.body}><Skel w="100%" h={96} /><Skel w="100%" h={96} /><Skel w="100%" h={96} /></View>)
  if (q.isError && !(q.error instanceof ApiClientError && q.error.status === 404)) {
    return frame(<View style={styles.centre}><Text style={styles.load}>Could not load your visibility.</Text></View>)
  }
  const aud = q.data ?? { hiddenFromFeed: false, published: false }
  const err = mut.isError ? 'Could not change your visibility. Try again.' : null
  const sheet = <FeedVisibilitySheet hide={ask} busy={mut.isPending} error={err} onConfirm={(next) => mut.mutate(next)} onClose={() => setAsk(null)} />

  if (!aud.published) {
    return frame(
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.h}>Who can find you.</Text>
        <View style={styles.well}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show me in the employer feed</Text>
            <Switch on={false} disabled label="Show me in the employer feed" />
          </View>
          <Text style={[styles.p, styles.gapTop]}>
            This switch controls whether your video resume appears in the employer feed. You do not have one yet — it comes out of your interview, and the switch turns on by itself the day your film is published.
          </Text>
        </View>
        <Btn variant="primary" label="Book an interview" onPress={onBook} style={styles.big} />
      </ScrollView>,
    )
  }

  return frame(<>{
    hidden ? (
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.h}>You are hidden.</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show me in the employer feed</Text>
            <Switch on={false} onChange={toggle} disabled={mut.isPending} label="Show me in the employer feed" />
          </View>
          {changedAt && <Text style={[styles.meta, styles.gapTop]}>Off since {fmtWhen(changedAt)}</Text>}
        </View>
        <View style={styles.group}>
          <Text style={styles.eyebrow}>What changed</Text>
          <Text style={styles.pDark}>Employers cannot find you in the feed. New employers will not come across your profile.</Text>
        </View>
        <View style={styles.group}>
          <Text style={styles.eyebrow}>What did not change</Text>
          <Facts items={['Your video resume is intact, exactly where it was.', 'Your connections stand.', 'Your chats are open, and those employers can still reach you.']} />
        </View>
        <View style={styles.group}>
          <Btn variant="primary" disabled={mut.isPending} label="Show me in the feed again" onPress={() => toggle(false)} style={styles.big} />
          <Text style={styles.metaCentre}>You are back in the feed the moment you tap it.</Text>
        </View>
      </ScrollView>
    ) : (
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.h}>Who can find you.</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show me in the employer feed</Text>
            <Switch on onChange={toggle} disabled={mut.isPending} label="Show me in the employer feed" />
          </View>
          <Text style={[styles.p, styles.gapTop]}>Employers swiping the feed see your video resume and your profile, and can send you an Interest.</Text>
        </View>
        <View style={styles.group}>
          <Text style={styles.eyebrow}>If you turn this off</Text>
          <Text style={styles.p}>You stop appearing in the employer feed. That is the whole of it — everything below stays exactly as it is.</Text>
          <Facts items={['Your video resume is untouched. Turning this off never deletes it.', 'Your existing connections stand.', 'Chats you are already in carry on, and those employers can still reach you.', 'Turn it back on whenever you like. Nothing is lost in between.']} />
        </View>
        <Text style={styles.meta}>Takes effect immediately</Text>
      </ScrollView>
    )
  }{sheet}</>)
}

/** The mockup's 52x30 switch: green when on, sunken grey when off, dimmed when not applicable. */
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange?.(!on)}
      style={[styles.track, on && styles.trackOn, !on && !!disabled && styles.trackDim]}
    >
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  )
}

function Facts({ items }: { items: string[] }) {
  return (
    <View style={styles.facts}>
      {items.map((t) => (
        <View key={t} style={styles.fact}>
          <View style={styles.tick}><Icon name="check" size={16} tint={color.successFill} weight={2.2} /></View>
          <Text style={styles.factText}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

function fmtWhen(iso: string): string {
  const d = new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60000)
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getUTCHours(); const m = d.getUTCMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 20 },
  h: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: color.text },
  load: { fontFamily: FF.body, fontSize: 15, color: color.textMuted },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, padding: 16 },
  well: { backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 14, padding: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, fontFamily: FF.bodySemiBold, fontSize: 16, letterSpacing: -0.24, color: color.text },
  gapTop: { marginTop: 12 },
  p: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
  pDark: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.text },
  meta: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-base'], color: color.textSubtle },
  metaCentre: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-base'], color: color.textSubtle, textAlign: 'center' },
  eyebrow: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },
  group: { gap: 10 },
  facts: { gap: 10 },
  fact: { flexDirection: 'row', gap: 10 },
  tick: { marginTop: 3 },
  factText: { flex: 1, fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
  big: { height: 52 },
  track: { width: 52, height: 30, borderRadius: 15, backgroundColor: color.surfaceSunken },
  trackOn: { backgroundColor: color.successFill },
  trackDim: { opacity: 0.55 },
  knob: { position: 'absolute', top: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: color.surface },
  knobOn: { left: 25 },
  knobOff: { left: 3 },
})
