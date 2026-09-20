import React, { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, opacity, space } from '../../theme'
import { Eyebrow } from '../ui'
import { Logo } from '../Logo'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { InterviewerNav, type InterviewerNavKey } from './InterviewerNav'

export function InterviewerShell({
  back,
  title,
  navTab,
  footer,
  children,
  scroll = true,
  scrollRef,
  contentGap = 'lg',
  keyboardShouldPersistTaps = 'handled',
  rightAction,
}: {
  /** A drill-down screen: the label, and the press action. */
  back?: { label: string; onPress: () => void }
  /** Optional custom title in header */
  title?: string
  /** Current active bottom nav tab. If omitted, bottom nav is not rendered. */
  navTab?: InterviewerNavKey
  /** Pinned action at bottom above safe area / bottom nav */
  footer?: React.ReactNode
  children: React.ReactNode
  scroll?: boolean
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>
  contentGap?: 'lg' | 'sm'
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
  rightAction?: React.ReactNode
}) {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, owedScorecards, unreadNotifications, refresh } = useInterviewer()

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const isSuspended = profile?.status === 'SUSPENDED'

  const handleNavSelect = (key: InterviewerNavKey) => {
    switch (key) {
      case 'home':
        navigation.navigate('InterviewerDashboard')
        break
      case 'interviews':
        navigation.navigate('InterviewerInterviews')
        break
      case 'availability':
        navigation.navigate('InterviewerAvailability')
        break
      case 'wallet':
        navigation.navigate('InterviewerWallet')
        break
      case 'account':
        navigation.navigate('InterviewerAccount')
        break
    }
  }

  const gap = contentGap === 'lg' ? space['2xl'] : space.lg
  const bottomPad = footer || navTab ? space.md : insets.bottom

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* App Bar */}
      <View style={styles.bar}>
        {back ? (
          <View style={styles.backRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Back to ${back.label.toLowerCase()}`}
              onPress={back.onPress}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <Eyebrow>{back.label}</Eyebrow>
          </View>
        ) : (
          <View style={styles.logoRow}>
            <Logo size={18} />
            <Text style={styles.headerTag}>INTERVIEWER</Text>
          </View>
        )}

        {title && !back ? <Text style={styles.headerTitle}>{title}</Text> : null}

        <View style={styles.grow} />

        {rightAction ? (
          rightAction
        ) : !back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('InterviewerNotifications')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Suspension Alert Banner (Settled Decision D4/D5) */}
      {isSuspended && (
        <View style={styles.suspensionBanner}>
          <Text style={styles.suspensionIcon}>⚠️</Text>
          <View style={styles.suspensionContent}>
            <Text style={styles.suspensionTitle}>Account Suspended</Text>
            <Text style={styles.suspensionBody}>
              Conducting interviews and withdrawals are locked. You may still complete owed scorecards and view your ledger.
            </Text>
          </View>
        </View>
      )}

      {/* Main Body */}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={[
            styles.body,
            { gap, paddingBottom: space['2xl'] + bottomPad },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.textSubtle}
            />
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.grow}>{children}</View>
      )}

      {/* Sticky Footer */}
      {!!footer && (
        <View style={[styles.footer, { paddingBottom: navTab ? space.sm : space.lg + insets.bottom }]}>
          {footer}
        </View>
      )}

      {/* Bottom Navigation */}
      {navTab && (
        <InterviewerNav
          current={navTab}
          onSelect={handleNavSelect}
          badges={{
            interviews: owedScorecards.length > 0 ? owedScorecards.length : undefined,
          }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  backBtn: {
    width: height.tap,
    height: height.tap,
    marginLeft: -space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: color.text,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  headerTag: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '700',
    color: color.accent,
    letterSpacing: 1,
    paddingHorizontal: space['2xs'],
    paddingVertical: 2,
    backgroundColor: color.accentSubtle,
    borderRadius: 3,
  },
  headerTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '600',
    color: color.text,
    marginLeft: space.sm,
  },
  iconBtn: {
    width: height.tap,
    height: height.tap,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: color.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    fontWeight: '700',
    color: color.surface,
  },
  suspensionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    backgroundColor: '#fffbeb',
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: '#fde68a',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  suspensionIcon: {
    fontSize: 16,
  },
  suspensionContent: {
    flex: 1,
  },
  suspensionTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2,
  },
  suspensionBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#b45309',
    lineHeight: 16,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  footer: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
  },
})
