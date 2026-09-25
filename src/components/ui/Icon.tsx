import React from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { color as palette } from '../../theme'

/**
 * The design's icon set (Employer Android, `gen/h.js` → `H.P`), drawn on a 24
 * grid with round caps and joins — the same shapes the boards draw, so no
 * screen hand-rolls a glyph. Shared by every persona.
 *
 * `fill` fills the shape (the solid play triangle, a filled heart) as well as
 * stroking it.
 */
type Shape =
  | { d: string }
  | { rect: [number, number, number, number, number] }
  | { circle: [number, number, number] }

const P = (d: string): Shape => ({ d })
const R = (x: number, y: number, w: number, h: number, rx = 0): Shape => ({ rect: [x, y, w, h, rx] })
const C = (cx: number, cy: number, r: number): Shape => ({ circle: [cx, cy, r] })

const ICONS = {
  play: [R(3, 3, 18, 18, 4), P('M10 8.5v7l6-3.5z')],
  bookmark: [P('M6 3h12v18l-6-4-6 4z')],
  heart: [P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z')],
  brief: [R(3, 7, 18, 13, 2), P('M9 7V5h6v2M3 12h18')],
  chat: [P('M4 5h16v11H9l-5 4z')],
  bell: [P('M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4')],
  filter: [P('M4 5h16l-6 8v6l-4-2v-4z')],
  search: [C(11, 11, 6), P('M20 20l-4-4')],
  lock: [R(5, 11, 14, 9, 2), P('M8 11V8a4 4 0 0 1 8 0v3')],
  check: [P('M5 12l4 4 10-10')],
  x: [P('M6 6l12 12M18 6L6 18')],
  undo: [P('M9 14L4 9l5-5'), P('M4 9h10a6 6 0 0 1 0 12h-3')],
  video: [R(3, 6, 13, 12, 2), P('M16 10l5-3v10l-5-3')],
  mute: [P('M4 9h4l5-4v14l-5-4H4z'), P('M17 9l4 6M21 9l-4 6')],
  sound: [P('M4 9h4l5-4v14l-5-4H4z'), P('M17 8a5 5 0 0 1 0 8')],
  upload: [P('M12 16V4M7 9l5-5 5 5M4 20h16')],
  file: [P('M6 3h8l4 4v14H6z'), P('M14 3v4h4')],
  more: [C(5, 12, 1.2), C(12, 12, 1.2), C(19, 12, 1.2)],
  shield: [P('M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z'), P('M9 12l2 2 4-4')],
  arrowL: [P('M19 12H5M11 6l-6 6 6 6')],
  arrowR: [P('M5 12h14M13 6l6 6-6 6')],
  chevR: [P('M9 6l6 6-6 6')],
  chevD: [P('M6 9l6 6 6-6')],
  plus: [P('M12 5v14M5 12h14')],
  send: [P('M4 12l16-8-6 16-3-7z')],
  clip: [P('M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7')],
  image: [R(3, 4, 18, 16, 2), C(9, 10, 2), P('M21 16l-5-5-9 9')],
  download: [P('M12 4v12M7 11l5 5 5-5M4 20h16')],
  eye: [P('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'), C(12, 12, 3)],
  pause: [P('M8 5v14M16 5v14')],
  tri: [P('M7 5l12 7-12 7z')],
  max: [P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')],
  users: [C(9, 8, 3.5), P('M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6')],
  flag: [P('M5 21V4h11l-2 4 2 4H5')],
  ban: [C(12, 12, 9), P('M6 6l12 12')],
  tag: [P('M3 12V4h8l10 10-8 8z'), C(7.5, 8.5, 1)],
  note: [P('M5 4h14v16H5zM8 9h8M8 13h8M8 17h5')],
  clock: [C(12, 12, 9), P('M12 7v5l3 2')],
  ticks: [P('M2 13l4 4L14 9M10 17l8-8')],
  edit: [P('M4 20h4L19 9l-4-4L4 16z')],
  trash: [P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13')],
  globe: [C(12, 12, 9), P('M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18')],
  pin: [P('M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z'), C(12, 9, 2.5)],
  mail: [R(3, 5, 18, 14, 2), P('M3 7l9 6 9-6')],
  refresh: [P('M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6')],
  alert: [P('M12 3l10 18H2z'), P('M12 10v5M12 18v.5')],
  info: [C(12, 12, 9), P('M12 11v6M12 7.5v.5')],
  cal: [R(3, 5, 18, 16, 2), P('M3 10h18M8 3v4M16 3v4')],
  phone: [R(7, 2, 10, 20, 2), P('M11 18h2')],
  building: [P('M4 21V5l8-3v19M12 21h8V9l-8-3M8 9v.5M8 13v.5M8 17v.5M16 13v.5M16 17v.5')],
  out: [P('M10 4H5v16h5M15 8l4 4-4 4M19 12H9')],
  sliders: [P('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12'), C(16, 6, 2), C(10, 12, 2), C(18, 18, 2)],
  grid: [R(4, 4, 7, 7, 1.5), R(13, 4, 7, 7, 1.5), R(4, 13, 7, 7, 1.5), R(13, 13, 7, 7, 1.5)],
} satisfies Record<string, Shape[]>

export type IconName = keyof typeof ICONS

export function Icon({
  name, size = 18, tint = palette.text, weight = 1.8, fill,
}: { name: IconName; size?: number; tint?: string; weight?: number; fill?: string }) {
  const p = { stroke: tint, strokeWidth: weight, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: fill ?? 'none' }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[name].map((s, i) =>
        'd' in s ? <Path key={i} d={s.d} {...p} />
          : 'rect' in s ? <Rect key={i} x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx={s.rect[4]} {...p} />
            : <Circle key={i} cx={s.circle[0]} cy={s.circle[1]} r={s.circle[2]} {...p} />,
      )}
    </Svg>
  )
}
