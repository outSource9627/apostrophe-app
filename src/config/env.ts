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

// Live backend: nginx serves the Next.js API and proxies the realtime socket (/socket)
// on the same HTTPS host. For a local backend use `http://<LAN IP>:3000` here and
// `http://<LAN IP>:4001` for SOCKET_URL (10.0.2.2 is the host Mac from the emulator).
const BACKEND_URL = 'https://apostrophe.verdicto.co.in'

export const API_BASE_URL = BACKEND_URL + '/api/v1'
export const SOCKET_URL = BACKEND_URL
/** The web host (public /terms and /privacy pages), same host as the API. */
export const WEB_BASE_URL = BACKEND_URL

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
