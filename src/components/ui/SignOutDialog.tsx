import React, { useEffect, useRef, useState } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  color, fontFamilyNative as FF, fontSize, height, opacity, radius, shadow, space, spaceHalf, trackingNative,
} from '../../theme'
import { Button } from './Button'
import { Icon } from './Icon'
import { text } from './typography'

/**
 * Sign out, one for the student, the employer and the interviewer
 * (docs/feed-shortlist-forms-mockups.html · signout, the centre dialog). The
 * words are the website's.
 *
 * `SignOutButton` is the trigger every account screen ends with: the
 * full-width outlined destructive button. `SignOutDialog` asks first — the
 * danger disc, the title and one line, then Sign out (filled in the danger
 * orange-red, not the brand red, so it does not read as a primary action)
 * over a quiet Cancel.
 *
 * The dialog owns the busy state: while `onConfirm` runs, Sign out shows a
 * spinner and "Signing out…", and Cancel, the scrim and Back do nothing. The
 * screen's `onConfirm` is what it always did (log out, clear the token, leave),
 * so the dialog comes down with the screen; if it throws, the dialog can be
 * used again.
 */
export function SignOutButton({ onPress }: { onPress: () => void }) {
  return <Button variant="destructive" size="cta" icon="out" label="Sign out" full onPress={onPress} />
}

export function SignOutDialog({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  // The card settles in (96 % → full size) while the Modal fades the scrim.
  const settle = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!open) return
    settle.setValue(0)
    Animated.spring(settle, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start()
  }, [open, settle])
  const close = () => {
    if (!busy) onClose()
  }

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable accessibilityLabel="Close" disabled={busy} onPress={close} style={styles.scrim} />
        <Animated.View
          style={[styles.dialog, { transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.disc}>
            <Icon name="out" size={height.glyph} tint={color.dangerFill} weight={2.2} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Sign out of Lenient?</Text>
          <Text style={[text.uiMd, styles.body]}>You will be signed out on this device.</Text>
          <View style={styles.actions}>
            <Button
              variant="dangerFill"
              size="cta"
              label={busy ? 'Signing out…' : 'Sign out'}
              busy={busy}
              style={busy ? styles.busy : undefined}
              onPress={() => { confirm() }}
            />
            {/* Dimmed rather than greyed while signing out, and deaf to taps. */}
            <View style={busy && styles.off} pointerEvents={busy ? 'none' : 'auto'}>
              <Button variant="quiet" size="block" label="Cancel" accessibilityState={{ disabled: busy }} onPress={close} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl + space['2xs'] },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  dialog: {
    backgroundColor: color.surface, borderRadius: radius.modal, boxShadow: shadow.frame,
    paddingTop: spaceHalf['6'], paddingHorizontal: space.xl, paddingBottom: space.lg,
  },
  disc: {
    alignSelf: 'center', width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.dangerSoft,
  },
  title: {
    marginTop: spaceHalf['3.5'], fontFamily: FF.bodyBold, fontSize: fontSize['display-tile'], lineHeight: fontSize['display-tile'] + space.xs,
    letterSpacing: trackingNative['snug-sm'], color: color.text, textAlign: 'center',
  },
  body: { marginTop: spaceHalf['1.5'], color: color.textMuted, textAlign: 'center' },
  actions: { marginTop: space.xl, gap: space.sm },
  busy: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },
})
