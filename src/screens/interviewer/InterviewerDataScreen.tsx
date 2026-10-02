import React, { useState } from 'react'
import { Linking, StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { color, fontFamilyNative as FF } from '../../theme'
import { ApiClientError } from '../../lib/api'
import {
  cancelDeletion, getDataExports, getDeletion, getMe, requestDataExport, requestDeletion,
  type DataExportRow, type DeletionRequest, type Me,
} from '../../lib/api/account'
import { fmtStampFull } from '../../lib/chat/format'
import { deletionConfirmMatches } from '../../lib/interviewer/profile'
import { AcCard, AcBadge, AcDialog, AcErrorBlock, AcField, AcHeading, AcInput, AcNotice, AcPage, AcPill, AcSkel, noticeText } from './accountKit'
import type { RootStackParamList } from '../../../App'

const fmtDate = (iso: string) => fmtStampFull(iso).replace(/,.*$/, '')
const KEY = ['data-rights']

/**
 * Your data (docs/interviewer-account-mockup.html, screen 5): the cross-role
 * export (GET/POST /me/data-export) and deletion (GET/POST/DELETE /me/deletion,
 * 30-day grace, confirmed by typing the account's own name, mobile or email).
 * The same routes and logic as the student's DataRightsScreen; only the words
 * are the interviewer's.
 */
export function InterviewerDataScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  const q = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<{ me: Me; exports: DataExportRow[]; deletion: DeletionRequest | null }> => {
      const [me, ex, del] = await Promise.all([getMe(), getDataExports(), getDeletion()])
      return { me, exports: ex.rows, deletion: del }
    },
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY })
  const say = (e: unknown) => setError(e instanceof ApiClientError ? e.message : 'That didn’t go through. Check your connection and try again.')
  const exportMut = useMutation({ mutationFn: () => requestDataExport(), onMutate: () => setError(null), onError: say, onSettled: invalidate })
  const deleteMut = useMutation({
    mutationFn: (confirm: string) => requestDeletion(confirm),
    onMutate: () => setError(null),
    onError: say,
    onSettled: () => { setConfirmOpen(false); setTyped(''); void invalidate() },
  })
  const cancelMut = useMutation({ mutationFn: () => cancelDeletion(), onMutate: () => setError(null), onError: say, onSettled: invalidate })

  let body: React.ReactNode
  if (q.isPending) {
    body = <><AcSkel h={96} r={16} /><AcSkel h={96} r={16} /></>
  } else if (q.isError) {
    body = <AcErrorBlock title="Could not load your data settings." body="Nothing was changed. Try again in a moment." onRetry={() => { void q.refetch() }} />
  } else {
    const { me, exports, deletion } = q.data!
    const pendingExport = exports.find((e) => e.status === 'PENDING')
    const readyExport = exports.find((e) => e.status === 'READY')
    const pendingDeletion = deletion && deletion.status === 'PENDING' ? deletion : null
    body = (
      <>
        {!!error && <AcNotice tone="error"><Text style={noticeText('error')}>{error}</Text></AcNotice>}
        <AcHeading>Export my data</AcHeading>
        <Text style={st.p}>A machine-readable copy of what we hold about you. It is prepared in the background and can take up to 30 days.</Text>
        {pendingExport ? (
          <AcNotice tone="info"><Text style={noticeText('info')}>We’re preparing your export. We’ll tell you when it’s ready.</Text></AcNotice>
        ) : readyExport ? (
          <>
            <AcNotice tone="ok"><Text style={noticeText('ok')}>Your export is ready. The link works for a short while.</Text></AcNotice>
            <AcPill icon="download" label="Download" disabled={!readyExport.url} onPress={() => { if (readyExport.url) void Linking.openURL(readyExport.url) }} />
          </>
        ) : (
          <AcPill tone="outline" icon="download" label="Request my data" busy={exportMut.isPending} busyLabel="Requesting…" onPress={() => exportMut.mutate()} />
        )}

        <AcHeading>Delete my account</AcHeading>
        <Text style={st.p}>Your account is hidden at once and erased after a 30-day grace period. What we must keep for the books stays: earnings and payout records, which carry no name, and the interviews you conducted. You can’t sign in again afterwards.</Text>
        {pendingDeletion ? (
          <AcCard>
            <AcBadge label="Deletion scheduled" tone="amber" />
            <Text style={st.p}>
              {'Your account is already hidden. It will be erased on '}<Text style={st.bold}>{fmtDate(pendingDeletion.dueAt)}</Text>{', 30 days after you asked. Until then you can change your mind.'}
            </Text>
            <AcPill tone="outline" label="Cancel deletion" busy={cancelMut.isPending} busyLabel="Cancelling…" onPress={() => cancelMut.mutate()} />
          </AcCard>
        ) : (
          <AcPill tone="outline" icon="trash" label="Delete my account" onPress={() => { setTyped(''); setConfirmOpen(true) }} />
        )}

        <AcDialog
          open={confirmOpen}
          title="Delete my account?"
          message="Type your name, mobile or email to confirm. This starts the 30-day countdown; you can cancel until it ends."
          onClose={() => setConfirmOpen(false)}
          actions={[
            { label: 'Cancel', onPress: () => setConfirmOpen(false) },
            { label: 'Delete', danger: true, disabled: deleteMut.isPending || !deletionConfirmMatches(typed, me), onPress: () => deleteMut.mutate(typed.trim()) },
          ]}
        >
          <AcField label="">
            <AcInput value={typed} onChangeText={setTyped} placeholder={me.name ?? 'Your name'} autoCapitalize="none" accessibilityLabel="Confirm" />
          </AcField>
        </AcDialog>
      </>
    )
  }

  return <AcPage title="Your data" sub="Export or delete" onBack={() => navigation.goBack()}>{body}</AcPage>
}

const st = StyleSheet.create({
  p: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  bold: { fontFamily: FF.bodyBold, color: color.text },
})
