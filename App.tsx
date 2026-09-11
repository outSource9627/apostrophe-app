import React from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WelcomeScreen } from './src/screens/WelcomeScreen'
import { HealthScreen } from './src/screens/HealthScreen'
import { SignInScreen } from './src/screens/SignInScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { ProfileWizardScreen } from './src/screens/ProfileWizardScreen'
import { VideosScreen } from './src/screens/VideosScreen'

export type RootStackParamList = {
  Welcome: undefined
  SignIn: undefined
  Home: undefined
  Profile: undefined
  Videos: undefined
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
                  onGetHired={() => navigation.navigate('SignIn')}
                  // The employer app is Phase 8; for now it goes the same way.
                  onWantToHire={() => navigation.navigate('SignIn')}
                  onSignIn={() => navigation.navigate('SignIn')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="SignIn">
              {({ navigation }) => (
                <SignInScreen
                  // replace, not navigate: signing in is not a step to go back from.
                  onSignedIn={() => navigation.replace('Home')}
                  onRegister={() => navigation.navigate('SignIn')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Home">
              {({ navigation }) => (
                <HomeScreen
                  // ST-22 — payment happens in the gateway's own checkout, which
                  // Phase 2's mobile leg wires up; this is where it hangs off.
                  onPay={() => navigation.navigate('Health')}
                  onProfile={() => navigation.navigate('Profile')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Profile">
              {({ navigation }) => <ProfileWizardScreen onExit={() => navigation.goBack()} />}
            </Stack.Screen>

            <Stack.Screen name="Videos">
              {({ navigation }) => <VideosScreen onRecord={() => navigation.navigate('Health')} />}
            </Stack.Screen>

            <Stack.Screen name="Health" component={HealthScreen} options={{ headerShown: true, title: '' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
