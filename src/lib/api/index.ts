import { ApiClient } from './client'
import { KeychainTokenStore } from './tokens'
import { API_BASE_URL } from '../../config/env'

export const tokenStore = new KeychainTokenStore()

export const api = new ApiClient({
  baseUrl: API_BASE_URL,
  tokens: tokenStore,
  onSignedOut: () => {
    // Phase 1 wires this to the auth store and bounces to the sign-in screen.
  },
})

export * from './types'
export { API_BASE_URL }
