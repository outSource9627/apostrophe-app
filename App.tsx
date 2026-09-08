import React from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WelcomeScreen } from './src/screens/WelcomeScreen'
import { HealthScreen } from './src/screens/HealthScreen'

export type RootStackParamList = {
  Welcome: undefined
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
                  // Phase 2 replaces these with the real registration flow.
                  onGetHired={() => navigation.navigate('Health')}
                  onWantToHire={() => navigation.navigate('Health')}
                  onSignIn={() => navigation.navigate('Health')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Health" component={HealthScreen} options={{ headerShown: true, title: '' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
