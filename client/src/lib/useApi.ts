import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from './api'

// Simple fetch hook. Any mutation should call `refresh()` afterwards.
const listeners = new Set<() => void>()
/** Notify every mounted useApi hook that data changed. */
export const invalidateAll = () => listeners.forEach((l) => l())

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setData(await api.get<T>(path))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  useEffect(() => {
    listeners.add(refresh)
    return () => void listeners.delete(refresh)
  }, [refresh])

  return { data, loading, error, refresh }
}

/** Run a mutation with toast feedback and a global refresh. Returns true on success. */
export async function mutate(fn: () => Promise<unknown>, successMsg?: string) {
  try {
    await fn()
    invalidateAll()
    if (successMsg) toast.success(successMsg)
    return true
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : 'Something went wrong')
    return false
  }
}
