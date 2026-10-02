import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { A, AButton, AuthSub, AuthTitle, AuthTop, BottomBar, Link, Note, NoteStrong, Swap } from '../components/auth/kit'
import { Icon, type IconName } from '../components/ui/Icon'
import { borderWidth, color, fontFamilyNative, opacity } from '../theme'

type Kind = 'CANDIDATE' | 'EMPLOYER'

type Props = {
  onBack: () => void
  /** Candidate → the candidate form; hiring → the employer form. */
  onContinue: (kind: Kind) => void
  onSignIn: () => void
  /** Interviewers have no self-signup — this opens the "Join us as HR" application. */
  onJoinUs: () => void
}

const OPTIONS: { kind: Kind; icon: IconName; title: string; body: string }[] = [
  { kind: 'CANDIDATE', icon: 'users', title: 'I’m a candidate', body: 'Get interviewed and hired' },
  { kind: 'EMPLOYER', icon: 'brief', title: 'I’m hiring', body: 'Browse verified video resumes' },
]

/**
 * The single way into "Create account". It only decides which form follows —
 * the candidate and employer registrations keep their own flows and APIs.
 * Interviewers cannot sign up here; their way in is the HR application below.
 */
export function GetStartedScreen({ onBack, onContinue, onSignIn, onJoinUs }: Props) {
  const insets = useSafeAreaInsets()
  const [kind, setKind] = useState<Kind>('CANDIDATE')

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AuthTop onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.gap} />
        <AuthTitle>How will you{'\n'}use Apostrophe?</AuthTitle>
        <AuthSub>Pick one. You can log in with another account any time.</AuthSub>

        <View style={styles.options}>
          {OPTIONS.map((o) => {
            const on = o.kind === kind
            return (
              <Pressable
                key={o.kind}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setKind(o.kind)}
                style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}
              >
                <View style={styles.icon}>
                  <Icon name={o.icon} size={22} tint={color.accent} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.cardTitle}>{o.title}</Text>
                  <Text style={styles.cardBody}>{o.body}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
              </Pressable>
            )
          })}
        </View>

        <Note>
          <NoteStrong>Want to interview talent?</NoteStrong> Interviewer accounts are created by our team after a short
          review. <Link onPress={onJoinUs}>Join us as HR</Link>
        </Note>
      </ScrollView>

      <BottomBar insetBottom={insets.bottom + 14}>
        <AButton
          label={kind === 'CANDIDATE' ? 'Create candidate account' : 'Create employer account'}
          onPress={() => onContinue(kind)}
        />
        <Swap lead="Already have an account?" action="Log in" onPress={onSignIn} />
      </BottomBar>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  scroll: { paddingHorizontal: A.gutter, paddingBottom: 24 },
  gap: { height: 12 },
  pressed: { opacity: opacity.pressed },

  options: { marginTop: 22, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.border,
  },
  cardOn: { borderColor: color.accent, backgroundColor: color.accentWash },
  icon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: color.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1 },
  cardTitle: { fontFamily: fontFamilyNative.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  cardBody: { fontFamily: fontFamilyNative.body, fontSize: 14, lineHeight: 19, color: color.textMuted, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: borderWidth.accent, borderColor: color.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: color.accent, backgroundColor: color.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.textInverse },
})
