const PREFIX = 'ai-company-os'

export function loadState<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}:${key}`)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function saveState(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
  } catch {
    // storage full / unavailable — persistence is best-effort in V1
  }
}

export function clearState(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(`${PREFIX}:`)) toRemove.push(k)
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}
