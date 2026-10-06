import React from 'react'
import { ConfirmSheet } from '../../components/tab/kit'

/**
 * "Are you sure?" for the one switch that takes a student in or out of the
 * employer feed — asked both ways, on every screen that draws the switch (Home,
 * Visibility, Videos). Ink, never crimson: hiding deletes nothing and
 * disconnects nobody, and the copy says exactly what changes and what does not,
 * in the Visibility screen's own words.
 *
 * `hide` is the value about to be saved (`true` hides), or null when closed.
 */
export function FeedVisibilitySheet({ hide, busy, error, onConfirm, onClose }: {
  hide: boolean | null; busy?: boolean; error?: string | null; onConfirm: (hide: boolean) => void; onClose: () => void
}) {
  const hiding = hide === true
  return (
    <ConfirmSheet
      open={hide !== null}
      title={hiding ? 'Hide from employers?' : 'Show me to employers?'}
      body={hiding
        ? 'You stop appearing in the employer feed, so new employers won’t come across your profile. Your video resume, connections and chats stay exactly as they are, and you can turn it back on whenever you like.'
        : 'Employers swiping the feed will see your video resume and your profile, and can send you an Interest. It takes effect immediately.'}
      confirmLabel={hiding ? 'Hide me' : 'Show me'}
      cancelLabel={hiding ? 'Stay visible' : 'Stay hidden'}
      busy={busy}
      error={error}
      onConfirm={() => { if (hide !== null) onConfirm(hide) }}
      onClose={onClose}
    />
  )
}
