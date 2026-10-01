import { Platform } from 'react-native'

/**
 * React Native me .env file by default kaam nahi karti — na process.env hota hai
 * na dotenv. Isliye config yahan constants ke roop me hai.
 *
 * Phase 14 (release builds) me `react-native-config` add hoga taaki dev/staging/
 * prod alag ho sakein. Tab tak yahin edit karo.
 *
 * Yahan kabhi koi SECRET mat daalna — app bundle decompile ho sakta hai.
 * Agora certificate, Razorpay secret, AWS keys — sab sirf server pe.
 */

// 10.0.2.2 points to host Mac from the Android emulator, localhost for iOS simulator.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
const DEV_API = `http://${DEV_HOST}:3000`

export const API_BASE_URL = DEV_API + '/api/v1'
export const SOCKET_URL = `http://${DEV_HOST}:4001`

// --- payments -------------------------------------------------- [P2] TODO
// Razorpay key id public hai. Secret NAHI.
export const RAZORPAY_KEY_ID = ''

// --- video ------------------------------------------------------ [P6] TODO
// Agora App ID public hai. Certificate NAHI — server token mint karega.
export const AGORA_APP_ID = ''

// --- auth -------------------------------------------------------- [P1] TODO
export const GOOGLE_WEB_CLIENT_ID = ''

// --- observability ----------------------------------------------- [P0] TODO
export const SENTRY_DSN = ''

/**
 * Push notifications (P11) aur Google sign-in ke liye ye env var nahi, FILES
 * chahiye — Firebase console se download karke yahan rakhna:
 *   android/app/google-services.json
 *   ios/GoogleService-Info.plist
 * Dono gitignored hone chahiye.
 */
