export type Tokens = { accessToken: string; refreshToken: string }

export interface TokenStore {
  get(): Promise<Tokens | null>
  set(tokens: Tokens): Promise<void>
  clear(): Promise<void>
}
