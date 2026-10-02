import React, { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { color, fontFamilyNative as FF } from '../../theme'
import { ApiClientError } from '../../lib/api'
import { getMe, resendVerificationEmail } from '../../lib/api/account'
import { mobileLabel } from '../../lib/interviewer/profile'
import { INTERVIEWER_KEY } from '../../lib/interviewer/useInterviewer'
import { AcBadge, AcErrorBlock, AcLink, AcList, AcNotice, AcPage, AcRow, AcSkel, AcSmallBtn, SupportSheet, noticeText } from './accountKit'
import type { RootStackParamList } from '../../../App'

/**
 * Contact and verification (docs/interviewer-account-mockup.html, screen 2):
 * the email and mobile the interviewer signs in with, each with its state from
 * GET /auth/me. An unverified email can be sent a fresh link (POST
 * /auth/email/resend, 30 s between sends). There is no route to verify a mobile
 * or to change either identifier, so those hand off to support by mail.
 */
export function InterviewerContactScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const q = useQuery({ queryKey: [...INTERVIEWER_KEY, 'identity'], queryFn: getMe, retry: false, refetchOnMount: 'always' })
  const [verify, setVerify] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [support, setSupport] = useState<string | null>(null)
  const me = q.data

  async function onVerify() {
    if (!me?.email) return
    setVerify('sending')
    setError(null)
    try {
      await resendVerificationEmail(me.email)
      setVerify('sent')
    } catch (e) {
      setVerify('idle')
      setError(e instanceof ApiClientError ? e.message : 'Couldn’t send the link. Check your connection and try again.')
    }
  }

  const emailRight = !me ? null
    : me.emailVerified ? <AcBadge label="Verified" tone="green" />
    : !me.email ? <AcBadge label="Not verified" tone="amber" />
    : verify === 'sent' ? <AcBadge label="Link sent" tone="blue" />
    : verify === 'sending' ? <AcBadge label="Sending…" tone="gray" />
    : <AcSmallBtn label="Verify" onPress={() => { void onVerify() }} />

  return (
    <AcPage title="Contact and verification" onBack={() => navigation.goBack()}>
      {q.isPending ? (
        <>
          <AcSkel h={64} r={16} /><AcSkel h={64} r={16} />
        </>
      ) : q.isError || !me ? (
        <AcErrorBlock title="Couldn’t load your contact details." body="Nothing was changed. Try again in a moment." onRetry={() => { void q.refetch() }} />
      ) : (
        <>
          <Text style={st.lede}>The address and number you sign in with. They can’t be edited here.</Text>
          <AcList>
            <AcRow icon="mail" title={me.email ?? 'No email'} sub={me.emailVerified ? 'Email' : 'Email · verify it so we can reach you about payouts'} right={emailRight} />
            <AcRow icon="phone" title={me.mobile ? mobileLabel(me.mobile) : 'No mobile'} sub="Mobile · how you sign in" right={me.mobileVerified ? <AcBadge label="Verified" tone="green" /> : <AcBadge label="Not verified" tone="amber" />} last />
          </AcList>
          {verify === 'sent' && <AcNotice tone="ok"><Text style={noticeText('ok')}>{`We sent a verification link to ${me.email}. You can ask for another in 30 seconds.`}</Text></AcNotice>}
          {!!error && <AcNotice tone="error"><Text style={noticeText('error')}>{error}</Text></AcNotice>}
          {!me.mobileVerified && (
            <AcNotice tone="info">
              <Text style={noticeText('info')}>{'A mobile that isn’t verified can’t be verified from the app yet: '}<AcLink label="talk to support" onPress={() => setSupport('Verify my mobile number')} />{'.'}</Text>
            </AcNotice>
          )}
          <AcList>
            <AcRow icon="info" title="Need to change your email or mobile?" sub="Support does it after checking it is you" onPress={() => setSupport('Change my email or mobile')} last />
          </AcList>
        </>
      )}
      <SupportSheet subject={support} onClose={() => setSupport(null)} />
    </AcPage>
  )
}

const st = StyleSheet.create({
  lede: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
})
