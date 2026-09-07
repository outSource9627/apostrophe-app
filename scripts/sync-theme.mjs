import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Design tokens have exactly one source: apostrophe-user/lib/theme/tokens.ts.
 * A colour that exists on web and not on mobile is a parity defect, the same as
 * a missing feature (PRD section 7).
 *
 *   npm run theme:sync    copy the canonical tokens in
 *   npm run theme:check   fail if they have drifted (run this in CI)
 */
const SOURCE = '../apostrophe-user/lib/theme/tokens.ts'
const TARGET = 'src/theme/tokens.ts'

const check = process.argv.includes('--check')
const source = readFileSync(SOURCE, 'utf8')

if (check) {
  if (readFileSync(TARGET, 'utf8') !== source) {
    console.error('Design tokens have drifted from apostrophe-user/lib/theme/tokens.ts.\nRun: npm run theme:sync')
    process.exit(1)
  }
  console.log('design tokens in sync')
} else {
  writeFileSync(TARGET, source)
  console.log(`synced ${TARGET} from ${SOURCE}`)
}
