/**
 * THE canonical design tokens for every Apostrophe surface.
 *
 * Nothing in a component may contain a raw colour, radius or spacing value.
 * Everything comes from here.
 *
 * Web consumes these as CSS custom properties (see app/globals.css, which is
 * generated from this table). React Native imports the object directly. The two
 * are kept identical by `npm run sync:theme` in the mobile repo — a colour that
 * exists on one surface and not the other is a parity defect, exactly like a
 * missing feature.
 */
export const color = {
  // grounds
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDEFF7',
  surfaceSunken: '#E2E6F2',

  // text — on light grounds
  text: '#141829',
  textMuted: '#474D68',
  textSubtle: '#737B9A',
  textInverse: '#FFFFFF',

  // structure
  border: '#D7DCEA',
  borderStrong: '#C2C9DD',

  // brand
  accent: '#3A34C8',
  accentHover: '#2F2AA8',
  accentSoft: '#E7E6FC',

  // semantic state — kept separate from the accent on purpose, so "brand" and
  // "this went well" never collapse into the same colour
  success: '#0C7355',
  successSoft: '#DCF0E9',
  warning: '#8E540A',
  warningSoft: '#F8EAD4',
  danger: '#A93122',
  dangerSoft: '#FAE3DF',
  info: '#0E6E8C',
  infoSoft: '#DDEEF4',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 } as const

export const radius = { sm: 4, md: 6, lg: 10, pill: 999 } as const

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const

/** Interview capture is locked to 9:16 (IR-02); the card mirrors it. */
export const aspect = { videoResume: 9 / 16, fullVideo: 16 / 9 } as const

export type ColorToken = keyof typeof color
