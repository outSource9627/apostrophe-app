import React, { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View,
  type ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, space } from '../../theme'
import { Eyebrow } from '../ui'
import { Logo } from '../Logo'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'
import { CompanyMonogram, Glyph } from './parts'
import { VerificationPrompt } from './VerificationPrompt'

/**
 * The frame every signed-in employer screen sits in: the app bar, the
 * verification prompt's slot, a scrolling body, an optional sticky footer for
 * the screen's one action — and, only once verified, the bottom navigation.
 *
 * THE PROMPT LIVES HERE. It is read from `useEmployer` and drawn by this shell,
 * so no screen can forget it, restyle it or hide it to look cleaner. Its press
 * goes to where its state is resolved; on that screen it drops its chevron.
 *
 * A PENDING SHELL HAS NO BOTTOM NAV. `nav` is not rendered until the account is
 * verified: a destination the employer cannot use yet is absent, not greyed.
 *
 * The app bar is the board's (EM-04..07), not the library AppBar: its back is a
 * 44 tap box with the route it returns to as an eyebrow, where the library's is
 * a 34 box that misses the tap floor, and its leading slot holds the brand.
 */
export function EmployerShell({
  back, onAccount, footer, nav, children, scroll = true, scrollRef, contentGap = 'lg',
  keyboardShouldPersistTaps = 'handled',
}: {
  /** A drill-down screen: the chevron, and the name of where it returns to. */
  back?: { label: string; onPress: () => void }
  /** The company monogram on the right. Omitted on drill-down screens. */
  onAccount?: () => void
  /** The screen's one action, pinned above the home indicator. */
  footer?: React.ReactNode
  /** Bottom navigation. Drawn only when the employer is verified. */
  nav?: React.ReactNode
  children: React.ReactNode
  /** false when the screen brings its own list. */
  scroll?: boolean
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>
  /** The rhythm between blocks: `lg` is the board's 28 (space['2xl']); `sm` is 16 for dense rows. */
  contentGap?: 'lg' | 'sm'
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
}) {
  const insets = useSafeAreaInsets()
  const route = useRoute()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const employer = useEmployer()
  const { prompt, state, refresh } = employer

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const bottomPad = footer || (nav && state?.verified) ? 0 : insets.bottom
  const gap = contentGap === 'lg' ? space['2xl'] : space.lg

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bar}>
        {back ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Back to ${back.label.toLowerCase()}`}
              onPress={back.onPress}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Glyph name="chevronLeft" size={height.glyph} weight={borderWidth.accent} />
            </Pressable>
            <Eyebrow>{back.label}</Eyebrow>
          </>
        ) : (
          <Logo size={18} />
        )}
        <View style={styles.grow} />
        {!!onAccount && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account"
            onPress={onAccount}
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
          >
            <CompanyMonogram name={state?.company.name ?? ''} />
          </Pressable>
        )}
      </View>

      {!!prompt && (
        <VerificationPrompt
          prompt={prompt}
          here={route.name === prompt.href}
          onPress={() => navigation.navigate(prompt.href as never)}
        />
      )}

      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={[styles.body, { gap, paddingBottom: space['2xl'] + bottomPad }]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.textSubtle} />
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.grow}>{children}</View>
      )}

      {!!footer && <View style={[styles.footer, { paddingBottom: space.lg + insets.bottom }]}>{footer}</View>}

      {state?.verified ? nav : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xs'],
    paddingHorizontal: space.xl,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  // Hung over the gutter so the chevron lines up with the content edge.
  back: {
    width: height.tap,
    height: height.tap,
    marginLeft: -space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  account: {
    width: height.tap,
    height: height.tap,
    marginRight: -space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.xl, paddingTop: space.xl },
  footer: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
  },
})
