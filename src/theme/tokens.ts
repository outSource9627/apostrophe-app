/**
 * THE canonical design tokens for the Apostrophe web app.
 *
 * Nothing in a component may contain a raw colour, radius, size or spacing
 * value. Everything comes from here — so re-branding is a change to this file
 * and nothing else. To change the brand colour, change `accent`, `accentHover`,
 * `accentText`, `accentSoft`, `accentWash`, `accentMuted` and `accentBright`;
 * to change the typeface, change `fontFamily` and the two next/font loads in
 * app/layout.tsx.
 *
 * Web consumes these as CSS custom properties (app/globals.css is generated
 * from this table by `npm run theme:generate`).
 *
 * Mobile parity: `fontFamilyNative` names the bundled Geist static files.
 * `trackingNative` and `leadingNative` still carry the previous scale until
 * each native screen is redesigned, so a step a screen needs is added there.
 *
 * ── Two families, one job each ─────────────────────────────────────────────
 * The foundation rests on a single typographic idea: type carries the design,
 * so colour does not have to. Every size token therefore names the family it
 * belongs to, and the binding is not negotiable at the call site.
 *
 *   display-*   Geist, at its heavier weights. Anything that is CONTENT —
 *               screen titles, names, prices, scores, interview feedback.
 *   ui-*        Geist, at its lighter weights. Anything that is INTERFACE —
 *               every control, label, row, paragraph and button.
 *   meta-*      Geist Mono. Eyebrows, status pills, timers, references, fine
 *               print. Always uppercase.
 *
 * display-* and ui-* share one typeface — weight and size carry the hierarchy —
 * but the token names still mark the same category. Writing `text-ui-lg` on a
 * person's name is still a category error: the name is content, and a future
 * redesign that gives `display-*` its own face again should not have to hunt
 * down every place that quietly assumed otherwise.
 *
 * ── Two floors ──────────────────────────────────────────────────────────────
 * Nothing sans-serif sets below 11px, and no interactive label sets below 13px.
 * `ui-2xs` and `ui-sm` are those floors; there is deliberately nothing beneath
 * them. The mono steps go to 9px because uppercase mono at a wide tracking
 * stays legible where a lowercase sans would not.
 */
export const color = {
  // grounds — a cool paper ground with white surfaces lifted off it
  background: '#FAFAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F7',
  surfaceSunken: '#E6E8EE',

  // text
  text: '#0B0F1A',
  /** Labels, secondary copy — one step darker than `textMuted`. */
  textSecondary: '#3A4256',
  textMuted: '#6B7385',
  textSubtle: '#8A91A2',
  /** A struck-through, unavailable value — a taken time slot. */
  textDisabled: '#B4BAC7',
  textInverse: '#FFFFFF',

  // structure — cool slate hairlines
  border: '#E3E6ED',
  borderStrong: '#C9CED9',
  /** The row rule inside a card — lighter than a card's own edge. */
  borderSoft: '#F1F3F7',

  /**
   * Violet. The brand colour and the primary verb: the one primary action on a
   * screen, the active nav item, a selected tile or chip, a link, the focus
   * ring, progress. To re-brand the product, change these five values.
   */
  accent: '#5B3DF5',
  accentHover: '#4A2FE0',
  /** Text set on `accentSoft` — the same step as the hover. */
  accentText: '#4A2FE0',
  accentSoft: '#EFEBFF',
  /** A selected row's wash, one step lighter than `accentSoft`. */
  accentWash: '#F7F6FF',
  /** A light violet: on-ink accent text, a spacing swatch, the leader rule. */
  accentMuted: '#C4B8FF',
  /** Hover and processing on a violet fill, and the progress fill on ink. */
  accentBright: '#7258FF',
  /** The deep end of a violet gradient — an avatar or tile on ink. */
  accentDeep: '#3B2A8F',

  /**
   * The ink ground and the darkest text. Ink appears as the mark, dark-fill
   * buttons, the letterbox behind footage and the featured card on a page.
   */
  ink: '#0B0F1A',
  /** A panel lifted off the ink ground. */
  inkRaised: '#151B2B',
  /** An ink control on hover, and the light end of a footage gradient. */
  inkHover: '#2A3142',
  /** The live room's ground — darker than ink so footage owns the frame. */
  inkDeep: '#07090F',
  /** The dark end of a footage gradient inside the room. */
  inkDeeper: '#11151F',

  // text on the ink ground
  textOnInk: '#FFFFFF',
  /** A paragraph set on an ink card — a step softer than white, a step above `textOnInkMuted`. */
  textOnInkSoft: '#E3E6ED',
  textOnInkMuted: '#C9CED9',
  textOnInkSubtle: '#8A91A2',
  /** The wash behind a sheet, and the gradient foot under a video caption. */
  scrim: 'rgba(11, 15, 26, 0.4)',
  scrimStrong: 'rgba(11, 15, 26, 0.82)',
  /** The backdrop behind a modal over the live room. */
  scrimModal: 'rgba(7, 9, 15, 0.7)',

  /**
   * ── the on-ink surface set ────────────────────────────────────────────
   * Over footage there is no ground and no hairline, so everything drawn on top
   * of footage is white at a fraction and the picture reads through it. These
   * are grounds, edges and lines — not text colours.
   */
  /** The fill behind an over-footage control — mute, camera, audio, leave. */
  onInkGround: 'rgba(255, 255, 255, 0.12)',
  /** Its hairline, and the border on the interviewer's tile. */
  onInkEdge: 'rgba(255, 255, 255, 0.2)',
  /** The 9:16 framing guide — its rect, its head-room rules, its centre line. */
  guideLine: 'rgba(255, 255, 255, 0.26)',
  /** A quiet bar in the audio-level meter. */
  onInkLevel: 'rgba(255, 255, 255, 0.34)',
  /** The framing guide's oval and corner ticks — the marks a person looks for. */
  guideEdge: 'rgba(110, 231, 183, 0.6)',

  /** The four marks that sit ON a still — nearly opaque where the room's are not. */
  onInkDisc: 'rgba(255, 255, 255, 0.94)',
  onInkDiscPlaying: 'rgba(11, 15, 26, 0.55)',
  onInkBadge: 'rgba(255, 255, 255, 0.92)',
  onInkTrack: 'rgba(255, 255, 255, 0.28)',
  /** A glass chip over footage — a blurred ink wash carrying a label. */
  onInkGlass: 'rgba(11, 15, 26, 0.6)',
  /** The hairline round a poster card on the ink ground — fainter than `onInkGround`. */
  onInkHairline: 'rgba(255, 255, 255, 0.1)',
  /** An accent pill on the ink ground ("UPCOMING") — `accentBright` at 25%; its text is `accentMuted`. */
  accentOnInkSoft: 'rgba(114, 88, 255, 0.25)',
  /** The unfilled track of a progress bar on the ink ground. */
  onInkBar: 'rgba(255, 255, 255, 0.12)',

  /**
   * ── semantic state ────────────────────────────────────────────────────
   * Each state has a TEXT colour (`success`), a SOFT ground (`successSoft`), a
   * FILL for dots, bars and icons (`successFill`) and, where a state is drawn
   * over ink, an `…OnInk` step that stays legible on a dark ground.
   */
  success: '#0B7A55',
  successSoft: '#E6F7F0',
  successFill: '#0E9F6E',
  /** The ring round a live status dot — `successFill` at 18%. */
  successHalo: 'rgba(14, 159, 110, 0.18)',
  /** The ring round an idle status dot — `textSubtle` at 15%. */
  neutralHalo: 'rgba(138, 145, 162, 0.15)',
  successOnInk: '#6EE7B7',
  successOnInkSoft: 'rgba(14, 159, 110, 0.2)',
  warning: '#935F00',
  warningSoft: '#FFF5E1',
  warningFill: '#F5A524',
  /** A mid-amber score — legible on white, warmer than `warning`. */
  warningStrong: '#B87700',
  /** The darkest amber — body text set on `warningSoft`. */
  warningInk: '#5C4200',
  warningOnInk: '#FCC96B',
  danger: '#C22A30',
  dangerSoft: '#FDECEC',
  dangerFill: '#E5484D',
  dangerFillHover: '#D13A3F',
  /** The hairline on a destructive control. */
  dangerBorder: '#F2B8BA',
  dangerOnInk: '#FF8A8E',
  dangerOnInkSoft: 'rgba(229, 72, 77, 0.16)',
  info: '#4A2FE0',
  infoSoft: '#EFEBFF',
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
 * The half steps between the grid's whole ones, named by their Tailwind
 * multiple (so `gap-2.5` on web and `spaceHalf['2.5']` on native are the same
 * 10). The Android design sets card gaps and pill padding on these; they are
 * not a licence for off-grid structure — a block's outer rhythm stays on `space`.
 */
export const spaceHalf = {
  '1.5': 6,
  '2.5': 10,
  '3.5': 14,
  '4.5': 18,
  /** The auth screens' gutter (Android M1, M10): 24. */
  '6': 24,
} as const

/**
 * Radius carries meaning here: the bigger the radius, the more the surface is
 * "lifted off" the page. A chip is nearly square, a card is soft, a button is a
 * pill.
 */
export const radius = {
  /** Progress bars and meter cells. */
  bar: 3,
  /** The corner of a chat bubble that points back at whoever wrote it (G6): 16 everywhere else, 4 here. */
  tail: 4,
  /** Tags and chips. */
  sm: 6,
  /** The logo mark, a nav item, an icon tile. */
  ctl: 8,
  /** Fields and time-slot chips. */
  md: 10,
  /** An OTP cell, an inner card, a banner. */
  tile: 12,
  /** A selectable tile — a domain card, a day card. */
  panel: 14,
  /** Cards, and every framed video. */
  lg: 16,
  /** The profile view's cards (G7): two pixels past `lg`, the one place the design draws 18. */
  'card-lg': 18,
  /** Modals and floating tiles. */
  xl: 20,
  /** The lobby's camera frame. */
  frame: 24,
  /** Every button, badge, pill and toggle. */
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
  /** A card's title. */
  'display-card': 20,
  /** The day number in a date tile — "26" over its month, in the interviews list. */
  'display-tile': 19,
  /** A section heading, one step under the page title. */
  'display-heading': 24,
  /** A feature card's headline date. */
  'display-lead': 28,
  /** A form or lobby title. */
  'display-form': 30,
  /** A working page's title. */
  'display-page': 32,
  /** The dashboard greeting, and a price. */
  'display-greet': 34,
  /** A confirmation's headline date. */
  'display-stat': 44,
  /** The auth panel's headline — "Be seen, not skimmed." */
  'display-auth': 40,
  /** The sign-up headline — "Five things, and we're off." Between the greeting and the marketing step. */
  'display-signup': 52,
  /** A single figure set large — the reply multiple. */
  'display-figure': 72,
  /** The Android scorecard's overall figure (M9): 56 at 600. */
  'display-score-sm': 56,
  /** The score. The largest number in the product. */
  'display-score': 96,
  /**
   * The one long-form serif step: the interviewer's written feedback in the
   * room (ST-33-delivered). It is 18px like `display-xs`, and aliasing the two
   * is wrong — `display-xs` is a state headline at 1.25/-0.01em, pulled
   * together the way a title is, while this is a paragraph somebody reads at
   * 1.55/-0.005em. The boards name it `.prose` rather than `.d-prose` for the
   * same reason: it is named for the job it does. `Display level="prose"`
   * sets the serif alongside it, so the family binding still holds.
   */
  prose: 18,

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
  /** A person's name in a row, and the auth call to action. */
  'ui-lead': 16,
  /** List titles, the app bar. */
  'ui-lg': 17,
  /** Large interface type, where a heading is chrome rather than content. */
  'ui-xl': 20,

  // ── meta · IBM Plex Mono · always uppercase ─────────────────────────────
  /** Dense badges sitting on footage. */
  'meta-xs': 9,
  /** Status pills. The canonical badge step. */
  'meta-sm': 10,
  /** Transaction references, durations, fine print. */
  'meta-md': 11,
  /** Eyebrows, and the credit chip. The canonical label step. */
  'meta-base': 12,
  /**
   * 13 — the mono step that is a MARK rather than a line of fine print: the
   * employer monogram inside a 44px Avatar (chat ST-43, ST-43Web, ST-41, ST-42
   * and booking all draw it at 13/500/0.06em), and the 13px uppercase tabular
   * mono the booking flow sets a date rail in. It is deliberately not `ui-sm`,
   * which is also 13: that one is Instrument Sans and carries interface, and a
   * monogram set in the sans stops reading as a stand-in for a logo and starts
   * reading as two letters of a word.
   */
  'meta-lg': 13,
  /**
   * ── the three clock steps ────────────────────────────────────────────
   * A countdown is the one thing in the product set in mono at a size the
   * mono steps above were never meant to reach. It is mono because it is a
   * readout the person has to act against rather than a fact they are
   * reading — the room says outright that a serif countdown "would out-shout
   * REC and read as a failure clock" — and it is tabular because a digit that
   * changes width every second is a clock that jitters under the thumb.
   *
   * 15 is the countdown inside a sunken well (booking ST-26, 'Starts in' /
   * '01 : 23 : 46'). It is deliberately not `ui-base`, which is also 15: that
   * one is Instrument Sans and carries a sentence.
   */
  'meta-xl': 15,
  /**
   * 20 — `Countdown`'s `ring` format, the one readout centred inside an
   * arc instead of sitting in a well or a band. It has to clear `meta-xl`
   * by enough to read as the ring's subject rather than another line of
   * fine print, and it stays one size across every ring diameter the
   * component draws: the ring itself carries the size difference, so the
   * label does not have to.
   */
  'meta-2xl': 20,
  /**
   * 56 — the join clock, and the largest element in the booking flow. It is
   * the only meta step above the fine-print range, which is the point: at the
   * moment the window opens, the time left IS the screen.
   */
  'meta-hero': 56,
  /**
   * 30 — a percentage read as a MONO figure. The profile's completion is the one
   * place the design sets a number in Geist Mono rather than the display face.
   */
  'meta-figure': 30,
  /** One digit of a one-time code in its cell (Android M1): 24 mono at 600. */
  'meta-otp': 24,
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
  'display-2xl': 1.02,
  'display-num': 1,
  'display-card': 1.25,
  /** The design sets the day number at line-height 1, so the tile's two lines centre as one block. */
  'display-tile': 1,
  'display-heading': 1.2,
  'display-lead': 1.15,
  'display-form': 1.15,
  'display-page': 1.15,
  'display-greet': 1.15,
  'display-stat': 1.05,
  'display-auth': 1.05,
  'display-signup': 1.02,
  'display-figure': 1,
  'display-score': 0.9,
  prose: 1.55,

  'ui-2xs': 1.45,
  'ui-xs': 1.5,
  'ui-sm': 1.45,
  'ui-md': 1.4,
  'ui-base': 1.55,
  'ui-lead': 1.4,
  'ui-lg': 1.35,
  'ui-xl': 1.3,

  'meta-xs': 1.5,
  'meta-sm': 1.5,
  'meta-md': 1.4,
  'meta-base': 1.4,
  /** Tighter than the steps below it: at 13 the mono is a mark, not a line. */
  'meta-lg': 1.2,
  'meta-xl': 1.4,
  /** Same reasoning as `meta-hero`: a ring's centre label owns its own box. */
  'meta-2xl': 1,
  /** A clock is one line and owns its own box. Nothing sets beneath it. */
  'meta-hero': 1,
  /** The design sets no line height on it: the font's own line box, `leading.natural`. */
  'meta-figure': 1.3,
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
 * Weights. Geist is a variable font, so the in-between weights (450, 550) are
 * real cuts rather than a synthetic bold.
 */
export const fontWeight = {
  light: '300',
  regular: '400',
  /** A nav item at rest. */
  nav: '450',
  medium: '500',
  /** Labels and names — one step under semibold. */
  emphasis: '550',
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
  /** A figure set very large — the reply multiple, the score. */
  'tight-2xl': '-0.05em',
  /** The display step. */
  'tight-xl': '-0.035em',
  /** Large display type. */
  'tight-lg': '-0.03em',
  tight: '-0.025em',
  /** Section heads and screen titles. */
  'tight-sm': '-0.02em',
  /** Names, sheet titles. */
  snug: '-0.015em',
  /** List titles set in the sans. */
  'snug-sm': '-0.01em',
  /** The one serif reading step — `prose`. A paragraph tracks looser than a
      title, because the eye is travelling along the line rather than taking
      the whole phrase in at once. */
  'snug-xs': '-0.005em',
  normal: '0em',
  /**
   * The one mixed-case mono step in the product: an email address read back to
   * the person who typed it (signup ST-05). Lowercase mono already has the
   * air uppercase mono has to be given, so `meta` at 0.1em would space an
   * address out into a ransom note. `Meta uppercase={false}` reaches for this.
   */
  'meta-tight': '0.02em',
  /**
   * The monogram step. A two-letter mono mark inside an Avatar needs the
   * letters held apart so they read as an abbreviation rather than a syllable,
   * but not the 0.1em a status pill takes — at 0.1em the pair drifts off the
   * optical centre of a 44px circle and has to be nudged back with a margin,
   * which is how a raw value gets written. Fifty-three instances across the
   * boards set 0.06em, and every one of them is a mark: the employer monogram
   * and booking's 13px uppercase date rail.
   */
  'meta-snug': '0.06em',
  /** Status pills and inline mono. */
  meta: '0.06em',
  /**
   * The two clock tracks, and they tighten as the clock grows for the same
   * reason the display steps do: tracking is air between letters, and a
   * 56px digit already has more of it than a 10px one. 0.08em at
   * `meta-xl`, 0.04em at `meta-hero` — both measured off the boards
   * (booking ST-26 and ST-26-join), not interpolated.
   *
   * They are the tracking on the DIGITS. The spaced colons a countdown sets
   * ('01 : 23 : 46') are not tracking at all — they are word spaces the
   * component inserts, because a mono colon sits tight against the digit
   * either side of it and a clock has to be read in groups.
   */
  'meta-clock': '0.02em',
  'meta-clock-lg': '0.04em',
  /** A route or section label in mono. */
  'meta-label': '0.04em',
  /** Captions over footage. */
  'meta-wide': '0.08em',
  /** Eyebrow labels. */
  eyebrow: '0.08em',
  /** The widest eyebrow — section numbers, the document rule. */
  'eyebrow-wide': '0.1em',
  widest: '0.12em',
} as const

/**
 * Line height for the web where it is set apart from a size token — a heading
 * that has to match a neighbour, a paragraph given extra air deliberately.
 */
export const leading = {
  none: 1,
  display: 1.08,
  tight: 1.25,
  /**
   * What the design gets by leaving line-height unset: the font's own line box,
   * which is 1.3 in both Geist and Geist Mono. Reach for it where a block's
   * height is measured off a board that never set one.
   */
  natural: 1.3,
  /**
   * The same thing, exactly: CSS `normal`. `natural` is the ratio that
   * approximates it, and no single ratio can do better — Geist's own line box
   * is round(0.99 × size) + round(0.29 × size), so 16 at 12px, 17 at 13px, 19
   * at 15px and 28 at 22px, which 1.3 lands 0.1–0.6px short of or past, and
   * that is enough to move a row of text a whole pixel. Reach for this one
   * where the rows have to land on the board's own pixels (the sign-up screen).
   */
  intrinsic: 'normal',
  snug: 1.4,
  /** The 15px lines the design sets on an ink card — a step looser than `snug`, a step tighter than `normal`. */
  copy: 1.45,
  normal: 1.5,
  relaxed: 1.55,
  loose: 1.65,
} as const

/**
 * Two faces, two jobs — see the header note.
 *
 * display and body both resolve to the same loaded Geist, so a component
 * switching between `fontFamily.display` and `.body` is choosing a weight/size
 * role, not a typeface. The *-loaded variables are set by
 * next/font, which self-hosts the files. The stacks after them are what
 * renders if that has not resolved yet, chosen so the fallback has roughly
 * the right colour on the page.
 */
export const fontFamily = {
  display: "var(--font-sans-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  body: "var(--font-sans-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
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
 * `display` and `body` are the same Geist — see `fontFamily`'s header note.
 * They stay as separate `display*`/`body*` keys: the names still mark CONTENT
 * vs INTERFACE, and a future redesign that gives `display-*` its own face
 * again should not have to touch every call site. Content is set at the
 * SemiBold weight (the design's 600 headings); interface at Regular/Medium.
 *
 * The static files are Google Fonts' own Geist / Geist Mono cuts (OFL). Geist
 * has no italic, so `displayItalic` is Regular.
 *
 * RN has no synthetic weight for a custom face — asking for fontWeight 600 on a
 * Regular file silently gives you Regular on Android — so every weight the
 * design uses is bundled as its own file and named here.
 */
export const fontFamilyNative = {
  displayLight: 'Geist-Light',
  display: 'Geist-SemiBold',
  displayMedium: 'Geist-Medium',
  displayItalic: 'Geist-Regular',

  body: 'Geist-Regular',
  bodyMedium: 'Geist-Medium',
  bodySemiBold: 'Geist-SemiBold',
  bodyBold: 'Geist-Bold',

  mono: 'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
  monoSemiBold: 'GeistMono-SemiBold',

  /** The platform's own sans, where the bundled face is not used. */
  displayFallback: 'sans-serif',
} as const

/**
 * The wordmark's face on mobile — the same Geist as the rest of the product,
 * kept in `Platform.select` shape so call sites do not have to change.
 */
export const fontFamilyNativeWordmark = {
  ios: 'Geist-SemiBold',
  android: 'Geist-SemiBold',
  default: 'sans-serif',
} as const

/**
 * React Native has no em and no unitless line height — both are absolute
 * numbers — so the two web scales above cannot be handed to it directly.
 * These are the same design decisions expressed in points, keyed to match the
 * font size steps they pair with.
 */
export const trackingNative = {
  'tight-lg': -1.1,
  /** -0.02em at the 28 step (`display-lead`) — the Android screen title. */
  'tight-md': -0.56,
  /** -0.05em at the 56 step — the Android scorecard figure. */
  'tight-2xl': -2.8,
  tight: -0.9,
  'tight-sm': -0.7,
  snug: -0.4,
  'snug-sm': -0.2,
  'snug-xs': -0.1,
  normal: 0,
  'meta-tight': 0.2,
  'meta-snug': 0.8,
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
  prose: 28,

  'ui-2xs': 16,
  'ui-xs': 18,
  'ui-sm': 19,
  'ui-md': 20,
  'ui-base': 23,
  'ui-lg': 23,
  'ui-xl': 27,
  'ui-lead': 24,
  'display-lead': 32,
  'display-score-sm': 50,
  'display-card': 25,
  'display-heading': 29,
  'display-greet': 39,
  'meta-otp': 28,
  'meta-xl': 22,

  'meta-xs': 14,
  'meta-sm': 15,
  'meta-md': 15,
  'meta-lg': 16,
  /** The native ring's centre value — see `fontSizeLeading['meta-2xl']`. */
  'meta-2xl': 20,
} as const

/**
 * Opacity. `pressed` is the dip a button takes under a finger, `disabled` the
 * state of an action that is not available yet — and a disabled action always
 * carries a reason line beneath it, never a dead control with no explanation.
 */
export const opacity = { pressed: 0.85, disabled: 0.5, hidden: 0 } as const

/**
 * Border weights. `thin` is every hairline in the product — a 1px rule at any
 * density. `medium` is the 1.5px ring an UNFILLED mark wears: a skills-floor
 * pip that has not been earned yet is a ring rather than a paler fill, because
 * a paler fill reads as a weak state where a ring reads as an empty one.
 * `accent` is the thicker bar that marks a pull quote, a framing guide, the
 * ring on an error glyph, and the spinner's track.
 *
 * These emit as `border-w-*` rather than `border-*`, because `border-<name>`
 * is already the border COLOUR namespace — `border-accent` is the crimson
 * hairline and `border-w-accent` is the 2px rule. They were declared here and
 * emitted nowhere for a while, which is its own defect: a component that needs
 * 1.5px and cannot reach a token writes 1.5px.
 */
export const borderWidth = { thin: 1, medium: 1.5, accent: 2 } as const

/**
 * How far a text action's rule sits below its baseline.
 *
 * Nine boards across five flows draw an underlined text action and every one
 * of them sets 3px, with the rule itself in `borderStrong` so the underline
 * reads as a hairline the word sits above rather than as part of the word. It
 * is a token because 3 is not on the 4px grid and there is nowhere else it
 * could come from — the moment it is written inline, the offset drifts per
 * screen and the decoration colour goes with it.
 *
 * Web only. React Native has no text-underline-offset; a pressable label there
 * takes `textDecorationLine` and the platform picks the offset.
 */
export const underlineOffset = { text: 3 } as const

/**
 * Elevation, and the rule is flat by default: a hairline does the work almost
 * everywhere.
 *
 * `card` lifts a surface off the page — swipe cards, sheets, toasts. `raised`
 * is the small lift under a resting card. `focus` is the ring a field wears
 * while it has the caret: 4px of violet at 14%, over a 1.5px violet border.
 * `accent` is the glow under a primary action.
 *
 * `lift` is the fourth, and it exists only for what sits OVER FOOTAGE — the
 * interview room's transient band. On paper a card is separated from the page
 * by a hairline and a change of ground, so `card` can stay almost invisible;
 * over a moving image there is neither, and a band carrying "One minute left"
 * has to read as a sheet of paper laid on top of the picture rather than a
 * tint composited into it. It is the room's own `--lift`, unchanged.
 */
export const shadow = {
  /** Lifts a floating surface — a sheet, a toast, an artboard. */
  card: '0 1px 2px rgba(11, 15, 26, 0.06), 0 12px 40px rgba(11, 15, 26, 0.1)',
  /** The hairline lift under a resting card or a selected segment. */
  raised: '0 1px 2px rgba(11, 15, 26, 0.04)',
  /** A card that stands off the page — the order summary. */
  panel: '0 12px 32px rgba(11, 15, 26, 0.06)',
  /** The 4px ring a field wears while it has the caret. */
  focus: '0 0 0 4px rgba(91, 61, 245, 0.14)',
  /** The ring around a selected tile, one shade softer than `focus`. */
  ring: '0 0 0 4px rgba(91, 61, 245, 0.12)',
  /** The glow under a primary action. */
  accent: '0 6px 16px rgba(91, 61, 245, 0.28)',
  /** What sits OVER FOOTAGE — the room's transient band. */
  lift: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
  /** The lobby's camera frame, floating on the muted ground beside the setup panel. */
  frame: '0 24px 60px rgba(11, 15, 26, 0.25)',
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
  /**
   * The desktop content column, and the one measure the whole web product
   * lines up on. Seven of the nine flows centre their 1440 boards on exactly
   * 1152 with a 32px gutter inside it — paywall, signup, profile, room,
   * account, job-feed and the wizard — so the app bar's inner row, the body
   * and the pay bar all share an edge. Chat's three-pane layout is full-bleed
   * instead, which is a different page type rather than a different measure.
   */
  column: 1184,
  /**
   * The column My interviews and My applications draw their cards in: 960 wide
   * on the 1280 board (160 either side), narrower than the 1120 shell column it
   * sits inside, so it is centred within that column.
   */
  'list-page': 960,
  /** The profile wizard's progress rail. */
  rail: 320,
  /**
   * The profile wizard's step pane at its widest: 816 of form between two 72px
   * gutters, which is exactly what the 1280 board draws beside the 320 rail.
   * A cap rather than a width, so a wider window centres the form instead of
   * stretching a two-column grid of inputs across it.
   */
  'wizard-pane': 960,
  /** The wider proof rail beside the landing headline. */
  'rail-wide': 340,
  /** The aside on a split page — the proof column beside a form. */
  aside: 430,
  /** The booking page's right rail: the match card over the selection card. */
  'rail-book': 360,
  /** The well an unstarted video sits in, on narrow screens. */
  'thumb-col': 122,
  /** A video thumbnail, 9:16 against `height['video-thumb']`. */
  'video-thumb': 68,
  /** The same thumbnail in the mobile list, against `height['video-thumb-compact']`. */
  'video-thumb-compact': 58,
  /** The lobby's camera frame at its widest: 360 across is the 640-tall 9:16 the design draws. */
  'lobby-frame': 360,
  /** The lobby's setup panel, beside the camera frame. */
  'lobby-panel': 460,
  /** The interviewer's tile in the live room, and the session bar under the frame's left edge. */
  'room-tile': 240,
  /** The chat's thread list beside the conversation (G6): 360 of list, and the transcript takes the rest. */
  'chat-list': 360,
  /** The widest a chat bubble runs: a long message wraps at 460 rather than crossing the pane. */
  'chat-bubble': 460,

  /** The measure a line of mobile body copy runs to. */
  'measure-native': 280,

  // floors rather than ceilings: the narrowest a control may get
  'col-min': 260,
  'label-min': 120,
  'input-min': 128,
  /**
   * The narrowest a NUMERIC chip may get. A row of score or year chips whose
   * widths follow their digit counts reads as a ragged list rather than as a
   * set of equal choices, and '1' beside '10' beside '100' is where that shows
   * first. It is a floor and not a width: a chip with a word in it still grows
   * past it.
   */
  'chip-min': 48,
  /**
   * The toggle track's width, paired with `height.toggle` at 30.
   */
  'toggle-track': 52,
  /** One cell of the OTP field, against `height['otp-cell']`. */
  'otp-cell': 56,
  /** The form column on a split auth screen — six OTP cells and their gaps fit it exactly. */
  'auth-form': 400,
  /** The paragraph beside the poster on the auth panel. */
  'auth-copy': 300,
  /** The decorative 9:16 poster card on the auth panel, against `height['film-card']`. */
  'film-card': 216,
  /** The sign-up stage at its widest — the two-column body with its 120px gutters. A wider window centres it. */
  'signup-frame': 1280,
  /** The dark "what you get" card beside the sign-up form. */
  'signup-aside': 400,
  /** The order-summary card's column beside the tier grid — pricing and pay. */
  summary: 380,
  /** The big-figure column inside the dark feature banner, beside its paragraph. */
  'figure-col': 180,
  /** The profile view's column: 900 between 190px gutters on the 1280 board. */
  'profile-column': 900,
  /** The film page's player: a 9:16 at 360 across is the 640-tall frame the lobby draws. */
  'film-player': 360,
  /** The film frame beside the name on the employer preview. */
  'film-hero': 280,
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
  control: 48,
  /** The one call to action on a form or a hero — continue, pay, join. */
  'control-lg': 52,
  /** A page-footer action pair. */
  'control-md': 46,
  /** A button inside a card. */
  'control-compact': 42,
  /** Inline and secondary buttons. Also the tap-target floor. */
  'control-sm': 44,
  /** The small button inside an empty or error state. */
  'control-xs': 40,
  /** The action inside a next-action block, and a sheet's paired buttons. */
  'control-block': 48,
  /** The full-width call to action that closes a phone screen. */
  'control-cta': 50,
  /** Filter and skill chips. */
  chip: 32,
  /** The filter row on a list page — My interviews' All / Upcoming / Completed chips. */
  'chip-lg': 38,
  /** A suggested skill — the wizard's '+ Python' — a step under the chip it becomes. */
  'chip-sm': 30,
  /** A time-slot chip. */
  slot: 40,
  /** One pane of a segmented control, inside its 3px track padding. */
  segment: 34,
  /**
   * A switch, and the knob inside it.
   *
   * 30 around the 24px knob, with `container['toggle-track']` at 52. The track
   * sits inside a 44px-tall tap cell, so the visible control is drawn at the
   * design's size while the hit target still meets the floor.
   */
  toggle: 30,
  'toggle-knob': 24,
  /** The smallest square a finger reliably hits. */
  tap: 44,
  /** A glyph slot in the tab bar — placeholder until the icon set arrives. */
  glyph: 24,
  /** The pill behind an active Android tab. */
  'tab-indicator': 30,
  /** The Android app's active-tab pill (Student App Android, M4): 60 × 32. */
  'tab-pill-w': 60,
  'tab-pill-h': 32,
  /** The Android app's brand tile in the top bar — the violet square carrying the mark. */
  'brand-mark': 30,
  /** A status dot and the halo ring round it (M4: 10 inside 20). */
  'status-dot': 10,
  'status-halo': 20,
  /** Chat (M15): a bubble's widest 300, an image bubble 196 × 108, the composer's tallest 120, a label column 92, the note field 72. */
  'bubble-max': 300,
  'bubble-image-w': 196,
  'bubble-image-h': 108,
  'composer-max': 120,
  'label-col': 92,
  'label-col-lg': 128,
  'note-field': 72,
  /** An unread count chip (22 wide) and a job post's video well (260). */
  'count-chip': 22,
  'job-video': 260,
  /** The job deck (M11): a company tile 44, the round actions 48 / 64, the video play disc 68. */
  'deck-logo': 44,
  'deck-action': 64,
  'deck-action-sm': 48,
  'deck-play': 68,
  /** The live room (M8): the self/interviewer tile is 116 wide, a round control 60, the Leave pill 76 × 60. */
  'room-tile-w': 116,
  'room-ctl': 60,
  'room-leave-w': 76,
  /** The date tile on an interview row (M13: 48 × 52). */
  'date-tile-w': 48,
  'date-tile-h': 52,
  /** A day card in the slot strip (M5: 72 wide). */
  'day-card': 72,
  /** A pricing tier row (M3: 64) and its radio (22). */
  'tier-row': 64,
  radio: 22,
  /** One cell of a ten-cell score bar (M9). */
  'score-cell': 8,
  /** One bar of the wizard's step indicator (M2). */
  'step-bar': 4,
  /** The Android drill-in header (56) and the title row of a bottom-bar screen (52). */
  'screen-header': 56,
  'tab-title': 52,
  /** The Android app's top-level top bar (M4: 60) — brand left, credit chip and avatar right. */
  'top-bar': 60,
  /** The Android top bar's avatar circle (M4: 36). */
  'avatar-lg': 36,
  /** The film still on the Android dashboard row: 40 wide at 9:16, with a 10 play mark. */
  'thumb-w': 40,
  'thumb-play': 10,
  /** The extended floating action button — "Book interview". */
  fab: 56,
  /** The bottom tab bar itself, above the safe-area inset it sits on top of. */
  'tab-bar': 64,
  /** The conversation's header: the counterparty's face and name, and the recording mark (G6). */
  'chat-head': 68,

  header: 64,
  'header-lg': 64,
  'otp-cell': 64,
  /** One cell of the Android one-time code (M1: 58). */
  'otp-cell-mobile': 58,
  'otp-cell-lg': 64,
  /** The decorative 9:16 poster card on the auth panel, against `container['film-card']`. */
  'film-card': 384,
  /** The pay bar itself, and the spacer that keeps it off the content. */
  'pay-bar': 88,
  /**
   * The same bar once the CTA drops below the amount — the phone layout. The
   * paywall measures it at 146.5 (SPEC 4.2): 16 top, then a baseline row of a
   * 26px serif amount beside a 13px detail line that WRAPS TO TWO LINES at
   * 390px and is meant to, then 12, then a 52px button, then 20. Every board
   * carrying the bar gives its content `padding-bottom: 148`, so the token is
   * the spacer's 148 rather than the bar's own fraction. It was 136, and at
   * 136 the bar covered the last line of content.
   */
  'pay-bar-stacked': 148,
  'video-thumb': 116,
  /** The empty well on the unfinished-profile card. */
  well: 400,
  /**
   * ── the three app-bar heights, and there are only three ─────────────────
   * `app-bar` (52) is a drill-in bar carrying a back chevron and nothing else.
   * `header` (60) is a root bar carrying the brand lockup — the wizard and the
   * profile frame included. `header-lg` (72) is either of them on a desktop
   * viewport. A fourth height measured off whatever padding a header happened
   * to have is how the 57px `app-header` got here, and it is why a bar drifted
   * a few pixels per surface; there is no measured height any more. A 50px
   * `app-bar-compact` sat here too, drawn by no board in any of the nine flows
   * and referenced by no component — the same defect one pixel smaller, so it
   * went with the 57.
   */
  'app-bar': 52,
  /** The avatar circle in the mobile top bar, inside a `tap`-sized target. */
  avatar: 32,
  /** The unfinished-profile well, on a phone. */
  'well-compact': 286,
  /** A video thumbnail in the mobile list, against `container['video-thumb-compact']`. */
  'video-thumb-compact': 84,
} as const

/**
 * Gradients, emitted as `bg-<name>` utilities. Built from `color` so a re-brand
 * of the accent carries through: the violet glow is the accent, not a copy of it.
 *
 * `glow-*` is the violet bloom laid on an ink card — the same idea at four
 * sizes and strengths, one per place the design draws it. `footage-*` is the
 * ground a video frame shows before there is footage. `avatar-*` is a person's
 * placeholder disc. `meter` fills a bar that measures the student against
 * something.
 */
const glow = (size: string, at: string, alpha: number, stop: number) =>
  `radial-gradient(${size} at ${at}, color-mix(in srgb, ${color.accent} ${alpha * 100}%, transparent), transparent ${stop}%)`

export const gradient = {
  /** The auth panel's bloom. */
  'glow-hero': glow('900px 500px', '20% 0%', 0.35, 60),
  /** A wide feature banner. */
  'glow-banner': glow('600px 240px', '90% 0%', 0.45, 70),
  /** A feature card on the dashboard. */
  'glow-card': glow('500px 260px', '100% 0%', 0.4, 70),
  /** The score card. */
  'glow-score': glow('400px 300px', '0% 0%', 0.45, 70),
  /** The sign-up screen's "what you get" card — the dashboard card's bloom, a touch narrower and stronger. */
  'glow-aside': glow('420px 260px', '100% 0%', 0.45, 70),
  /** A film poster before footage: a slate wash into ink. */
  'footage': `linear-gradient(180deg, ${color.inkHover}, ${color.inkRaised})`,
  /** The device-check lobby's camera frame. */
  'footage-lobby': `linear-gradient(180deg, ${color.textSecondary}, ${color.inkRaised})`,
  /** The live room's self view. */
  'footage-room': `linear-gradient(180deg, ${color.inkHover}, ${color.inkDeeper})`,
  /** The expert's placeholder tile in the live room. */
  'avatar-deep': `linear-gradient(160deg, ${color.accentDeep}, ${color.inkRaised})`,
  /** The expert's avatar disc. */
  'avatar-accent': `linear-gradient(135deg, ${color.accentMuted}, ${color.accent})`,
  /** The fill of a bar that compares the student to a median. */
  meter: `linear-gradient(90deg, ${color.accentBright}, ${color.accentMuted})`,
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
  /** The dashboard's visibility row: the state mark, the words, two counts, the switch. */
  visibility: 'auto 1fr auto auto',
  /** The dashboard's two cards: the dark upcoming card is a fifth wider than the film card beside it. */
  dashboard: '1.2fr 1fr',
  /** The scorecard: the overall figure's card, then the competencies. */
  scorecard: `${container['rail-wide']}px 1fr`,
  /** One competency row: its name, the ten-cell bar, the score. */
  competency: '260px 1fr 48px',
  /** The device-check lobby: the camera stage, then the setup panel. */
  lobby: `minmax(0, 1fr) ${container['lobby-panel']}px`,
  /** Slot booking: the day and time picker, then a rail for the match and the selection. */
  book: `minmax(0, 1fr) ${container['rail-book']}px`,
  /** A split auth screen on a tablet: a narrow brand rail, then the form. */
  'auth-rail': `${container.rail}px 1fr`,
  /** Sign-up: the form column, then the dark "what you get" card. */
  signup: `minmax(0, 1fr) ${container['signup-aside']}px`,
  /** Pricing and pay: the tier grid, then the sticky order-summary card. */
  checkout: `minmax(0, 1fr) ${container.summary}px`,
  /** The dark feature banner: a fixed figure column, then its paragraph. */
  'checkout-banner': `${container['figure-col']}px minmax(0, 1fr)`,
  /** Chat: the thread list, then the conversation. */
  chat: `${container['chat-list']}px minmax(0, 1fr)`,
} as const

/**
 * Motion. Three animations in the product, and none of them is decorative:
 * `sweep` runs across an INDETERMINATE progress bar while something is genuinely
 * in flight, `pulse-dot` marks a live recording, `spin` is the one spinner.
 *
 * A skeleton does not sweep, and used to. Both flows that draw a loading state
 * forbid shimmer and pulse outright — job-feed states the reason, that a
 * mid-range Android on a variable network does not need another compositing
 * layer — and draw the real component's geometry instead. A sweep on a
 * skeleton also says the wrong thing: it animates a shape that is not going to
 * move, where the indeterminate bar animates the only thing that is.
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
 * The brand lockup's own proportions.
 *
 * The lockup is a violet rounded-square badge carrying a bold ’ glyph, with the
 * wordmark beside it. The wordmark sets smaller than the badge — 17 against 28
 * in the app bar — and the glyph is drawn as text, so its size and its optical
 * drop are ratios of the badge rather than absolute numbers. They are tokens
 * because the badge appears at 28 in the bar and 30 on the auth panel, and the
 * two lockups have to match.
 */
export const brand = {
  /** Wordmark size as a fraction of the badge: 17 / 28. */
  wordmarkRatio: 0.6,
  /** The wordmark never sets smaller than this, whatever the badge size. */
  wordmarkMin: 14,
  /** The ’ glyph as a fraction of the badge: 26 / 28. */
  markGlyphRatio: 0.93,
  /** How far the glyph is nudged down inside the badge: 10 / 28. */
  markGlyphOffset: 0.36,
  /** The badge's size inside an app bar, mobile and desktop. */
  markInBar: 28,
  markInBarLg: 28,
} as const

/** Interview capture is locked to 9:16 (IR-02); every card that shows one mirrors it. */
export const aspect = { videoResume: 9 / 16, fullVideo: 16 / 9 } as const

export type ColorToken = keyof typeof color
export type FontSizeToken = keyof typeof fontSize
