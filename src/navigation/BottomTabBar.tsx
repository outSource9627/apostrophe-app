import React from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { color } from '../theme'
import { TabBar, type TabItem } from '../components/ui'
import { tabBarInfoFor, type TabDef } from './tabConfig'

/**
 * A persistent bottom tab bar, added as an overlay on the existing flat
 * `RootStackParamList` stack in App.tsx rather than as a nested tab
 * navigator that OWNS routing.
 *
 * WHY AN OVERLAY, NOT A NESTED NAVIGATOR: this app's ~100 routes cross-link
 * heavily — a screen in what would be the Jobs tab pushes into the booking
 * flow, Applications jumps straight into a Chat-tab thread, and so on. React
 * Navigation only auto-resolves `navigate('X')` one level of nesting;
 * anything deeper needs the explicit `{ screen, params }` chain at every one
 * of those crossings. Rewriting every cross-tab call in App.tsx to do that,
 * with new composite types for ~100 routes, was judged higher risk than it
 * was worth for what a tab bar actually needs to do here. This overlay
 * changes NONE of App.tsx's existing `navigate()` calls — every one keeps
 * working exactly as it does today.
 *
 * WHY THIS DOESN'T DRAW ITS OWN TAB ROW: it did, the first time — until a
 * Phase 5 chrome audit found `components/ui/overlay.tsx` already ships a
 * `TabBar` (items/current/onSelect, platform-correct iOS/Android treatment,
 * badges) that no screen had ever mounted. Redrawing the row here would have
 * left two bottom-tab-bar implementations in the product for one feature —
 * exactly the "nine sessions, fifteen names" failure this codebase's own
 * comments warn about elsewhere. So this component now does only the part
 * `TabBar` cannot: reading the current route, deciding whether a bar shows at
 * all and for which persona (`tabConfig.ts`), and turning a tap into the
 * plain top-level `navigate()` this app already uses. `TabBar` still owns
 * every visual decision.
 *
 * TRADE-OFF, stated plainly: switching tabs lands on that tab's root screen
 * rather than wherever you last left it (a real nested navigator remembers
 * each tab's own back-stack). Worth revisiting as its own small addition if
 * that's felt in practice; not attempted here.
 *
 * `tabConfig.ts` is the only routing data this reads: a route-name →
 * (persona, tab) map. A route with no entry there hides the bar — auth
 * screens and the shared flows (booking, payment, the room) that are
 * deliberately full-screen regardless of which tab they were entered from.
 */
export function BottomTabBar({ routeName, onNavigate }: { routeName?: string; onNavigate: (root: string) => void }) {
  const info = tabBarInfoFor(routeName)
  // ST-12: an unpaid student sees pricing and pays — no destinations to wander to.
  // Same `me` the screens read, so this costs no extra request once one has run.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ paid: boolean }>('/students/me'),
    enabled: info?.persona === 'student',
  })

  if (!info) return null
  if (info.persona === 'student' && me.data && !me.data.paid) return null

  const items: TabItem[] = info.tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    glyph: <TabIcon icon={tab.icon} color={tab.key === info.active ? color.accent : color.textSubtle} />,
  }))

  return (
    <TabBar
      items={items}
      current={info.active}
      onSelect={(key) => {
        const tab = info.tabs.find((t) => t.key === key)
        if (tab) onNavigate(tab.root)
      }}
    />
  )
}

function TabIcon({ icon, color: tint }: { icon: TabDef['icon']; color: string }) {
  const p = { fill: 'none' as const, stroke: tint, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (icon) {
    case 'home':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M3 9.5L10 3.5L17 9.5" {...p} />
          <Path d="M5 8V16.5H15V8" {...p} />
        </Svg>
      )
    case 'calendar':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x={3} y={4} width={14} height={13} rx={2} {...p} />
          <Path d="M3 8H17" {...p} />
          <Path d="M7 2.5V5.5M13 2.5V5.5" {...p} />
        </Svg>
      )
    case 'briefcase':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x={2.5} y={6} width={15} height={10} rx={2} {...p} />
          <Path d="M7 6V4.5C7 3.7 7.7 3 8.5 3H11.5C12.3 3 13 3.7 13 4.5V6" {...p} />
        </Svg>
      )
    case 'chat':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path
            d="M3 5.5C3 4.4 3.9 3.5 5 3.5H15C16.1 3.5 17 4.4 17 5.5V11.5C17 12.6 16.1 13.5 15 13.5H8L4 16.5V13.5H5C3.9 13.5 3 12.6 3 11.5V5.5Z"
            {...p}
          />
        </Svg>
      )
    case 'heart':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M10 16.5C10 16.5 3 12.3 3 7.6C3 5.5 4.6 4 6.5 4C8 4 9.3 4.9 10 6.2C10.7 4.9 12 4 13.5 4C15.4 4 17 5.5 17 7.6C17 12.3 10 16.5 10 16.5Z" {...p} />
        </Svg>
      )
    case 'person':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Circle cx={10} cy={7} r={3} {...p} />
          <Path d="M4 17C4 13.7 6.7 11.5 10 11.5C13.3 11.5 16 13.7 16 17" {...p} />
        </Svg>
      )
    case 'clock':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Circle cx={10} cy={10} r={7} {...p} />
          <Path d="M10 6V10L13 12" {...p} />
        </Svg>
      )
    case 'wallet':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x={2.5} y={5.5} width={15} height={10} rx={2} {...p} />
          <Path d="M13.5 10.5H16" stroke={tint} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )
    case 'feed':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x={3} y={4.3} width={14} height={2.2} rx={1.1} fill={tint} />
          <Rect x={3} y={8.9} width={14} height={2.2} rx={1.1} fill={tint} />
          <Rect x={3} y={13.5} width={14} height={2.2} rx={1.1} fill={tint} />
        </Svg>
      )
    case 'star':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M10 2.5L12 7.2L17 7.7L13.2 11L14.3 16L10 13.4L5.7 16L6.8 11L3 7.7L8 7.2L10 2.5Z" {...p} />
        </Svg>
      )
  }
}
