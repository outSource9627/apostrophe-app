import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getPreparation, type Preparation } from '../../lib/api/interviews'
import { color, space } from '../../theme'
import { AppBar, Body, Card, Eyebrow, Skeleton, text } from '../../components/ui'

/**
 * SC-34 — the preparation guide: lighting, background, network and the areas the
 * interview will cover, all fed from GET /interviews/:id/preparation. Rendered
 * defensively: a section appears only if the server sent it, as a string or a list.
 */
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' && v ? [v] : [])

const SECTIONS: { key: keyof Preparation; title: string }[] = [
  { key: 'lighting', title: 'Lighting' },
  { key: 'background', title: 'Background' },
  { key: 'network', title: 'Network' },
]

export function PreparationScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['preparation', id], queryFn: () => getPreparation(id) })
  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load the preparation guide.</Body></View>)

  const areas = Array.isArray(q.data.questionAreas) ? q.data.questionAreas : []
  return frame(
    <ScrollView contentContainerStyle={styles.body}>
      <View style={{ gap: space.sm }}>
        <Eyebrow tone="accent">Before you join</Eyebrow>
        <Text style={text.displayLead}>How to prepare.</Text>
      </View>
      {SECTIONS.map(({ key, title }) => {
        const items = asList(q.data[key])
        if (!items.length) return null
        return (
          <Card key={key} style={styles.card}>
            <Text style={text.uiBaseSemi}>{title}</Text>
            {items.map((t, i) => <Body key={i} size="sm" tone="muted">{t}</Body>)}
          </Card>
        )
      })}
      {areas.length > 0 && (
        <Card style={styles.card}>
          <Text style={text.uiBaseSemi}>What the interview covers</Text>
          {areas.map((a, i) => typeof a === 'string'
            ? <Body key={i} size="sm" tone="muted">{a}</Body>
            : (
              <View key={i} style={{ gap: space.xs }}>
                <Text style={text.uiMdSemi}>{a.title}</Text>
                {(a.prompts ?? []).map((p, j) => <Body key={j} size="sm" tone="muted">{p}</Body>)}
              </View>
            ))}
        </Card>
      )}
    </ScrollView>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.lg, paddingBottom: space.xl },
  card: { gap: space.sm, padding: space.lg },
})
