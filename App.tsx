import React from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import { threadIdForConnection } from './src/lib/api/chat'

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
}

const Stack = createNativeStackNavigator<RootStackParamList>()

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
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Light-only for now; the brand ground is paper white. RN 0.87 removed
            StatusBar's backgroundColor prop, so the Android bar colour belongs
            in styles.xml rather than here. */}
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Welcome">
              {({ navigation }) => (
                <WelcomeScreen
                  onGetHired={() => navigation.navigate('CreateAccount')}
                  // The employer app is Phase 8; for now it goes to sign in.
                  onWantToHire={() => navigation.navigate('SignIn')}
                  onSignIn={() => navigation.navigate('SignIn')}
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
                  onVerified={() => navigation.replace('Home')}
                  onSignIn={() => navigation.navigate('SignIn')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="SignIn">
              {({ navigation }) => (
                <SignInScreen
                  onSignedIn={() => navigation.replace('Home')}
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
                  onProfile={() => navigation.navigate('Profile')}
                  onInterviews={() => navigation.navigate('Interviews')}
                  onVisibility={() => navigation.navigate('Visibility')}
                  onProfileView={() => navigation.navigate('ProfileView')}
                  onJobs={() => navigation.navigate('JobFeed')}
                  onApplications={() => navigation.navigate('Applications')}
                  onInterests={() => navigation.navigate('Interests')}
                  onConnections={() => navigation.navigate('Connections')}
                  onChats={() => navigation.navigate('Chats')}
                  onNotifications={() => navigation.navigate('Notifications')}
                  onStats={() => navigation.navigate('Stats')}
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
              {({ navigation }) => <VideosScreen onRecord={() => navigation.navigate('Health')} />}
            </Stack.Screen>

            <Stack.Screen name="JobFeed">
              {({ navigation }) => (
                <JobFeedScreen
                  onBack={() => navigation.goBack()}
                  onOpen={(id) => navigation.navigate('JobDetail', { id })}
                  onSaved={() => navigation.navigate('SavedJobs')}
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
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Applications">
              {({ navigation }) => (
                <ApplicationsScreen
                  onBack={() => navigation.goBack()}
                  onFeed={() => navigation.navigate('JobFeed')}
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
                  onBuy={() => navigation.navigate('Home')}
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
                  onSupport={() => navigation.navigate('Health')}
                  onBook={() => navigation.navigate('BookInterview')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Reschedule">
              {({ navigation, route }) => (
                <RescheduleScreen
                  id={route.params.id}
                  onBack={() => navigation.goBack()}
                  onMoved={(newId) => navigation.replace('Confirmed', { id: newId })}
                  onSupport={() => navigation.navigate('Health')}
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
                  onReceipts={() => navigation.navigate('Health')}
                  onVisibility={() => navigation.navigate('Visibility')}
                  onNotificationSettings={() => navigation.navigate('NotificationSettings')}
                  onData={() => navigation.navigate('DataRights')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="DataRights">
              {({ navigation }) => <DataRightsScreen onBack={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="Health" component={HealthScreen} options={{ headerShown: true, title: '' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
