import React from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { color, height, opacity, radius, space } from '../../theme'
import { Body, Button, Card, Display, Divider, ErrorState, Eyebrow, Skeleton } from '../../components/ui'
import { CompanyMonogram, EmployerShell, Glyph, VerifiedEmployerBadge } from '../../components/employer'
import type { EmployerState } from '../../lib/api/employer'
import { companySizeLabel } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'

export interface EmployerCompanyScreenProps {
  onBack: () => void
}

/**
 * EM-07 · Company profile.
 *
 * The page a candidate opens from an Interest or a job post, drawn inside the
 * employer's own shell so they can see exactly what candidates will see — and,
 * under it, the record it is drawn from. The same screen as the web's
 * /employers/company.
 *
 * Four rules are built in:
 *
 *   THE BADGE IS EARNED OR ABSENT. A verified company carries the Verified
 *   Employer badge beside its name. A pending one gets nothing in that place:
 *   no greyed badge, no "verification pending" chip on the card. The shell's
 *   prompt already says where verification stands, once, in the one place it
 *   is said.
 *
 *   NAMES ARE CONTENT. The company and the authorised person are set in the
 *   serif — on the card and again in the details — and the designation, the
 *   industry and every label are interface, in the sans and the mono.
 *
 *   A COMPANY IS A MONOGRAM. The employer record has no logo field, so the
 *   card draws the initials, and the Logo row says so rather than offering an
 *   upload the API cannot take.
 *
 *   READ-ONLY. There is no update endpoint for the company record
 *   (GET /employers/me only), so the board's Edit actions are not drawn: an
 *   Edit that leads nowhere is a control that lies.
 */
export function EmployerCompanyScreen({ onBack }: EmployerCompanyScreenProps) {
  const { state, error, refresh } = useEmployer()

  return (
    <EmployerShell back={{ label: 'Home', onPress: onBack }}>
      <Display level="lg" accessibilityRole="header">
        Company profile
      </Display>

      {state ? (
        <Profile state={state} />
      ) : error ? (
        <ErrorState
          title="We could not load your company."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      ) : (
        <Skeleton lines={4} />
      )}
    </EmployerShell>
  )
}

function Profile({ state }: { state: EmployerState }) {
  const { company, contact } = state
  const person = company.authorisedPerson

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionIntro}>
          <Eyebrow>How candidates see you</Eyebrow>
          <Body size="xs" tone="muted">
            {state.verified
              ? 'This is the page a candidate opens from your Interest or a job you post.'
              : 'Candidates cannot see your company until it is verified. This is how the page will look.'}
          </Body>
        </View>
        <PublicCard state={state} />
      </View>

      <View>
        <Eyebrow accessibilityRole="header">Company details</Eyebrow>
        <View style={styles.grid}>
          <KeyValue label="Company name" value={<Name>{company.name}</Name>} />
          <View style={styles.gridRow}>
            <KeyValue label="Industry" value={company.industry} />
            <KeyValue label="Company size" value={`${companySizeLabel(company.size)} people`} />
          </View>
          <View style={styles.gridRow}>
            <KeyValue label="Office location" value={company.officeLocation} />
            <KeyValue label="Website" value={company.website ? websiteLabel(company.website) : null} />
          </View>
          <KeyValue label="Logo" value="Not uploaded · initials shown" />
        </View>
      </View>

      <View>
        <Eyebrow accessibilityRole="header">Authorised person</Eyebrow>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <KeyValue label="Name" value={<Name>{person.name}</Name>} />
            <KeyValue label="Designation" value={person.designation} />
          </View>
          <KeyValue label="Work email" value={contact.email} />
          <View style={styles.gridRow}>
            <KeyValue label="Mobile" value={mobileLabel(contact.mobile)} />
            <View style={styles.cell} />
          </View>
        </View>
      </View>
    </>
  )
}

/**
 * The public card, on a muted well so it reads as a page held up for the
 * employer to look at rather than as part of their own screen.
 */
function PublicCard({ state }: { state: EmployerState }) {
  const { company } = state
  const person = company.authorisedPerson

  return (
    <View style={styles.well}>
      <Card style={styles.card}>
        <View style={styles.identity}>
          <CompanyMonogram name={company.name} size={space['4xl']} />
          <View style={styles.naming}>
            <Display level="md">{company.name}</Display>
            {state.verified && <VerifiedEmployerBadge />}
          </View>
        </View>

        <Body size="sm" tone="muted" style={styles.meta}>
          {`${company.industry} · ${companySizeLabel(company.size)} people · ${company.officeLocation}`}
        </Body>

        {!!company.website && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Website, ${websiteLabel(company.website)}`}
            onPress={() => Linking.openURL(websiteHref(company.website!)).catch(() => undefined)}
            style={({ pressed }) => [styles.site, pressed && styles.pressed]}
          >
            <Glyph name="globe" size={space.md} tint={color.textMuted} />
            <Body size="sm" weight="medium" style={styles.siteText}>
              {websiteLabel(company.website)}
            </Body>
          </Pressable>
        )}

        <Divider style={company.website ? styles.ruleAfterSite : styles.rule} />

        <View style={styles.person}>
          <Eyebrow>Authorised person</Eyebrow>
          <Display level="xs" style={styles.personName}>
            {person.name}
          </Display>
          <Body size="sm" tone="muted">
            {person.designation}
          </Body>
        </View>
      </Card>
    </View>
  )
}

/**
 * One fact: the mono label, then the value at 13 medium. An empty value reads
 * 'Not set yet' rather than leaving a hole. A name is content, so it is passed
 * in already set in the serif.
 */
function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === ''
  return (
    <View style={styles.cell}>
      <Eyebrow>{label}</Eyebrow>
      {typeof value === 'string' || empty ? (
        <Body size="sm" weight="medium" tone={empty ? 'subtle' : 'default'}>
          {empty ? 'Not set yet' : value}
        </Body>
      ) : (
        value
      )}
    </View>
  )
}

/** A name inside a KeyValue: the serif at the list-row step, not the fact's sans. */
function Name({ children }: { children: string }) {
  return <Display level="xs">{children}</Display>
}

/** 'copperleaf.test' → 'https://copperleaf.test'. An address that already has a scheme is left alone. */
function websiteHref(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`
}

/** 'https://copperleaf.test/' → 'copperleaf.test' — the address as a person reads it out. */
function websiteLabel(site: string): string {
  return site.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/** '9800000003' → '+91 98000 00003'. Anything that is not ten digits is shown as stored. */
function mobileLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10)
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : mobile
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },

  section: { gap: space.md },
  sectionIntro: { gap: space.xs },

  well: { borderRadius: radius.lg, backgroundColor: color.surfaceMuted, padding: space.md },
  card: { padding: space.xl },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  naming: { flex: 1, alignItems: 'flex-start', gap: space.sm },
  meta: { marginTop: space.md },
  site: { minHeight: height.tap, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs },
  siteText: {
    flexShrink: 1,
    textDecorationLine: 'underline',
    textDecorationColor: color.borderStrong,
  },
  rule: { marginTop: space.md },
  ruleAfterSite: { marginTop: space.xs },
  person: { marginTop: space.md, gap: space['2xs'] },
  personName: { marginTop: space.xs },

  grid: { marginTop: space.xs },
  gridRow: { flexDirection: 'row', gap: space.lg },
  cell: { flex: 1, gap: space['2xs'], paddingVertical: space.sm },
})
