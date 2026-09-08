/**
 * THE canonical design tokens for every Apostrophe surface.
 *
 * Nothing in a component may contain a raw colour, radius or spacing value.
 * Everything comes from here.
 *
 * Web consumes these as CSS custom properties (app/globals.css is generated
 * from this table). React Native imports the object directly. The two are kept
 * identical by `npm run theme:sync` in the mobile repo — a colour that exists on
 * one surface and not the other is a parity defect under PRD section 7, exactly
 * like a missing feature.
 */
export const color = {
  // grounds — paper white, because the brand leans editorial rather than SaaS
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F5F3',
  surfaceSunken: '#EDEBE7',

  // text
  text: '#16191C',
  textMuted: '#5C6066',
  textSubtle: '#8B9096',
  textInverse: '#FFFFFF',

  // structure — warm greys, biased toward the ink rather than pure neutral
  border: '#E4E2DE',
  borderStrong: '#CFCCC6',

  /**
   * Crimson. The single loud colour in the system: it marks the primary action
   * and nothing else, so "red" always means "this is the thing to press".
   */
  accent: '#B01E24',
  accentHover: '#8F181D',
  accentSoft: '#FBECEC',

  /** The logo mark and the darkest ink. Near-black with a blue cast. */
  ink: '#0F1A22',

  // semantic state — deliberately not the accent, so "brand" and "this worked"
  // never collapse into the same colour
  success: '#0C7355',
  successSoft: '#E4F1EC',
  warning: '#8E540A',
  warningSoft: '#F9EFDD',
  danger: '#A93122',
  dangerSoft: '#FAE9E6',
  info: '#0E6E8C',
  infoSoft: '#E3EFF4',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48, '4xl': 72 } as const

export const radius = { sm: 4, md: 8, lg: 14, pill: 999 } as const

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
  '5xl': 64,
} as const

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const

/**
 * Two faces, two jobs. The serif carries the voice — headlines, the wordmark,
 * the numbered section titles. The sans carries everything a person has to
 * read carefully: body copy, labels, forms, the whole admin panel.
 */
export const fontFamily = {
  // The *-loaded variables are set by next/font, which self-hosts the files.
  // The stacks after them are what renders if that has not resolved yet.
  display: "var(--font-display-loaded), 'Iowan Old Style', Georgia, serif",
  body: "var(--font-body-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const

/** React Native cannot parse a CSS font stack; it needs the family name alone. */
export const fontFamilyNative = { display: 'PlayfairDisplay-Regular', body: 'Inter-Regular' } as const

/** Interview capture is locked to 9:16 (IR-02); every card that shows one mirrors it. */
export const aspect = { videoResume: 9 / 16, fullVideo: 16 / 9 } as const

export type ColorToken = keyof typeof color
