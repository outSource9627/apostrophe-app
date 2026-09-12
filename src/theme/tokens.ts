/**
 * THE canonical design tokens for every Apostrophe surface.
 *
 * Nothing in a component may contain a raw colour, radius, size or spacing
 * value. Everything comes from here.
 *
 * Web consumes these as CSS custom properties (app/globals.css is generated
 * from this table). React Native imports the object directly. The two are kept
 * identical by `npm run theme:sync` in the mobile repo — a colour that exists on
 * one surface and not the other is a parity defect under PRD section 7, exactly
 * like a missing feature.
 *
 * ── How the scales are named ────────────────────────────────────────────────
 * The t-shirt steps (xs, sm, base, lg, xl, 2xl…) are the system scale: reach
 * for those first. Alongside them sit numeric steps named after the pixel value
 * they carry today — `fontSize['34']`, `space['11']`, `tracking['18']`. Those
 * exist so that centralising the tokens did not move a single pixel; they are
 * the honest record of what the screens are actually built from, and they are
 * the candidates to fold into the t-shirt scale the next time the type and
 * spacing are deliberately redesigned.
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
  /** The dotted leader that runs out to a price. Crimson, drained of most of it. */
  accentMuted: '#D9A9AB',

  /** The logo mark and the darkest ink. Near-black with a blue cast. */
  ink: '#0F1A22',
  /** A panel lifted off the ink ground — the well a video thumbnail sits in. */
  inkRaised: '#1E2429',

  // text on the ink ground. White at a fraction, so the ground shows through
  // and the hierarchy survives on a dark surface.
  textOnInkMuted: 'rgba(255, 255, 255, 0.55)',
  textOnInkSubtle: 'rgba(255, 255, 255, 0.6)',

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

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 72,

  // fine steps — see the naming note at the top of this file
  '2': 2,
  '3': 3,
  '5': 5,
  '6': 6,
  '7': 7,
  '9': 9,
  '10': 10,
  '11': 11,
  '13': 13,
  '14': 14,
  '15': 15,
  '17': 17,
  '18': 18,
  '20': 20,
  '22': 22,
  '26': 26,
  '30': 30,
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,

  // fine steps — see the naming note at the top of this file
  '7': 7,
  '10': 10,
  '12': 12,
  '22': 22,
} as const

/**
 * Font size. Two kinds of step, and the difference matters.
 *
 * The t-shirt steps carry a paired line height (see `fontSizeLeading`), so
 * `text-base` sets a size AND a leading. The numeric steps set the size alone,
 * which is what the screens built on them expect — they replaced hand-written
 * `text-[34px]`, and a leading arriving out of nowhere would reflow the page.
 *
 * So: reach for a t-shirt step for body copy, and a numeric step when the
 * leading is being set deliberately next to it.
 */
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

  // fine steps — see the naming note at the top of this file. A key ending in
  // `-5` carries a half pixel: `14-5` is 14.5px.
  '9': 9,
  '10': 10,
  '10-5': 10.5,
  '11': 11,
  '12': 12,
  '12-5': 12.5,
  '13': 13,
  '13-5': 13.5,
  '14': 14,
  '14-5': 14.5,
  '15': 15,
  '16': 16,
  '17': 17,
  '19': 19,
  '21': 21,
  '22': 22,
  '26': 26,
  '28': 28,
  '30': 30,
  '32': 32,
  '34': 34,
  '36': 36,
  '38': 38,
  '40': 40,
  '42': 42,
  '46': 46,
  '56': 56,
} as const

/**
 * The line height each t-shirt step carries, as a ratio of its own size.
 *
 * These are Tailwind's own pairings for those names, written down here so this
 * file is the only thing that decides them — otherwise overriding `--text-sm`
 * leaves its leading behind in the framework, which is how a type scale ends up
 * half in the design system and half in node_modules. The odd-looking
 * divisions are those values verbatim, to the last decimal.
 */
export const fontSizeLeading = {
  xs: 'calc(1 / 0.75)',
  sm: 'calc(1.25 / 0.875)',
  base: 'calc(1.5 / 1)',
  lg: 'calc(1.75 / 1.125)',
  xl: 'calc(1.75 / 1.25)',
  '2xl': 'calc(2 / 1.5)',
  '3xl': 'calc(2.25 / 1.875)',
  '4xl': 'calc(2.5 / 2.25)',
  '5xl': '1',
} as const

/**
 * Type that scales with the viewport instead of stepping at a breakpoint. Web
 * only — React Native has no clamp() and no viewport units in a stylesheet.
 * Emitted into the same --text-* namespace, so `text-hero` is a font size like
 * any other.
 */
export const fontSizeFluid = {
  /** The landing headline: 44px on a phone, 72px on a wide desktop. */
  hero: 'clamp(2.75rem, 7vw, 4.5rem)',
} as const

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const

/**
 * Letter spacing for the web, in em so it tracks the font size.
 *
 * `tight` is for display type, which needs pulling together at large sizes.
 * The numeric steps are the uppercase eyebrow labels — em × 100, so `18` is
 * 0.18em. Small uppercase text needs the extra air to stay readable.
 */
export const tracking = {
  tight: '-0.025em',
  normal: '0em',
  wider: '0.05em',

  '2': '0.02em',
  '8': '0.08em',
  '10': '0.1em',
  '12': '0.12em',
  '13': '0.13em',
  '14': '0.14em',
  '15': '0.15em',
  '16': '0.16em',
  '18': '0.18em',
  '30': '0.3em',
} as const

/**
 * Line height for the web, unitless so it multiplies the font size.
 *
 * The numeric steps are the ratio × 100, so `155` is 1.55. Display type sits
 * just above 1 ; body copy runs from 1.4 up.
 */
export const leading = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  relaxed: 1.625,

  '104': 1.04,
  '106': 1.06,
  '108': 1.08,
  '110': 1.1,
  '140': 1.4,
  '150': 1.5,
  '155': 1.55,
  '160': 1.6,
  '168': 1.68,
  '175': 1.75,
} as const

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
export const fontFamilyNative = {
  display: 'PlayfairDisplay-Regular',
  body: 'Inter-Regular',
  /** The platform's own serif, where the bundled display face is not used. */
  displayFallback: 'serif',
} as const

/**
 * The wordmark's face on mobile, per platform. iOS ships Georgia and Android
 * does not, so Android falls back to whatever serif it has. Pass this straight
 * to `Platform.select`.
 */
export const fontFamilyNativeWordmark = { ios: 'Georgia', android: 'serif', default: 'serif' } as const

/**
 * React Native has no em and no unitless line height — both are absolute
 * numbers — so the two web scales above cannot be handed to it directly.
 * These are the same design decisions expressed in points.
 */
export const trackingNative = {
  tightest: -0.8,
  tighter: -0.5,
  tight: -0.4,
  snug: -0.3,
  wide: 0.9,
  wider: 1.3,
  widest: 1.5,
  eyebrowTight: 1.6,
  eyebrow: 1.8,
} as const

export const leadingNative = {
  body: 18,
  bodyLg: 20,
  lede: 21,
  ledeLg: 22,
  display: 34,
  displayLg: 42,
} as const

/**
 * Opacity. `pressed` is the dip a button takes under a finger, `disabled` the
 * state of an action that is not available yet.
 */
export const opacity = { pressed: 0.85, disabled: 0.5, hidden: 0 } as const

/**
 * Border weights. `thin` is every hairline in the product — a 1px rule at any
 * density. `accent` is the thicker bar that marks a pull quote.
 */
export const borderWidth = { thin: 1, accent: 2 } as const

/**
 * Two shadows in the whole system. `card` lifts a surface off the page; `focus`
 * is the ring a field wears while it has the caret.
 */
export const shadow = {
  card: '0 1px 2px rgba(15, 26, 34, 0.04), 0 12px 32px -12px rgba(15, 26, 34, 0.12)',
  focus: '0 0 0 3px rgba(22, 25, 28, 0.06)',
} as const

/**
 * Widths a box is allowed to reach. The `measure*` steps are reading measures —
 * how wide a column of prose may run before it gets hard to track from the end
 * of one line to the start of the next. The rest are structural.
 *
 * On the web these drive `max-w-*`, `w-*` and `min-w-*` alike.
 */
export const container = {
  'measure-xs': 392,
  'measure-sm': 420,
  'measure-md': 500,
  'measure-lg': 520,
  'measure-xl': 560,
  'measure-2xl': 616,
  'measure-3xl': 620,
  'measure-4xl': 760,
  'measure-5xl': 810,

  /** The admin panel's content column. It is desktop-only (AD-01). */
  shell: 1400,
  /** The profile wizard's progress rail. */
  rail: 296,
  /** The wider proof rail beside the landing headline. */
  'rail-wide': 340,
  /** The aside on a split page — the proof column beside a form. */
  aside: 430,
  /** The well an unstarted video sits in, on narrow screens. */
  'thumb-col': 122,
  /** A video thumbnail, 9:16 against `height['video-thumb']`. */
  'video-thumb': 68,
  /** The same thumbnail in the mobile list, against `height['video-thumb-compact']`. */
  'video-thumb-compact': 58,

  /** The measure a line of mobile body copy runs to. */
  'measure-native': 280,

  // floors rather than ceilings: the narrowest a control may get
  'col-min': 260,
  'label-min': 120,
  'input-min': 128,
} as const

/**
 * Fixed heights. Anything a finger or a cursor has to hit lives here, so the
 * hit targets across the product can be checked — and changed — in one place.
 *
 * Web has no `--height-*` theme namespace, so globals.css turns each of these
 * into an `@utility h-<name>` that behaves like any other Tailwind utility
 * (`sm:h-header-lg` works).
 */
export const height = {
  /** Inputs, selects and buttons in a form. */
  control: 50,
  /** The one primary action in the pay bar, a touch taller than a field. */
  'control-lg': 52,
  header: 60,
  'header-lg': 72,
  'otp-cell': 76,
  'otp-cell-lg': 96,
  /** The pay bar itself, and the spacer that keeps it off the content. */
  'pay-bar': 88,
  'pay-bar-stacked': 136,
  'video-thumb': 116,
  /** The empty well on the unfinished-profile card. */
  well: 400,
  /** The smallest square a finger reliably hits. */
  tap: 44,
  /** A tap row given a little more room than the minimum. */
  'tap-lg': 46,
  /** A field on mobile, where a finger needs more than a cursor does. */
  'control-touch': 54,
  /** The top bar on a mobile screen, and the shorter one over the wizard. */
  'app-bar': 52,
  'app-bar-compact': 50,
  /** The avatar circle in the mobile top bar, inside a `tap`-sized target. */
  avatar: 34,
  /** The unfinished-profile well, on a phone. */
  'well-compact': 286,
  /** A video thumbnail in the mobile list, against `container['video-thumb-compact']`. */
  'video-thumb-compact': 84,
  /**
   * The signed-in header, measured rather than set: it is padding plus the
   * wordmark. `min-h-below-app-header` subtracts it from the viewport, so if
   * that header's padding changes this number has to change with it.
   */
  'app-header': 57,
} as const

/**
 * The page skeletons. Three two-column layouts in the product, and the column
 * widths come from `container` above so a measure is never written twice.
 */
export const gridTemplate = {
  /** Landing: the proof rail beside the headline. */
  home: `${container['rail-wide']}px 1fr`,
  /** Pricing: a measure-wide column of copy, then the tier list. */
  pricing: `minmax(0, ${container['measure-4xl']}px) 1fr`,
  /** Admin detail: the record, then a rail of actions. */
  'admin-detail': '1fr 20rem',
} as const

/**
 * Motion. One animation in the product: the sweep that runs across the progress
 * bar while a payment is confirming. It lives here rather than in the component
 * so the easing is a token like everything else.
 *
 * The `sweep` keyframes themselves are in the generated globals.css.
 */
export const animation = {
  sweep: 'sweep 1.7s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
} as const

/**
 * The brand mark's own proportions.
 *
 * The wordmark sets larger than the glyph beside it: the serif has a small
 * x-height, so matching the two sizes makes the word look shrunken next to the
 * mark. This is the ratio that makes them read as one lockup.
 */
export const brand = {
  wordmarkRatio: 1.15,
} as const

/** Interview capture is locked to 9:16 (IR-02); every card that shows one mirrors it. */
export const aspect = { videoResume: 9 / 16, fullVideo: 16 / 9 } as const

export type ColorToken = keyof typeof color
