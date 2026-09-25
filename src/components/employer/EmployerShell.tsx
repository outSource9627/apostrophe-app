import React, { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View,
  type ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'
import { EmAvatarButton, EmBar, EmBell, EmFoot, initialsOf } from './em'
import { tabBarInfoFor } from '../../navigation/tabConfig'
import { VerificationPrompt } from './VerificationPrompt'

/**
 * The frame every signed-in employer screen sits in (Employer Android A.*):
 * the bar, the verification strip, a scrolling body and an optional sticky
 * foot. The bottom tabs are the app's global bar (navigation/BottomTabBar),
 * never drawn here — two bars stacked was a bug.
 *
 * THE STRIP LIVES HERE. It is read from `useEmployer` and drawn by this shell,
 * so no screen can forget it, restyle it or hide it.
 *
 * A top-level screen (no `back`) carries the bell and the company initials on
 * the right unless it passes its own `right`.
 */
export function EmployerShell({
  back, title, sub, big, right, footer, footerStack, children, scroll = true, scrollRef, contentGap = 'sm',
  keyboardShouldPersistTaps = 'handled', barBorder, bodyStyle, bar = true, onScroll,
}: {
  /** The body's scroll, for a bar that changes as the page moves (EM-09b). */
  onScroll?: ScrollViewProps['onScroll']
  /** false for a screen the design draws with no bar (EM-05b). */
  bar?: boolean
  /** A drill-down screen's back. `label` is kept for older callers and not drawn. */
  back?: { label?: string; onPress: () => void } | (() => void)
  title?: string
  /** The mono line under the title. */
  sub?: string
  /** 26 (a top-level screen) rather than 18. Defaults to true without `back`. */
  big?: boolean
  /** The bar's right slot; a top-level screen without it gets the bell and the initials. */
  right?: React.ReactNode
  /** The screen's action band, pinned above the home indicator. */
  footer?: React.ReactNode
  footerStack?: boolean
  children: React.ReactNode
  /** false when the screen brings its own list. */
  scroll?: boolean
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>
  /** `sm` is the design's 12 between cards; `lg` 16 for a form. */
  contentGap?: 'lg' | 'sm'
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
  barBorder?: boolean
  bodyStyle?: object
  /** @deprecated The global tab bar draws the navigation. */
  nav?: React.ReactNode
  /** @deprecated The initials open Account by default. */
  onAccount?: () => void
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

  const onBack = typeof back === 'function' ? back : back?.onPress
  const tabbed = !!tabBarInfoFor(route.name)
  const bottomPad = footer || tabbed ? 0 : insets.bottom
  const gap = contentGap === 'lg' ? space.lg : space.md
  const headerRight = right !== undefined ? right : onBack ? null : (
    <>
      <EmBell unread={(state?.unreadNotifications ?? 0) > 0} onPress={() => navigation.navigate('EmployerNotifications')} />
      <EmAvatarButton initials={initialsOf(state?.company.name)} onPress={() => navigation.navigate('EmployerAccount')} />
    </>
  )

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!!prompt && (
        <VerificationPrompt
          prompt={prompt}
          here={route.name === prompt.href}
          onPress={() => navigation.navigate(prompt.href as never)}
        />
      )}
      {bar && <EmBar title={title} sub={sub} big={big ?? !onBack} onBack={onBack} right={headerRight} border={barBorder} />}

      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={[styles.body, { gap, paddingBottom: space.lg + bottomPad }, bodyStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 32 : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.textSubtle} />
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.grow}>{children}</View>
      )}

      {!!footer && <EmFoot inset={!tabbed} stack={footerStack}>{footer}</EmFoot>}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs },
})
