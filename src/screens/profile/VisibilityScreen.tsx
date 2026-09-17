import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api, ApiClientError } from '../../lib/api'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Banner, Body, Button, Display, Eyebrow, Meta, Toggle } from '../../components/ui'

interface Audience { hiddenFromFeed: boolean; published: boolean }

/**
 * ST-22 — one switch that removes the student from the employer feed. Hiding
 * never deletes and never disconnects, and the screen says so — no confirm
 * dialog, no danger zone, no crimson. Until a video resume is published the
 * student is not in the feed at all, so the switch shows its not-applicable
 * state. Mirrors the web VisibilityClient.
 */
export function VisibilityScreen({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [hidden, setHidden] = useState(false)
  const [changedAt, setChangedAt] = useState<string | null>(null)

  const q = useQuery({ queryKey: ['audience'], queryFn: () => api.get<Audience>('/students/me/audience') })
  useEffect(() => { if (q.data) setHidden(q.data.hiddenFromFeed) }, [q.data])

  const mut = useMutation({
    mutationFn: (next: boolean) => api.patch('/students/me/profile', { hiddenFromFeed: next }),
    onSuccess: (_r, next) => { setChangedAt(new Date().toISOString()); qc.invalidateQueries({ queryKey: ['audience'] }); void next },
    onError: () => { if (q.data) setHidden(q.data.hiddenFromFeed) },
  })
  const toggle = (next: boolean) => { setHidden(next); mut.mutate(next) }

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Account" onBack={onBack} />{child}</View>
  )
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError && !(q.error instanceof ApiClientError && q.error.status === 404)) {
    return frame(<View style={styles.centre}><Body tone="muted">Could not load your visibility.</Body></View>)
  }
  const aud = q.data ?? { hiddenFromFeed: false, published: false }
  const err = mut.isError ? 'Could not change your visibility. Try again.' : null

  if (!aud.published) {
    return frame(
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Who can find you.</Display>
        <View style={styles.well}>
          <Toggle on={false} disabled label="Show me in the employer feed" />
          <Body size="sm" tone="muted" style={{ marginTop: space.md }}>
            This switch controls whether your video resume appears in the employer feed. You do not have one yet — it comes out of your interview, and the switch turns on by itself the day your film is published.
          </Body>
        </View>
        <Button variant="primary" size="lg" full label="Book an interview" onPress={onBook} />
      </ScrollView>,
    )
  }

  return frame(
    hidden ? (
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">You are hidden.</Display>
        <View style={styles.card}>
          <Toggle on={false} onChange={toggle} disabled={mut.isPending} label="Show me in the employer feed" />
          {changedAt && <Meta style={{ color: color.textSubtle, marginTop: space.md }}>Off since {fmtWhen(changedAt)}</Meta>}
        </View>
        <View style={{ gap: space.sm }}>
          <Eyebrow>What changed</Eyebrow>
          <Body size="sm">Employers cannot find you in the feed. New employers will not come across your profile.</Body>
        </View>
        <View style={{ gap: space.sm }}>
          <Eyebrow>What did not change</Eyebrow>
          <Facts items={['Your video resume is intact, exactly where it was.', 'Your connections stand.', 'Your chats are open, and those employers can still reach you.']} />
        </View>
        {err ? <Banner tone="danger">{err}</Banner> : null}
        <View style={{ marginTop: 'auto', gap: space.sm, paddingBottom: insets.bottom }}>
          <Button variant="primary" size="lg" full busy={mut.isPending} label="Show me in the feed again" onPress={() => toggle(false)} />
          <Body size="xs" tone="subtle">You are back in the feed the moment you tap it.</Body>
        </View>
      </ScrollView>
    ) : (
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Who can find you.</Display>
        <View style={styles.card}>
          <Toggle on onChange={toggle} disabled={mut.isPending} label="Show me in the employer feed" />
          <Body size="sm" tone="muted" style={{ marginTop: space.md }}>Employers swiping the feed see your video resume and your profile, and can send you an Interest.</Body>
        </View>
        <View style={{ gap: space.sm }}>
          <Eyebrow>If you turn this off</Eyebrow>
          <Body size="sm" tone="muted">You stop appearing in the employer feed. That is the whole of it — everything below stays exactly as it is.</Body>
          <Facts items={['Your video resume is untouched. Turning this off never deletes it.', 'Your existing connections stand.', 'Chats you are already in carry on, and those employers can still reach you.', 'Turn it back on whenever you like. Nothing is lost in between.']} />
        </View>
        <Meta style={{ color: color.textSubtle }}>Takes effect immediately</Meta>
        {err ? <Banner tone="danger">{err}</Banner> : null}
      </ScrollView>
    ),
  )
}

function Facts({ items }: { items: string[] }) {
  return (
    <View style={{ gap: space.sm }}>
      {items.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: space.sm }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
            <Path d="M20 6 9 17l-5-5" stroke={color.success} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Body size="sm" style={{ flex: 1 }}>{t}</Body>
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
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  well: { borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceMuted, padding: space.lg },
  card: { borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, padding: space.lg },
})
