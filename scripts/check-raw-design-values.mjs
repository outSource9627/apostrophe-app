import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Fails if a design value has been written into a screen instead of taken from
 * src/theme/tokens.ts.
 *
 * React Native has no utility classes, so the shape of the defect here is a
 * number sitting in a StyleSheet — `fontSize: 13.5` rather than
 * `fontSize: fontSize['13-5']`. That is the same defect as a hex literal: it
 * reads fine, it is invisible in review, and it means the type scale no longer
 * lives in one place. The web repos enforce the equivalent rules.
 *
 * Runs as part of `npm run theme:check`.
 */
const ROOTS = ['src']
const ALLOW = [join('src', 'theme', 'tokens.ts')]

/**
 * Properties whose value is always a design decision. `0` is exempt: it means
 * "none", not a measurement, and `marginTop: 0` is clearer than a token for it.
 * `flex`, `zIndex` and the layout keywords are not design values and are not
 * listed.
 */
const PROPS = [
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'opacity',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'gap',
  'rowGap',
  'columnGap',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
]

const RULES = [
  {
    name: 'raw colour',
    pattern: /#[0-9A-Fa-f]{3,8}\b|\b(?:rgba?|hsla?)\(/g,
    fix: 'import { color } from the tokens — color.inkRaised, color.textOnInkMuted',
  },
  {
    name: 'raw font family',
    // A bundled face or a platform fallback, quoted in place.
    pattern: /fontFamily: *['"][^'"]+['"]/g,
    fix: 'use fontFamilyNative, fontFamilyNative.displayFallback or fontFamilyNativeWordmark',
  },
  {
    name: 'raw measurement',
    // Any of the properties above set to a number other than 0.
    pattern: new RegExp(`\\b(?:${PROPS.join('|')}): *-?(?!0\\b)\\d+(?:\\.\\d+)?`, 'g'),
    fix: 'use space, fontSize, radius, height, container, leadingNative, trackingNative, borderWidth or opacity',
  },
  {
    /**
     * React Native imports the token object directly, so the legacy scale shows
     * up as a key rather than a class. `fontSize['34']` and `space['11']` were
     * the numeric steps that existed only to keep the old screens pixel-exact;
     * the scale is now named for the face and the role, and those keys are gone.
     *
     * The pattern matches a purely numeric key, so the real steps that merely
     * begin with a digit — space['2xl'], fontSize['2xs'] — are left alone.
     */
    name: 'legacy token key',
    pattern: /\b(?:fontSize|space|radius|tracking|leading|height)\['\d+(?:-5)?'\]/g,
    fix: "use a named step — fontSize['ui-sm'], space.lg, radius.md",
  },
  {
    name: 'legacy native scale key',
    pattern:
      /\btrackingNative\.(?:tightest|tighter|wide|wider|eyebrowTight)\b|\bleadingNative\.(?:body|bodyLg|lede|ledeLg|display|displayLg)\b/g,
    fix: "trackingNative and leadingNative are keyed to the font size steps now — leadingNative['ui-base']",
  },
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (!['node_modules', '.git'].includes(entry)) walk(p, out)
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      if (!ALLOW.includes(p)) out.push(p)
    }
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r))
let failed = false

for (const rule of RULES) {
  const offenders = []
  for (const file of files) {
    const found = readFileSync(file, 'utf8').match(rule.pattern)
    if (found) offenders.push(`  ${file}: ${[...new Set(found)].join(', ')}`)
  }
  if (offenders.length) {
    failed = true
    console.error(`\n${rule.name} in ${offenders.length} file(s) — ${rule.fix}`)
    console.error(offenders.join('\n'))
  }
}

if (failed) {
  console.error('\nDesign values belong in src/theme/tokens.ts, which is synced from')
  console.error('apostrophe-user/lib/theme/tokens.ts by: npm run theme:sync')
  process.exit(1)
}
console.log(`no raw design values in ${files.length} files`)
