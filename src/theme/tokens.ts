/**
 * THE canonical design tokens for every Apostrophe surface.
 *
 * Nothing in a component may contain a raw colour, radius, size or spacing
 * value. Everything comes from here.
 *
 * Web consumes these as CSS custom properties (app/globals.css is generated
 * from this table). React Native imports the object directly. The two are kept
 * identical by `npm run theme:sync` in the other repos — a colour that exists on
 * one surface and not the other is a parity defect under PRD section 7, exactly
 * like a missing feature.
 *
 * ── Three families, one job each ────────────────────────────────────────────
 * The foundation rests on a single typographic idea: type carries the design,
 * so colour does not have to. Every size token therefore names the family it
 * belongs to, and the binding is not negotiable at the call site.
 *
 *   display-*   Newsreader, a bookish serif. Anything that is CONTENT — screen
 *               titles, candidate names, salary, scores, interview feedback.
 *   ui-*        Instrument Sans. Anything that is INTERFACE — every control,
 *               label, row, paragraph and button.
 *   meta-*      IBM Plex Mono. Eyebrows, status pills, timers, transaction
 *               references, requirement IDs, fine print. Always uppercase.
 *
 * Writing `text-ui-lg` on a candidate's name is not a style slip, it is a
 * category error — the name is content and belongs in the serif. That is why
 * the family is in the token name rather than left to a separate font utility.
 *
 * ── Two floors ──────────────────────────────────────────────────────────────
 * Nothing sans-serif sets below 11px, and no interactive label sets below 13px.
 * `ui-2xs` and `ui-sm` are those floors; there is deliberately nothing beneath
 * them. The mono steps go to 9px because uppercase mono at a wide tracking
 * stays legible where a lowercase sans would not.
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
   * Crimson. The single loud colour in the system, and it is a verb rather than
   * a decoration. Four jobs only: the one primary action on a screen, the
   * active nav item, the Verified Interview mark, and live/recording. Never a
   * background, never a section header. Budget: about 5% of a screen's pixels.
   */
  accent: '#B01E24',
  accentHover: '#8F181D',
  accentSoft: '#FBECEC',
  /** The dotted leader that runs out to a price, and the paywall banner's rule. */
  accentMuted: '#D9A9AB',

  /**
   * The logo mark and the darkest ink. Near-black with a blue cast.
   *
   * Rationed deliberately: the ground is paper everywhere, including the
   * interview room, so ink appears only as the mark, dark-fill secondary
   * buttons, and the letterbox behind footage. The footage itself is then the
   * only dark area on any screen, which makes it the focal point without a
   * single decorative pixel.
   */
  ink: '#0F1A22',
  /** A panel lifted off the ink ground — the well a video thumbnail sits in. */
  inkRaised: '#1E2429',

  // text on the ink ground. White at a fraction, so the ground shows through
  // and the hierarchy survives on a dark surface.
  textOnInk: '#FFFFFF',
  textOnInkMuted: 'rgba(255, 255, 255, 0.72)',
  textOnInkSubtle: 'rgba(255, 255, 255, 0.55)',
  /** The wash behind a sheet, and the gradient foot under a video caption. */
  scrim: 'rgba(15, 26, 34, 0.4)',
  scrimStrong: 'rgba(15, 26, 34, 0.82)',

  // semantic state — deliberately low in chroma, so red keeps its monopoly on
  // urgency and "brand" never collapses into "this worked"
  success: '#0C7355',
  successSoft: '#E4F1EC',
  warning: '#8E540A',
  warningSoft: '#F9EFDD',
  danger: '#A93122',
  dangerSoft: '#FAE9E6',
  /**
   * The hairline on a destructive control. Danger drained the way accentMuted
   * drains the accent — a withdraw button has to read as danger without
   * shouting, because red is the brand and danger is its own colour.
   */
  dangerBorder: '#E4CDC9',
  info: '#0E6E8C',
  infoSoft: '#E3EFF4',
} as const

/**
 * A 4px grid. The mobile screen gutter is `xl` (20); card padding is `lg` (16).
 *
 * `2xs` is the one sub-grid step, and it exists for optical nudges only — the
 * 1.5px caret offset, the 2px lift on a notch. Anything structural is on grid.
 */
export const space = {
  '2xs': 2,
  /** Hairline gaps — between a rule and the text it separates. */
  xs: 4,
  /** Glyph to label. */
  sm: 8,
  /** Inside a chip, and between a pill and its neighbour. */
  md: 12,
  /** Card padding. */
  lg: 16,
  /** The screen gutter. */
  xl: 20,
  /** Between blocks within a screen. */
  '2xl': 28,
  /** A section break. */
  '3xl': 40,
  /** Page top and bottom on a wide surface. */
  '4xl': 56,
} as const

/**
 * Radius carries meaning here: the bigger the radius, the more the surface is
 * "lifted off" the page. A tag is almost square, a sheet is nearly a pill.
 */
export const radius = {
  /** Tags and skeleton bars. */
  sm: 4,
  /** Fields, OTP cells, inline wells. */
  md: 10,
  /** Cards, and every framed video. */
  lg: 14,
  /** Bottom sheets — top corners only. */
  xl: 22,
  /** Every button, chip, pill and toggle. */
  pill: 999,
} as const

/**
 * Font size, named by family and role. See the header note — the prefix binds
 * the size to a face, and that binding is the system.
 *
 * Every step carries a paired line height in `fontSizeLeading` below, so
 * `text-ui-base` sets a size AND a leading and body copy never has to be told
 * how to breathe twice.
 */
export const fontSize = {
  // ── display · Newsreader · content ──────────────────────────────────────
  /** State titles — "No saved jobs yet". The smallest the serif is allowed. */
  'display-xs': 18,
  /** Sheet titles, a percentage read as a value. */
  'display-sm': 22,
  /** Candidate names, card headings. */
  'display-md': 26,
  /** Screen titles, and the moments — "Your video resume is live". */
  'display-lg': 36,
  /** Marketing section heads. */
  'display-xl': 48,
  /** The marketing hero, where it does not scale fluidly. */
  'display-2xl': 64,
  /** Salary, scores, totals. Set tabular — see `.tnum`. */
  'display-num': 40,

  // ── ui · Instrument Sans · interface ────────────────────────────────────
  /** The sans floor. Non-interactive supporting copy only. */
  'ui-2xs': 11,
  /** Fine supporting copy, helper lines beneath a field. */
  'ui-xs': 12,
  /** Card meta, field labels, chips. The floor for anything interactive. */
  'ui-sm': 13,
  /** Inline and secondary buttons. */
  'ui-md': 14,
  /** Body copy, sheets, and the primary button. */
  'ui-base': 15,
  /** List titles, the app bar. */
  'ui-lg': 17,
  /** Large interface type, where a heading is chrome rather than content. */
  'ui-xl': 21,

  // ── meta · IBM Plex Mono · always uppercase ─────────────────────────────
  /** Dense badges sitting on footage. */
  'meta-xs': 9,
  /** Eyebrows and status pills. The canonical meta step. */
  'meta-sm': 10,
  /** Transaction references, durations, fine print. */
  'meta-md': 11,
} as const

/**
 * The line height each step carries, as a unitless ratio.
 *
 * Display type sits just above 1 — a serif at 36px needs pulling together, not
 * opening up. Body copy runs from 1.35 to 1.55. Mono sits at 1.5 because
 * uppercase with wide tracking reads as a band rather than a line.
 */
export const fontSizeLeading = {
  'display-xs': 1.25,
  'display-sm': 1.2,
  'display-md': 1.15,
  'display-lg': 1.08,
  'display-xl': 1.06,
  'display-2xl': 1.04,
  'display-num': 1,

  'ui-2xs': 1.45,
  'ui-xs': 1.5,
  'ui-sm': 1.45,
  'ui-md': 1.4,
  'ui-base': 1.55,
  'ui-lg': 1.35,
  'ui-xl': 1.3,

  'meta-xs': 1.5,
  'meta-sm': 1.5,
  'meta-md': 1.4,
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

/**
 * Weights. Newsreader carries 300 for the large display steps — a serif set at
 * 36px looks heavy at 400 — and 400 everywhere else.
 */
export const fontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

/**
 * Letter spacing for the web, in em so it tracks the font size.
 *
 * Display steps pull together as they grow; the mono steps push apart, because
 * small uppercase needs the air to stay readable. The spec's working range for
 * mono is 0.08–0.16em, and `widest` sits beyond it for the one place a wordmark
 * is set as a rule.
 */
export const tracking = {
  /** The largest display type. */
  'tight-lg': '-0.03em',
  tight: '-0.025em',
  /** Section heads and screen titles. */
  'tight-sm': '-0.02em',
  /** Names, sheet titles. */
  snug: '-0.015em',
  /** List titles set in the sans. */
  'snug-sm': '-0.01em',
  normal: '0em',
  /** Status pills and inline mono. */
  meta: '0.1em',
  /** Captions over footage. */
  'meta-wide': '0.12em',
  /** Eyebrow labels. */
  eyebrow: '0.14em',
  /** The widest eyebrow — section numbers, the document rule. */
  'eyebrow-wide': '0.16em',
  widest: '0.18em',
} as const

/**
 * Line height for the web where it is set apart from a size token — a heading
 * that has to match a neighbour, a paragraph given extra air deliberately.
 */
export const leading = {
  none: 1,
  display: 1.08,
  tight: 1.25,
  snug: 1.4,
  normal: 1.5,
  relaxed: 1.55,
  loose: 1.65,
} as const

/**
 * Three faces, three jobs — see the header note.
 *
 * The *-loaded variables are set by next/font, which self-hosts the files. The
 * stacks after them are what renders if that has not resolved yet, chosen so
 * the fallback has roughly the right colour on the page.
 */
export const fontFamily = {
  display: "var(--font-display-loaded), 'Iowan Old Style', Georgia, serif",
  body: "var(--font-body-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "var(--font-mono-loaded), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

/**
 * React Native cannot parse a CSS font stack; it needs one exact face name.
 *
 * These are the fonts' own PostScript names, not friendly labels, and they have
 * to stay exact: iOS resolves a face by PostScript name while Android resolves
 * it by filename, so the bundled files in src/assets/fonts are named to match
 * these strings character for character. Renaming a file there without changing
 * the string here breaks Android only, which is the kind of bug that reaches a
 * store build.
 *
 * `Newsreader16pt` is the optical size cut for text and small display, which is
 * the range a phone actually sets: the 36px screen title is the largest thing
 * in the app, well inside what the 16pt cut is drawn for.
 *
 * RN has no synthetic weight for a custom face — asking for fontWeight 600 on a
 * Regular file silently gives you Regular on Android — so every weight the
 * design uses is bundled as its own file and named here.
 */
export const fontFamilyNative = {
  /** Newsreader 300 — the large display steps only. */
  displayLight: 'Newsreader16pt-Light',
  display: 'Newsreader16pt-Regular',
  displayMedium: 'Newsreader16pt-Medium',
  displayItalic: 'Newsreader16pt-Italic',

  body: 'InstrumentSans-Regular',
  bodyMedium: 'InstrumentSans-Medium',
  bodySemiBold: 'InstrumentSans-SemiBold',
  bodyBold: 'InstrumentSans-Bold',

  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoSemiBold: 'IBMPlexMono-SemiBold',

  /** The platform's own serif, where the bundled display face is not used. */
  displayFallback: 'serif',
} as const

/**
 * The wordmark's face on mobile.
 *
 * This used to fall back to the platform serif on each platform, because the
 * display face was not bundled and shipping four weights for one word was not
 * worth it. Newsreader is bundled now, so the wordmark sets in the same serif
 * as the rest of the product on both platforms — which is the point of a
 * wordmark. Kept in `Platform.select` shape so call sites do not have to change.
 */
export const fontFamilyNativeWordmark = {
  ios: 'Newsreader16pt-Regular',
  android: 'Newsreader16pt-Regular',
  default: 'serif',
} as const

/**
 * React Native has no em and no unitless line height — both are absolute
 * numbers — so the two web scales above cannot be handed to it directly.
 * These are the same design decisions expressed in points, keyed to match the
 * font size steps they pair with.
 */
export const trackingNative = {
  'tight-lg': -1.1,
  tight: -0.9,
  'tight-sm': -0.7,
  snug: -0.4,
  'snug-sm': -0.2,
  normal: 0,
  meta: 1,
  'meta-wide': 1.2,
  eyebrow: 1.4,
  'eyebrow-wide': 1.6,
  widest: 1.8,
} as const

/**
 * Absolute line heights for React Native, one per font size step. These are
 * `fontSize × fontSizeLeading` resolved ahead of time and rounded to the pixel,
 * because RN will not do the multiplication for us.
 */
export const leadingNative = {
  'display-xs': 23,
  'display-sm': 26,
  'display-md': 30,
  'display-lg': 39,
  'display-xl': 51,
  'display-2xl': 67,
  'display-num': 40,

  'ui-2xs': 16,
  'ui-xs': 18,
  'ui-sm': 19,
  'ui-md': 20,
  'ui-base': 23,
  'ui-lg': 23,
  'ui-xl': 27,

  'meta-xs': 14,
  'meta-sm': 15,
  'meta-md': 15,
} as const

/**
 * Opacity. `pressed` is the dip a button takes under a finger, `disabled` the
 * state of an action that is not available yet — and a disabled action always
 * carries a reason line beneath it, never a dead control with no explanation.
 */
export const opacity = { pressed: 0.85, disabled: 0.5, hidden: 0 } as const

/**
 * Border weights. `thin` is every hairline in the product — a 1px rule at any
 * density. `accent` is the thicker bar that marks a pull quote, a framing
 * guide, or the ring on an error glyph.
 */
export const borderWidth = { thin: 1, medium: 1.5, accent: 2 } as const

/**
 * Three levels of elevation in the whole system, and the rule is flat by
 * default: a hairline does the work almost everywhere.
 *
 * `card` lifts a surface off the page — swipe cards, sheets, toasts. `raised`
 * is the small lift under a segmented control's selected pane. `focus` is the
 * ring a field wears while it has the caret: 3px of ink at 6%, never blue.
 */
export const shadow = {
  card: '0 1px 2px rgba(15, 26, 34, 0.04), 0 12px 32px -12px rgba(15, 26, 34, 0.12)',
  raised: '0 1px 2px rgba(15, 26, 34, 0.08)',
  focus: '0 0 0 3px rgba(22, 25, 28, 0.06)',
  /**
   * The only coloured shadow in the system, and it exists for exactly one
   * control: the save action on the job feed. That button is the whole gesture
   * the feed is built around, so it is allowed to lift off the card in a way
   * nothing else does.
   */
  accent: '0 8px 20px -8px rgba(176, 30, 36, 0.6)',
} as const

/**
 * The SAVE and PASS stamps that fade in over a swipe card, angled the way a
 * rubber stamp lands. Two values, mirrored, and nothing else in the product
 * rotates — which is what keeps them reading as a stamp rather than a style.
 *
 * Web has no --rotate-* theme namespace, so globals.css turns these into
 * `@utility rotate-<name>` the same way it handles the fixed heights.
 */
export const rotation = {
  stamp: '-11deg',
  'stamp-alt': '11deg',
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
 * The floor is `tap` (44): every tap target is at least 44×44, including the
 * icon-only controls in the interview room.
 *
 * Web has no `--height-*` theme namespace, so globals.css turns each of these
 * into an `@utility h-<name>` that behaves like any other Tailwind utility
 * (`sm:h-header-lg` works).
 */
export const height = {
  /** Primary actions, and every field. */
  control: 52,
  /** Inline and secondary buttons. Also the tap-target floor. */
  'control-sm': 44,
  /** The small button inside an empty or error state. */
  'control-xs': 40,
  /** The action inside a next-action block, and a sheet's paired buttons. */
  'control-block': 48,
  /** Filter and skill chips. */
  chip: 36,
  /** One pane of a segmented control, inside its 3px track padding. */
  segment: 34,
  /** A switch, and the knob inside it. */
  toggle: 28,
  'toggle-knob': 22,
  /** The smallest square a finger reliably hits. */
  tap: 44,
  /** A glyph slot in the tab bar — placeholder until the icon set arrives. */
  glyph: 24,
  /** The pill behind an active Android tab. */
  'tab-indicator': 30,

  header: 60,
  'header-lg': 72,
  'otp-cell': 52,
  'otp-cell-lg': 76,
  /** The pay bar itself, and the spacer that keeps it off the content. */
  'pay-bar': 88,
  'pay-bar-stacked': 136,
  'video-thumb': 116,
  /** The empty well on the unfinished-profile card. */
  well: 400,
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
 * Motion. Three animations in the product, and none of them is decorative:
 * `sweep` runs across a progress bar and a skeleton while something is genuinely
 * in flight, `pulse-dot` marks a live recording, `spin` is the one spinner.
 *
 * The keyframes themselves are in the generated globals.css.
 */
export const animation = {
  sweep: 'sweep 1.7s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
  'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
  spin: 'spin 0.8s linear infinite',
  'spin-slow': 'spin 1.1s linear infinite',
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
export type FontSizeToken = keyof typeof fontSize
