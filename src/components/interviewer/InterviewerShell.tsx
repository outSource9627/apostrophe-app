import React, { useCallback, useEffect, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  type ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { BrandMark, text } from '../ui'
import { Icon } from '../ui/Icon'
import { EmFoot, EmIconButton, initialsOf } from '../employer/em'
import { tabBarInfoFor } from '../../navigation/tabConfig'
import { INTERVIEWER_KEY, useInterviewerIdentity, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/**
 * The frame every signed-in interviewer screen sits in (Interviewer App Android).
 *
 *   bar="brand"  Home (M1): the mark and wordmark, the initials disc (→ Account).
 *   title        a tab's own screen (M2): 20 title, a mono line under it, a right slot.
 *   back         a drill-in (M4): the 44 back arrow, a 17 title and a muted line.
 *
 * The suspension band sits under the bar with the server's own reason. A
 * 403 PASSWORD_CHANGE_REQUIRED sends the person to choose a password first. The
 * bottom tabs are the app's global bar (navigation/BottomTabBar), never drawn
 * here — the old shell drew a second one.
 */
export function InterviewerShell({
  bar, back, title, sub, right, footer, footerStack, children, scroll = true, scrollRef, contentGap = 'md',
  keyboardShouldPersistTaps = 'handled', bodyStyle, dark,
}: {
  bar?: 'brand' | 'none'
  back?: () => void
  title?: string
  sub?: string
  right?: React.ReactNode
  footer?: React.ReactNode
  footerStack?: boolean
  children: React.ReactNode
  scroll?: boolean
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>
  contentGap?: 'md' | 'lg' | 'sm'
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
  bodyStyle?: object
  dark?: boolean
}) {
  const insets = useSafeAreaInsets()
  const route = useRoute()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const { me, suspended, mustChangePassword } = useInterviewerMe()
  const identity = useInterviewerIdentity()

  useEffect(() => {
    if (mustChangePassword) navigation.reset({ index: 0, routes: [{ name: 'InterviewerPassword', params: { forced: true } }] })
  }, [mustChangePassword, navigation])

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
    } finally {
      setRefreshing(false)
    }
  }, [qc])

  const tabbed = !!tabBarInfoFor(route.name)
  const bottomPad = footer || tabbed ? 0 : insets.bottom
  const gap = contentGap === 'lg' ? space.lg : contentGap === 'sm' ? space.sm : space.md

  let header: React.ReactNode = null
  if (bar === 'brand') {
    header = (
      <View style={styles.brandBar}>
        <View style={styles.brand}>
          <BrandMark />
          <Text style={text.uiLeadSemi}>Apostrophe</Text>
        </View>
        {right ?? (
          <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => navigation.navigate('InterviewerAccount')} hitSlop={space.xs} style={({ pressed }) => [styles.disc, pressed && styles.pressed]}>
            <Text style={[text.uiSmSemi, styles.discText]}>{initialsOf(identity?.name)}</Text>
          </Pressable>
        )}
      </View>
    )
  } else if (back) {
    header = (
      <View style={styles.backBar}>
        <EmIconButton name="arrowL" label="Back" iconSize={height.glyph - 2} onPress={back} />
        <View style={styles.grow}>
          {!!title && <Text style={text.uiLgSemi} numberOfLines={1}>{title}</Text>}
          {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
        </View>
        {right}
      </View>
    )
  } else if (bar !== 'none' && (title || right)) {
    header = (
      <View style={styles.titleBar}>
        <View style={styles.grow}>
          {!!title && <Text style={text.displayCard} numberOfLines={1}>{title}</Text>}
          {!!sub && <Text style={[text.metaSm, styles.muted, styles.mono]} numberOfLines={1}>{sub}</Text>}
        </View>
        {right}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={[styles.page, dark && styles.pageDark, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {suspended && (
        <View style={styles.band} accessibilityRole="alert">
          <Icon name="alert" size={space.lg} tint={color.danger} weight={2} />
          <Text style={[text.uiXs, styles.bandText]}>
            <Text style={text.uiXsSemi}>Account suspended. </Text>
            {me?.statusReason ? `${me.statusReason} ` : ''}New interviews and withdrawals are paused; you can still submit owed scorecards.
          </Text>
        </View>
      )}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={[styles.body, { gap, paddingBottom: space.lg + bottomPad }, bodyStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.textSubtle} />}
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
  pageDark: { backgroundColor: color.inkDeep },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  mono: { letterSpacing: trackingNative.eyebrow },
  body: { paddingHorizontal: space.lg, paddingTop: spaceHalf['1.5'] },
  brandBar: { height: height['screen-header'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  disc: { width: height.chip + 4, height: height.chip + 4, borderRadius: radius.pill, backgroundColor: color.inkRaised, alignItems: 'center', justifyContent: 'center' },
  discText: { color: color.textInverse },
  titleBar: { minHeight: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.xl, paddingRight: space.lg },
  backBar: { minHeight: height['screen-header'] - space.xs, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.md - space.xs, paddingRight: space.md },
  band: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.lg, backgroundColor: color.dangerWash, borderBottomWidth: borderWidth.thin, borderBottomColor: color.dangerBorder },
  bandText: { flex: 1, color: color.danger },
})
