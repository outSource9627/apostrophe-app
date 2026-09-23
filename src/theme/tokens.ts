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
 * ── Two families, one job each ─────────────────────────────────────────────
 * The foundation rests on a single typographic idea: type carries the design,
 * so colour does not have to. Every size token therefore names the family it
 * belongs to, and the binding is not negotiable at the call site.
 *
 *   display-*   Libre Franklin, at its heavier weights. Anything that is
 *               CONTENT — screen titles, candidate names, salary, scores,
 *               interview feedback.
 *   ui-*        Libre Franklin, at its lighter weights. Anything that is
 *               INTERFACE — every control, label, row, paragraph and button.
 *   meta-*      IBM Plex Mono. Eyebrows, status pills, timers, transaction
 *               references, requirement IDs, fine print. Always uppercase.
 *
 * display-* and ui-* share one typeface now — weight and size carry the
 * hierarchy a second family used to — but the token names still mark the same
 * category. Writing `text-ui-lg` on a candidate's name is still a category
 * error: the name is content, and a future redesign that gives `display-*`
 * its own face again should not have to hunt down every place that quietly
 * assumed otherwise.
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

  /**
   * ── the on-ink surface set ────────────────────────────────────────────
   * Over footage the system has no ground and no hairline. `surface` would
   * blow a hole in the frame and the warm greys vanish against a moving
   * image, so everything drawn on top of footage is white at a fraction and
   * the picture reads through it. Declared once here rather than invented per
   * component, which is what the interview room boards do (ST-30-A..D).
   *
   * They are deliberately NOT text colours — `textOnInk*` above are the three
   * type steps; these are grounds, edges and lines. Every one is a value a
   * board actually draws, and the entry cost is exactly that: a token nothing
   * draws is the same defect as a raw value, it just fails later, when
   * somebody reaches for it and calls it precedent. The 0.28 scrub track was
   * turned away once on that rule, when the claim was that the ROOM drew it —
   * the room draws no transport at all. It is back below under its right name
   * because student-profile draws it on four boards, which is a different
   * fact, not a softened rule.
   */
  /** The fill behind an over-footage control — mute, camera, audio, leave. */
  onInkGround: 'rgba(255, 255, 255, 0.14)',
  /** Its hairline, and the border on the interviewer's tile. */
  onInkEdge: 'rgba(255, 255, 255, 0.22)',
  /** The 9:16 framing guide — its rect, its head-room rules, its centre line. */
  guideLine: 'rgba(255, 255, 255, 0.26)',
  /** A quiet bar in the audio-level meter (ST-30-D). */
  onInkLevel: 'rgba(255, 255, 255, 0.34)',
  /**
   * The guide's corner ticks and a loud bar in the level meter — the only two
   * marks over footage allowed above a quarter opacity without being white.
   * They are the ones a person has to find while looking at their own face.
   */
  guideEdge: 'rgba(255, 255, 255, 0.62)',

  /**
   * ── the four marks that sit ON a still ────────────────────────────────
   * The set above is for things drawn over LIVE footage in the room. These
   * four are for a framed video anywhere else — a player, a card head, a clip
   * thumbnail — and they are nearly opaque where the room's are nearly
   * transparent, which is the whole difference: the room is asking you to see
   * through its marks to your own face, and a player is asking you to read a
   * duration off a picture you do not control.
   */
  /** The idle play disc on a still — white, all but solid (profile ST-20/32). */
  onInkDisc: 'rgba(255, 255, 255, 0.94)',
  /** The same disc once the film is RUNNING: ink, so the picture stays the subject. */
  onInkDiscPlaying: 'rgba(15, 26, 34, 0.55)',
  /** A paper badge laid on a still — a duration, an Unverified tag (profile ST-21). */
  onInkBadge: 'rgba(255, 255, 255, 0.92)',
  /** The transport scrubber's unfilled track. The fill is plain white. */
  onInkTrack: 'rgba(255, 255, 255, 0.28)',

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
  /** Cards, and every framed video (ink/placeholder ground — `VideoFrame`'s sunken/list-thumb scale stays on `md`). */
  lg: 24,
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
  prose: 1.55,

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
  /** Tighter than the steps below it: at 13 the mono is a mark, not a line. */
  'meta-lg': 1.2,
  'meta-xl': 1.4,
  /** Same reasoning as `meta-hero`: a ring's centre label owns its own box. */
  'meta-2xl': 1,
  /** A clock is one line and owns its own box. Nothing sets beneath it. */
  'meta-hero': 1,
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
  meta: '0.1em',
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
  'meta-clock': '0.08em',
  'meta-clock-lg': '0.04em',
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
 * Two faces, two jobs — see the header note.
 *
 * display and body both resolve to the same loaded Libre Franklin, so a
 * component switching between `fontFamily.display` and `.body` is choosing a
 * weight/size role, not a typeface. The *-loaded variables are set by
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
 * `display` and `body` are the same Libre Franklin now — see `fontFamily`'s
 * header note — so both sets of keys below point at the same five static
 * weight files (Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700)
 * plus one Italic. They stay as separate `display*`/`body*` keys rather than
 * collapsing to one set: the names still mark CONTENT vs INTERFACE, and a
 * future redesign that gives `display-*` its own face again should not have
 * to touch every call site that reads `fontFamilyNative.body*`.
 *
 * Google ships Libre Franklin as a variable font only — no static weights in
 * the repo — so these five files are instanced out of it with `fonttools
 * varLib.instancer --update-name-table` (the variable source and the exact
 * command are worth keeping in mind if a weight ever needs re-cutting; not
 * committed here, only the resulting statics are).
 *
 * RN has no synthetic weight for a custom face — asking for fontWeight 600 on a
 * Regular file silently gives you Regular on Android — so every weight the
 * design uses is bundled as its own file and named here.
 */
export const fontFamilyNative = {
  displayLight: 'LibreFranklin-Light',
  display: 'LibreFranklin-Regular',
  displayMedium: 'LibreFranklin-Medium',
  displayItalic: 'LibreFranklin-Italic',

  body: 'LibreFranklin-Regular',
  bodyMedium: 'LibreFranklin-Medium',
  bodySemiBold: 'LibreFranklin-SemiBold',
  bodyBold: 'LibreFranklin-Bold',

  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoSemiBold: 'IBMPlexMono-SemiBold',

  /** The platform's own sans, where the bundled face is not used — no longer a serif fallback now that display isn't one. */
  displayFallback: 'sans-serif',
} as const

/**
 * The wordmark's face on mobile.
 *
 * This used to fall back to the platform serif on each platform, because the
 * display face was not bundled and shipping four weights for one word was not
 * worth it. The display face is bundled now, so the wordmark sets in the same
 * face as the rest of the product on both platforms — which is the point of a
 * wordmark, and that stayed true when the face changed from Newsreader to
 * Libre Franklin. Kept in `Platform.select` shape so call sites do not have to
 * change.
 */
export const fontFamilyNativeWordmark = {
  ios: 'LibreFranklin-Regular',
  android: 'LibreFranklin-Regular',
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
 * Three levels of elevation in the whole system, and the rule is flat by
 * default: a hairline does the work almost everywhere.
 *
 * `card` lifts a surface off the page — swipe cards, sheets, toasts. `raised`
 * is the small lift under a segmented control's selected pane. `focus` is the
 * ring a field wears while it has the caret: 3px of ink at 6%, never blue.
 *
 * `lift` is the fourth, and it exists only for what sits OVER FOOTAGE — the
 * interview room's transient band. On paper a card is separated from the page
 * by a hairline and a change of ground, so `card` can stay almost invisible;
 * over a moving image there is neither, and a band carrying "One minute left"
 * has to read as a sheet of paper laid on top of the picture rather than a
 * tint composited into it. It is the room's own `--lift`, unchanged.
 */
export const shadow = {
  card: '0 2px 4px rgba(15, 26, 34, 0.04), 0 16px 40px -12px rgba(15, 26, 34, 0.14)',
  raised: '0 1px 2px rgba(15, 26, 34, 0.08)',
  focus: '0 0 0 3px rgba(22, 25, 28, 0.06)',
  /**
   * The only coloured shadow in the system, and it exists for exactly one
   * control: the save action on the job feed. That button is the whole gesture
   * the feed is built around, so it is allowed to lift off the card in a way
   * nothing else does.
   */
  accent: '0 8px 20px -8px rgba(176, 30, 36, 0.6)',
  lift: '0 2px 6px rgba(15, 26, 34, 0.18), 0 16px 40px -16px rgba(15, 26, 34, 0.45)',
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
  column: 1152,
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
  /**
   * The narrowest a NUMERIC chip may get. A row of score or year chips whose
   * widths follow their digit counts reads as a ragged list rather than as a
   * set of equal choices, and '1' beside '10' beside '100' is where that shows
   * first. It is a floor and not a width: a chip with a word in it still grows
   * past it.
   */
  'chip-min': 48,
  /**
   * The toggle track's width, paired with `height.toggle` at 26. It is the
   * 44px tap cell the switch sits in, which is why the track is not narrower:
   * the visible control and the box a finger has to hit are one measurement,
   * so a change to either cannot leave the other behind.
   */
  'toggle-track': 44,
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
  /**
   * A switch, and the knob inside it.
   *
   * 26 around the 22px knob, with `container['toggle-track']` at 44 for its
   * width. Three flows drew three tracks — 52x32 knob 26, 44x26 knob 22,
   * 40x24 knob 20 — and account's is the reading that survives: its knob is
   * already the knob token, and its width is exactly the 44px tap cell the
   * switch is centred in, so the track and the target are one measurement
   * rather than two that drift. It was 28, which matched no board at all.
   */
  toggle: 26,
  'toggle-knob': 22,
  /** The smallest square a finger reliably hits. */
  tap: 44,
  /** A glyph slot in the tab bar — placeholder until the icon set arrives. */
  glyph: 24,
  /** The pill behind an active Android tab. */
  'tab-indicator': 30,
  /** The bottom tab bar itself, above the safe-area inset it sits on top of. */
  'tab-bar': 64,

  header: 60,
  'header-lg': 72,
  'otp-cell': 52,
  'otp-cell-lg': 76,
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
 * The brand mark's own proportions.
 *
 * The wordmark sets larger than the glyph beside it: the serif has a small
 * x-height, so matching the two sizes makes the word look shrunken next to the
 * mark. This is the ratio that makes them read as one lockup.
 */
export const brand = {
  wordmarkRatio: 1.15,
  /**
   * The mark's size inside an app bar, mobile and desktop.
   *
   * These are tokens rather than numbers inside AppBar because the WORDMARK is
   * derived from them: 18 × 1.15 is the 18/20.7 lockup every mobile board in
   * nine flows draws, and 20 × 1.15 is the 20/23 one every desktop board
   * draws. A bar that picks its own mark size silently picks a wordmark size
   * too, and the two lockups stop matching across surfaces.
   */
  markInBar: 18,
  markInBarLg: 20,
} as const

/** Interview capture is locked to 9:16 (IR-02); every card that shows one mirrors it. */
export const aspect = { videoResume: 9 / 16, fullVideo: 16 / 9 } as const

export type ColorToken = keyof typeof color
export type FontSizeToken = keyof typeof fontSize
