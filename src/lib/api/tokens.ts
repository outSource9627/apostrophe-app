import * as Keychain from 'react-native-keychain'
import type { TokenStore, Tokens } from './types.tokens'

/**
 * React Native token storage.
 *
 * Refresh tokens go to the Keychain / EncryptedSharedPreferences rather than
 * AsyncStorage: AsyncStorage is plain text on disk and readable on a rooted or
 * jailbroken device. The access token stays in memory only — it lives 30 minutes
 * (ST-07) and there is no reason to persist it.
 */
const SERVICE = 'work.apostrophe.tokens'

export class KeychainTokenStore implements TokenStore {
  private access: string | null = null

  async get(): Promise<Tokens | null> {
    const creds = await Keychain.getGenericPassword({ service: SERVICE })
    if (!creds) return null
    return { accessToken: this.access ?? '', refreshToken: creds.password }
  }

  async set(tokens: Tokens): Promise<void> {
    this.access = tokens.accessToken
    await Keychain.setGenericPassword('refresh', tokens.refreshToken, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }

  async clear(): Promise<void> {
    this.access = null
    await Keychain.resetGenericPassword({ service: SERVICE })
  }
}
