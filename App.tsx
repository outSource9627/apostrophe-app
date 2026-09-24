import React, { useState } from 'react'
import { StatusBar, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReceiptsScreen } from './src/screens/account/ReceiptsScreen'
import { openSupport } from './src/lib/support'
import { BottomTabBar } from './src/navigation/BottomTabBar'
import { WelcomeScreen } from './src/screens/WelcomeScreen'
import { CreateAccountScreen, type RegistrationData } from './src/screens/CreateAccountScreen'
import { VerifyMobileScreen } from './src/screens/VerifyMobileScreen'
import { HealthScreen } from './src/screens/HealthScreen'
import { SignInScreen } from './src/screens/SignInScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { ProfileWizardScreen } from './src/screens/ProfileWizardScreen'
import { VideosScreen } from './src/screens/VideosScreen'
import { BookInterviewScreen } from './src/screens/booking/BookInterviewScreen'
import { InterviewsScreen } from './src/screens/booking/InterviewsScreen'
import { InterviewDetailScreen } from './src/screens/booking/InterviewDetailScreen'
import { ConfirmedScreen } from './src/screens/booking/ConfirmedScreen'
import { RescheduleScreen } from './src/screens/booking/RescheduleScreen'
import { CancelScreen } from './src/screens/booking/CancelScreen'
import { PricingScreen } from './src/screens/paywall/PricingScreen'
import { CheckoutScreen } from './src/screens/paywall/CheckoutScreen'
import { ConfirmingScreen } from './src/screens/paywall/ConfirmingScreen'
import { PaymentFailedScreen } from './src/screens/paywall/PaymentFailedScreen'
import { VisibilityScreen } from './src/screens/profile/VisibilityScreen'
import { ProfileViewScreen } from './src/screens/profile/ProfileViewScreen'
import { JobFeedScreen } from './src/screens/jobs/JobFeedScreen'
import { JobDetailScreen } from './src/screens/jobs/JobDetailScreen'
import { ApplyScreen } from './src/screens/jobs/ApplyScreen'
import { SavedJobsScreen } from './src/screens/jobs/SavedJobsScreen'
import { ApplicationsScreen } from './src/screens/jobs/ApplicationsScreen'
import { InterestsScreen } from './src/screens/chat/InterestsScreen'
import { ConnectionsScreen } from './src/screens/chat/ConnectionsScreen'
import { ChatListScreen } from './src/screens/chat/ChatListScreen'
import { ThreadScreen } from './src/screens/chat/ThreadScreen'
import { NotificationsScreen } from './src/screens/account/NotificationsScreen'
import { NotificationSettingsScreen } from './src/screens/account/NotificationSettingsScreen'
import { StatsScreen } from './src/screens/account/StatsScreen'
import { AccountScreen } from './src/screens/account/AccountScreen'
import { DataRightsScreen } from './src/screens/account/DataRightsScreen'
import { ReadinessScreen } from './src/screens/room/ReadinessScreen'
import { RoomScreen } from './src/screens/room/RoomScreen'
import { EndedScreen } from './src/screens/room/EndedScreen'
import { FeedbackScreen } from './src/screens/room/FeedbackScreen'
import { TopUpScreen } from './src/screens/room/TopUpScreen'
import { EmployerRegisterScreen } from './src/screens/employer/EmployerRegisterScreen'
import { EmployerVerifyScreen } from './src/screens/employer/EmployerVerifyScreen'
import { EmployerSignInScreen } from './src/screens/employer/EmployerSignInScreen'
import { EmployerHomeScreen } from './src/screens/employer/EmployerHomeScreen'
import { EmployerDocumentsScreen } from './src/screens/employer/EmployerDocumentsScreen'
import { EmployerStatusScreen } from './src/screens/employer/EmployerStatusScreen'
import { EmployerCompanyScreen } from './src/screens/employer/EmployerCompanyScreen'
import { EmployerFeedScreen } from './src/screens/employer/EmployerFeedScreen'
import { CandidateProfileScreen } from './src/screens/employer/CandidateProfileScreen'
import { CandidateVideoScreen } from './src/screens/employer/CandidateVideoScreen'
import { FeedFiltersModal } from './src/screens/employer/FeedFiltersModal'
import { SavedSearchesModal } from './src/screens/employer/SavedSearchesModal'
import { EmployerShortlistScreen } from './src/screens/employer/EmployerShortlistScreen'
import { EmployerInterestsScreen } from './src/screens/employer/EmployerInterestsScreen'
import { ShortlistEntryModal } from './src/screens/employer/ShortlistEntryModal'
import { SendInterestModal } from './src/screens/employer/SendInterestModal'
import { EmployerJobsScreen } from './src/screens/employer/EmployerJobsScreen'
import { JobEditorScreen } from './src/screens/employer/JobEditorScreen'
import { JobDetailScreen as EmployerJobDetailScreen } from './src/screens/employer/JobDetailScreen'
import { JobApplicationsScreen } from './src/screens/employer/JobApplicationsScreen'
import { ApplicantDetailScreen } from './src/screens/employer/ApplicantDetailScreen'
import { EmployerConnectionsScreen } from './src/screens/employer/EmployerConnectionsScreen'
import { EmployerChatsScreen } from './src/screens/employer/EmployerChatsScreen'
import { EmployerThreadScreen } from './src/screens/employer/EmployerThreadScreen'
import { EmployerNotificationsScreen } from './src/screens/employer/EmployerNotificationsScreen'
import { EmployerNotificationSettingsScreen } from './src/screens/employer/EmployerNotificationSettingsScreen'
import { EmployerAccountScreen } from './src/screens/employer/EmployerAccountScreen'
import {
  JoinUsScreen,
  InterviewerApplyScreen,
  InterviewerSignInScreen,
  InterviewerPasswordScreen,
  InterviewerDashboardScreen,
  AvailabilityScreen,
  OverridesScreen,
  InterviewerInterviewsScreen,
  InterviewerDetailScreen,
  ScorecardDraftScreen,
  PendingScorecardsScreen,
  InterviewerWalletScreen,
  InterviewerLedgerScreen,
  WithdrawScreen,
  BankAccountScreen,
  StatementsScreen,
  InterviewerAccountScreen,
  InterviewerNotificationsScreen,
  InterviewerChatsScreen,
} from './src/screens/interviewer'
import type { ShortlistRow, EmployerJobRef } from './src/lib/api/employerShortlist'
import { threadIdForConnection } from './src/lib/api/chat'
import { getMe } from './src/lib/api/account'
import type { EmployerRegistrationDraft, RegisterOtpResult } from './src/lib/api/employer'

export type RootStackParamList = {
  Welcome: undefined
  CreateAccount: undefined
  VerifyMobile: {
    mobile: string
    purpose: 'REGISTER' | 'LOGIN'
    registrationData?: RegistrationData
    initialCooldown?: number
  }
  SignIn: undefined
  Home: undefined
  Profile: undefined
  Videos: undefined
  Visibility: undefined
  ProfileView: undefined
  JobFeed: undefined
  JobDetail: { id: string }
  JobApply: { id: string }
  SavedJobs: undefined
  Applications: undefined
  Pricing: undefined
  Checkout: undefined
  Confirming: { paymentId: string }
  PaymentFailed: { paymentId?: string; reason?: string | null }
  BookInterview: undefined
  Interviews: undefined
  InterviewDetail: { id: string }
  Confirmed: { id: string }
  Reschedule: { id: string }
  Cancel: { id: string }
  Readiness: { id: string }
  Room: { id: string }
  Ended: { id: string }
  Feedback: { id: string }
  TopUp: { id: string }
  Interests: undefined
  Connections: undefined
  Chats: undefined
  Thread: { id: string }
  Notifications: undefined
  NotificationSettings: undefined
  Stats: undefined
  Account: undefined
  DataRights: undefined
  Health: undefined
  Receipts: undefined

  // ── Employer onboarding and verification (EM-02..EM-07) ────────────────────
  EmployerRegister: undefined
  /**
   * The EM-02 form travels here IN MEMORY — it carries the password. Nothing
   * persists navigation state in this app, and the verify screen resets the
   * stack once the account exists, which drops these params. Do not enable
   * state persistence without excluding this route.
   */
  EmployerVerify: { registration: EmployerRegistrationDraft; sent?: RegisterOtpResult; sentAt?: number }
  EmployerSignIn: undefined
  EmployerHome: undefined
  EmployerDocuments: { focus?: 'COMPANY_PROOF' | 'PHOTO_ID' | 'REQUESTED' } | undefined
  EmployerStatus: undefined
  EmployerCompany: undefined
  EmployerFeed: undefined
  CandidateProfile: { id: string }
  CandidateVideo: { id: string }
  FeedFilters: undefined
  SavedSearches: undefined
  EmployerShortlist: undefined
  EmployerInterests: undefined
  ShortlistEntry: { row: ShortlistRow; jobs: EmployerJobRef[] }
  SendInterest: {
    candidateId: string
    candidateName: string
    candidateHeadline?: string | null
    candidateCity?: string | null
    jobs?: EmployerJobRef[]
  }
  EmployerJobs: undefined
  JobEditor: undefined
  EmployerJobDetail: { id: string }
  JobApplications: { id: string }
  ApplicantDetail: { id: string }
  EmployerConnections: undefined
  EmployerChats: undefined
  EmployerThread: { id: string }
  EmployerNotifications: undefined
  EmployerNotificationSettings: undefined
  EmployerAccount: undefined

  // ── Interviewer portal & recruitment (IV-01..IV-22) ────────────────────────
  JoinUs: undefined
  InterviewerApply: undefined
  InterviewerSignIn: undefined
  InterviewerPassword: { email?: string; forced?: boolean; reset?: boolean } | undefined
  InterviewerDashboard: undefined
  InterviewerAvailability: undefined
  InterviewerOverrides: undefined
  InterviewerInterviews: undefined
  InterviewerDetail: { id: string; autoJoin?: boolean }
  ScorecardDraft: { id: string }
  PendingScorecards: undefined
  InterviewerWallet: undefined
  InterviewerLedger: undefined
  InterviewerWithdraw: undefined
  InterviewerBankAccount: undefined
  InterviewerStatements: undefined
  InterviewerAccount: undefined
  InterviewerNotifications: undefined
  InterviewerChats: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Where a signed-in account lands. Mobile OTP and email sign-in are shared by
 * every role, so the role is read back rather than assumed: an employer goes to
 * the employer shell, an interviewer goes to the interviewer portal, everyone
 * else to the student home. Any role state cached under a previous session is dropped first.
 */
async function signedInHome(): Promise<'Home' | 'EmployerHome' | 'InterviewerDashboard'> {
  const me = await getMe().catch(() => null)
  if (me?.role === 'EMPLOYER') {
    queryClient.removeQueries({ queryKey: ['employer'] })
    return 'EmployerHome'
  }
  if (me?.role === 'INTERVIEWER') {
    queryClient.removeQueries({ queryKey: ['interviewer'] })
    return 'InterviewerDashboard'
  }
  return 'Home'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // The student persona is on a mid-range Android and a variable network:
      // refetching on every focus burns data they are paying for.
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  // The tab bar sits beside the stack, outside any navigator, so it cannot use
  // navigation hooks — it reads the current route from the container instead.
  const navRef = useNavigationContainerRef<RootStackParamList>()
  const [routeName, setRouteName] = useState<string | undefined>()
  const syncRoute = () => setRouteName(navRef.getCurrentRoute()?.name)

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Light-only for now; the brand ground is paper white. RN 0.87 removed
            StatusBar's backgroundColor prop, so the Android bar colour belongs
            in styles.xml rather than here. */}
        <StatusBar barStyle="dark-content" />
        <NavigationContainer ref={navRef} onReady={syncRoute} onStateChange={syncRoute}>
        <View style={styles.appShell}>
        <View style={styles.stackArea}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Welcome">
              {({ navigation }) => (
                <WelcomeScreen
                  onGetHired={() => navigation.navigate('CreateAccount')}
                  onWantToHire={() => navigation.navigate('EmployerRegister')}
                  onCreateEmployer={() => navigation.navigate('EmployerRegister')}
                  onSignIn={() => navigation.navigate('SignIn')}
                  onJoinUs={() => navigation.navigate('JoinUs')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="CreateAccount">
              {({ navigation }) => (
                <CreateAccountScreen
                  onSignIn={() => navigation.navigate('SignIn')}
                  onOtpSent={({ form, resendAfterSeconds }) =>
                    navigation.navigate('VerifyMobile', {
                      mobile: form.mobile,
                      purpose: 'REGISTER',
                      registrationData: form,
                      initialCooldown: resendAfterSeconds,
                    })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="VerifyMobile">
              {({ navigation, route }) => (
                <VerifyMobileScreen
                  mobile={route.params.mobile}
                  purpose={route.params.purpose}
                  registrationData={route.params.registrationData}
                  initialCooldown={route.params.initialCooldown}
                  onBack={() => navigation.goBack()}
                  onVerified={async () =>
                    navigation.replace(route.params.purpose === 'LOGIN' ? await signedInHome() : 'Home')
                  }
                  onSignIn={() => navigation.navigate('SignIn')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="SignIn">
              {({ navigation }) => (
                <SignInScreen
                  onSignedIn={async () => navigation.replace(await signedInHome())}
                  onRegister={() => navigation.navigate('CreateAccount')}
                  onOtpSent={({ mobile, resendAfterSeconds }) =>
                    navigation.navigate('VerifyMobile', {
                      mobile,
                      purpose: 'LOGIN',
                      initialCooldown: resendAfterSeconds,
                    })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Home">
              {({ navigation }) => (
                <HomeScreen
                  onPay={() => navigation.navigate('Pricing')}
                  onBook={() => navigation.navigate('BookInterview')}
                  onJoin={(id) => navigation.navigate('Readiness', { id })}
                  onReschedule={(id) => navigation.navigate('Reschedule', { id })}
                  onFeedback={(id) => navigation.navigate('Feedback', { id })}
                  onSupport={() => { void openSupport() }}
                  onAccount={() => navigation.navigate('Account')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Profile">
              {({ navigation }) => (
                <ProfileWizardScreen
                  onExit={() => navigation.goBack()}
                  onBook={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Videos">
              {({ navigation }) => <VideosScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="JobFeed">
              {({ navigation }) => (
                <JobFeedScreen
                  onBack={() => navigation.goBack()}
                  onOpen={(id) => navigation.navigate('JobDetail', { id })}
                  onSaved={() => navigation.navigate('SavedJobs')}
                  onApplied={() => navigation.navigate('Applications')}
                  onApply={(id) => navigation.navigate('JobApply', { id })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="JobDetail">
              {({ navigation, route }) => (
                <JobDetailScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onApply={(id) => navigation.navigate('JobApply', { id })}
                  onApplications={() => navigation.navigate('Applications')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="JobApply">
              {({ navigation, route }) => (
                <ApplyScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onApplications={() => navigation.navigate('Applications')}
                  onBook={() => navigation.navigate('BookInterview')}
                  onFeed={() => navigation.navigate('JobFeed')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="SavedJobs">
              {({ navigation }) => (
                <SavedJobsScreen
                  onBack={() => navigation.goBack()}
                  onOpen={(id) => navigation.navigate('JobDetail', { id })}
                  onApply={(id) => navigation.navigate('JobApply', { id })}
                  onFeed={() => navigation.navigate('JobFeed')}
                  onApplied={() => navigation.navigate('Applications')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Applications">
              {({ navigation }) => (
                <ApplicationsScreen
                  onBack={() => navigation.goBack()}
                  onFeed={() => navigation.navigate('JobFeed')}
                  onSaved={() => navigation.navigate('SavedJobs')}
                  onChat={async (connectionId) => {
                    const t = await threadIdForConnection(connectionId)
                    if (t) navigation.navigate('Thread', { id: t })
                    else navigation.navigate('Chats')
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Pricing">
              {({ navigation }) => (
                <PricingScreen
                  onBack={() => navigation.goBack()}
                  onPay={() => navigation.navigate('Checkout')}
                  onBook={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Checkout">
              {({ navigation }) => (
                <CheckoutScreen
                  onBack={() => navigation.goBack()}
                  onConfirming={(paymentId) => navigation.replace('Confirming', { paymentId })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Confirming">
              {({ navigation, route }) => (
                <ConfirmingScreen
                  paymentId={route.params.paymentId}
                  onDone={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
                  onFailed={(paymentId, reason) => navigation.replace('PaymentFailed', { paymentId, reason })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="PaymentFailed">
              {({ navigation, route }) => (
                <PaymentFailedScreen
                  reason={route.params.reason ?? null}
                  onConfirming={(paymentId) => navigation.replace('Confirming', { paymentId })}
                  onPricing={() => navigation.navigate('Pricing')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Interviews">
              {({ navigation }) => (
                <InterviewsScreen
                  onBack={() => navigation.goBack()}
                  onOpen={(id) => navigation.navigate('InterviewDetail', { id })}
                  onBook={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="BookInterview">
              {({ navigation }) => (
                <BookInterviewScreen
                  onBack={() => navigation.goBack()}
                  onBooked={(id) => navigation.replace('Confirmed', { id })}
                  onFinishProfile={() => navigation.navigate('Profile')}
                  onBuy={() => navigation.navigate('Pricing')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Confirmed">
              {({ navigation, route }) => (
                <ConfirmedScreen
                  id={route.params.id}
                  onDeviceCheck={(id) => navigation.replace('InterviewDetail', { id })}
                  onDone={() => navigation.navigate('Interviews')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="InterviewDetail">
              {({ navigation, route }) => (
                <InterviewDetailScreen
                  id={route.params.id}
                  onBack={() => navigation.navigate('Interviews')}
                  onReschedule={(id) => navigation.navigate('Reschedule', { id })}
                  onCancel={(id) => navigation.navigate('Cancel', { id })}
                  onSupport={() => { void openSupport() }}
                  onBook={() => navigation.navigate('BookInterview')}
                  onJoin={() => navigation.navigate('Readiness', { id: route.params.id })}
                  onFeedback={() => navigation.navigate('Feedback', { id: route.params.id })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Reschedule">
              {({ navigation, route }) => (
                <RescheduleScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onMoved={(newId) => navigation.replace('Confirmed', { id: newId })}
                  onSupport={() => { void openSupport() }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Cancel">
              {({ navigation, route }) => (
                <CancelScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onKeep={() => navigation.goBack()}
                  onReschedule={(id) => navigation.replace('Reschedule', { id })}
                  onBooked={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="ProfileView">
              {({ navigation }) => (
                <ProfileViewScreen
                  onBack={() => navigation.goBack()}
                  onBook={() => navigation.navigate('BookInterview')}
                  onVisibility={() => navigation.navigate('Visibility')}
                  onVideos={() => navigation.navigate('Videos')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Visibility">
              {({ navigation }) => (
                <VisibilityScreen
                  onBack={() => navigation.goBack()}
                  onBook={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Interests">
              {({ navigation }) => (
                <InterestsScreen
                  onBack={() => navigation.goBack()}
                  onConnections={() => navigation.navigate('Connections')}
                  onVideoResume={() => navigation.navigate('ProfileView')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Connections">
              {({ navigation }) => (
                <ConnectionsScreen
                  onBack={() => navigation.goBack()}
                  onChats={() => navigation.navigate('Chats')}
                  onOpenThread={(id) => navigation.navigate('Thread', { id })}
                  onBrowseJobs={() => navigation.navigate('JobFeed')}
                  onInterests={() => navigation.navigate('Interests')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Chats">
              {({ navigation }) => (
                <ChatListScreen
                  onBack={() => navigation.goBack()}
                  onInterests={() => navigation.navigate('Interests')}
                  onOpenThread={(id) => navigation.navigate('Thread', { id })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Thread">
              {({ navigation, route }) => (
                <ThreadScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onSupport={() => navigation.navigate('Chats')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Readiness">
              {({ navigation, route }) => (
                <ReadinessScreen id={route.params.id} onBack={() => navigation.goBack()} onJoin={() => navigation.navigate('Room', { id: route.params.id })} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Room" options={{ gestureEnabled: false }}>
              {({ navigation, route }) => (
                <RoomScreen id={route.params.id} onBack={() => navigation.goBack()} onEnded={() => navigation.replace('Ended', { id: route.params.id })} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Ended">
              {({ navigation, route }) => (
                <EndedScreen id={route.params.id} onBack={() => navigation.navigate('Interviews')} onBook={() => navigation.navigate('BookInterview')} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Feedback">
              {({ navigation, route }) => (
                <FeedbackScreen id={route.params.id} onBack={() => navigation.navigate('Interviews')} />
              )}
            </Stack.Screen>

            <Stack.Screen name="TopUp">
              {({ navigation, route }) => (
                <TopUpScreen id={route.params.id} onBack={() => navigation.navigate('Interviews')} onPay={() => navigation.navigate('Pricing')} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Notifications">
              {({ navigation }) => (
                <NotificationsScreen
                  onBack={() => navigation.goBack()}
                  onNavigate={(screen, params) => navigation.navigate(screen as never, params as never)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="NotificationSettings">
              {({ navigation }) => <NotificationSettingsScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="Stats">
              {({ navigation }) => (
                <StatsScreen
                  onBack={() => navigation.goBack()}
                  onVideoResume={() => navigation.navigate('ProfileView')}
                  onVisibility={() => navigation.navigate('Visibility')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Account">
              {({ navigation }) => (
                <AccountScreen
                  onBack={() => navigation.goBack()}
                  onSignedOut={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}
                  onReceipts={() => navigation.navigate('Receipts')}
                  onVisibility={() => navigation.navigate('Visibility')}
                  onNotificationSettings={() => navigation.navigate('NotificationSettings')}
                  onData={() => navigation.navigate('DataRights')}
                  onProfile={() => navigation.navigate('Profile')}
                  onProfileView={() => navigation.navigate('ProfileView')}
                  onVideos={() => navigation.navigate('Videos')}
                  onApplications={() => navigation.navigate('Applications')}
                  onConnections={() => navigation.navigate('Connections')}
                  onNotifications={() => navigation.navigate('Notifications')}
                  onStats={() => navigation.navigate('Stats')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="DataRights">
              {({ navigation }) => <DataRightsScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="Receipts">
              {({ navigation }) => <ReceiptsScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="Health" component={HealthScreen} options={{ headerShown: true, title: '' }} />

            {/* ── Employer onboarding and verification ─────────────────────── */}
            <Stack.Screen name="EmployerRegister">
              {({ navigation }) => (
                <EmployerRegisterScreen
                  onBack={() => navigation.goBack()}
                  onSignIn={() => navigation.navigate('EmployerSignIn')}
                  onCodesSent={({ registration, sent }) =>
                    navigation.navigate('EmployerVerify', { registration, sent, sentAt: Date.now() })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerVerify">
              {({ navigation, route }) => (
                <EmployerVerifyScreen
                  registration={route.params.registration}
                  sent={route.params.sent}
                  sentAt={route.params.sentAt}
                  onEdit={() => navigation.goBack()}
                  // A reset, not a push: the stack loses the params holding the password.
                  onRegistered={() => navigation.reset({ index: 0, routes: [{ name: 'EmployerHome' }] })}
                  onSignIn={() => navigation.navigate('EmployerSignIn')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerSignIn">
              {({ navigation }) => (
                <EmployerSignInScreen
                  onBack={() => navigation.goBack()}
                  onRegister={() => navigation.navigate('EmployerRegister')}
                  onSignedIn={(role) =>
                    navigation.reset({ index: 0, routes: [{ name: role === 'EMPLOYER' ? 'EmployerHome' : 'Home' }] })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerHome">
              {({ navigation }) => (
                <EmployerHomeScreen
                  onDocuments={(focus) => navigation.navigate('EmployerDocuments', { focus })}
                  onStatus={() => navigation.navigate('EmployerStatus')}
                  onCompany={() => navigation.navigate('EmployerCompany')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerDocuments">
              {({ navigation, route }) => (
                <EmployerDocumentsScreen
                  focus={route.params?.focus}
                  onBack={() => navigation.goBack()}
                  // Back to the EM-06 a Resubmit opened this from, else in this screen's place.
                  onSubmitted={() => navigation.popTo('EmployerStatus')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerStatus">
              {({ navigation }) => (
                <EmployerStatusScreen
                  onBack={() => navigation.goBack()}
                  onResubmit={(focus) => navigation.navigate('EmployerDocuments', { focus })}
                  onFeed={() => navigation.reset({ index: 0, routes: [{ name: 'EmployerFeed' }] })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="EmployerCompany">
              {({ navigation }) => <EmployerCompanyScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="EmployerFeed">
              {() => <EmployerFeedScreen />}
            </Stack.Screen>

            <Stack.Screen name="CandidateProfile">
              {() => <CandidateProfileScreen />}
            </Stack.Screen>

            <Stack.Screen name="CandidateVideo">
              {() => <CandidateVideoScreen />}
            </Stack.Screen>

            <Stack.Screen name="FeedFilters">
              {() => <FeedFiltersModal />}
            </Stack.Screen>

            <Stack.Screen name="SavedSearches">
              {() => <SavedSearchesModal />}
            </Stack.Screen>

            <Stack.Screen name="EmployerShortlist">
              {() => <EmployerShortlistScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerInterests">
              {() => <EmployerInterestsScreen />}
            </Stack.Screen>

            <Stack.Screen name="ShortlistEntry">
              {() => <ShortlistEntryModal />}
            </Stack.Screen>

            <Stack.Screen name="SendInterest">
              {() => <SendInterestModal />}
            </Stack.Screen>

            <Stack.Screen name="EmployerJobs">
              {() => <EmployerJobsScreen />}
            </Stack.Screen>

            <Stack.Screen name="JobEditor">
              {() => <JobEditorScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerJobDetail">
              {() => <EmployerJobDetailScreen />}
            </Stack.Screen>

            <Stack.Screen name="JobApplications">
              {() => <JobApplicationsScreen />}
            </Stack.Screen>

            <Stack.Screen name="ApplicantDetail">
              {() => <ApplicantDetailScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerConnections">
              {() => <EmployerConnectionsScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerChats">
              {() => <EmployerChatsScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerThread">
              {() => <EmployerThreadScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerNotifications">
              {() => <EmployerNotificationsScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerNotificationSettings">
              {() => <EmployerNotificationSettingsScreen />}
            </Stack.Screen>

            <Stack.Screen name="EmployerAccount">
              {() => <EmployerAccountScreen />}
            </Stack.Screen>

            {/* ── Interviewer Portal & Recruitment (IV-01..IV-22) ────────────────── */}
            <Stack.Screen name="JoinUs">
              {() => <JoinUsScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerApply">
              {() => <InterviewerApplyScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerSignIn">
              {() => <InterviewerSignInScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerPassword">
              {() => <InterviewerPasswordScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerDashboard">
              {() => <InterviewerDashboardScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerAvailability">
              {() => <AvailabilityScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerOverrides">
              {() => <OverridesScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerInterviews">
              {() => <InterviewerInterviewsScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerDetail">
              {() => <InterviewerDetailScreen />}
            </Stack.Screen>

            <Stack.Screen name="ScorecardDraft">
              {() => <ScorecardDraftScreen />}
            </Stack.Screen>

            <Stack.Screen name="PendingScorecards">
              {() => <PendingScorecardsScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerWallet">
              {() => <InterviewerWalletScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerLedger">
              {() => <InterviewerLedgerScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerWithdraw">
              {() => <WithdrawScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerBankAccount">
              {() => <BankAccountScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerStatements">
              {() => <StatementsScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerAccount">
              {() => <InterviewerAccountScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerNotifications">
              {() => <InterviewerNotificationsScreen />}
            </Stack.Screen>

            <Stack.Screen name="InterviewerChats">
              {() => <InterviewerChatsScreen />}
            </Stack.Screen>
          </Stack.Navigator>
        </View>
        <BottomTabBar
          routeName={routeName}
          onNavigate={(root) => { if (navRef.isReady()) navRef.navigate(root as never) }}
        />
        </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  appShell: { flex: 1 },
  stackArea: { flex: 1 },
})
