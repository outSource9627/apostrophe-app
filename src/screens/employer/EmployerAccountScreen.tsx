import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, initialsOf } from '../../components/employer/em'
import { tokenStore } from '../../lib/api'
import { getMe, logout, type Me } from '../../lib/api/account'
import { openEmployerSupport } from '../../lib/api/employerChat'
import { companySizeLabel, formatIst } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'

/** '+91 98000 00001'. Anything that is not ten digits is shown as stored. */
function mobileLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10)
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : mobile
}

/**
 * EM-27 · Account (Employer Android): the company card (monogram, name, the
 * Verified Employer badge and "since" only once verified), the work email and
 * mobile (VERIFIED only when /auth/me says so), the account holder, five links,
 * and Sign out. Message Apostrophe Support opens the one support conversation.
 */
export function EmployerAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const queryClient = useQueryClient()
  const { state } = useEmployer()
  const [me, setMe] = useState<Me | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [supportBusy, setSupportBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    getMe().then(setMe).catch(() => {})
  }, [])

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
    } catch {
      /* best-effort; the session is cleared here regardless */
    }
    await tokenStore.clear()
    queryClient.removeQueries({ queryKey: ['employer'] })
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })
  }

  async function support() {
    setSupportBusy(true)
    setNotice(null)
    try {
      const { threadId } = await openEmployerSupport()
      navigation.navigate('EmployerThread', { id: threadId })
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Support did not open. Try again.')
    } finally {
      setSupportBusy(false)
    }
  }

  const company = state?.company
  const approvedAt = state?.verification.approvedAt
  const facts = company
    ? [company.industry, companySizeLabel(company.size), company.officeLocation, state?.verified && approvedAt ? `since ${formatIst(approvedAt).split(' · ')[0]}` : null]
        .filter(Boolean)
        .join(' · ')
    : ''
  const links: { label: string; onPress: () => void; busy?: boolean }[] = [
    { label: 'Company profile', onPress: () => navigation.navigate('EmployerCompany') },
    { label: 'Verification documents', onPress: () => navigation.navigate('EmployerStatus') },
    { label: 'Notification settings', onPress: () => navigation.navigate('EmployerNotificationSettings') },
    { label: 'Notifications history', onPress: () => navigation.navigate('EmployerNotifications') },
    { label: 'Message Apostrophe Support', onPress: () => { support() }, busy: supportBusy },
  ]

  return (
    <EmployerShell back={() => navigation.goBack()} title="Account" big right={null}>
      {company && (
        <EmCard>
          <View style={styles.head}>
            <View style={styles.mono}><Text style={[text.uiLeadSemi, styles.monoText]}>{initialsOf(company.name)}</Text></View>
            <View style={styles.grow}>
              <Text style={text.uiLgSemi}>{company.name}</Text>
              {state?.verified && <EmBadge label="Verified employer" tone="green" icon="shield" small />}
            </View>
          </View>
          {!!facts && <Text style={[text.uiXs, styles.muted]}>{facts}</Text>}
        </EmCard>
      )}

      <View>
        <Fact k="WORK EMAIL" v={state?.contact.email ?? me?.email ?? '—'} verified={me?.emailVerified} />
        <Fact k="MOBILE" v={state?.contact.mobile ? mobileLabel(state.contact.mobile) : me?.mobile ? mobileLabel(me.mobile) : '—'} verified={me?.mobileVerified} />
        {!!company && <Fact k="HOLDER" v={[company.authorisedPerson.name, company.authorisedPerson.designation].filter(Boolean).join(' · ')} />}
      </View>

      <View>
        {links.map((l) => (
          <Pressable key={l.label} accessibilityRole="button" onPress={l.onPress} disabled={l.busy} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <Text style={[text.uiBaseSemi, styles.grow]}>{l.label}</Text>
            <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
          </Pressable>
        ))}
      </View>
      {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}

      <Button variant="outline" size="cta" icon="out" label="Sign out" busy={signingOut} onPress={() => { signOut() }} />
    </EmployerShell>
  )
}

function Fact({ k, v, verified }: { k: string; v: string; verified?: boolean }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factHead}>
        <Text style={[text.metaSm, styles.muted, styles.mono2]}>{k}</Text>
        {verified && <EmBadge label="Verified" tone="green" icon="check" small />}
      </View>
      <Text style={text.uiBase}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: spaceHalf['1.5'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  mono2: { letterSpacing: trackingNative.eyebrow },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mono: { width: height['control-lg'], height: height['control-lg'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  monoText: { color: color.textSecondary },
  fact: { gap: space['2xs'] + 1, paddingVertical: spaceHalf['2.5'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: height.control, paddingVertical: space.md, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
})
