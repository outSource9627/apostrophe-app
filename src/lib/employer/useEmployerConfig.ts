import { useEffect, useState } from 'react'
import { getConfig, type AppConfig } from '../api/config'

export type EmployerConfig = NonNullable<AppConfig['employer']>

const NONE: EmployerConfig = {}

/**
 * The employer web's admin-controlled numbers (`config.employer`), read once
 * per page load. Every field is optional: until the config lands, or when the
 * server does not enforce a limit, the field is absent and the screen says the
 * sentence without the number — it never falls back to a figure typed here.
 */
export function useEmployerConfig(): EmployerConfig {
  const [config, setConfig] = useState<EmployerConfig>(NONE)
  useEffect(() => {
    let alive = true
    getConfig()
      .then((c) => alive && setConfig(c.employer ?? NONE))
      .catch(() => {
        /* number-free copy is the fallback */
      })
    return () => {
      alive = false
    }
  }, [])
  return config
}
