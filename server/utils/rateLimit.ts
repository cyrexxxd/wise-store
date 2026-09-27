/// Простое ограничение частоты по ключу (IP) в памяти процесса: не больше max запросов за windowMs.
/// Render держит один процесс — этого хватает, чтобы скрипт не заливал базу заказами.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function allowRequest(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  return b.count <= max
}
