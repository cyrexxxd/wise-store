/// Подключение к Postgres (Neon) по NUXT_DATABASE_URL. Одно на процесс, схема создаётся при первом
/// обращении (CREATE TABLE IF NOT EXISTS — идемпотентно, данные не трогает).
import postgres from 'postgres'
import { ensureSchema, type Db } from './orders'

let ready: Promise<Db> | null = null

function wrap(sql: postgres.Sql | postgres.TransactionSql): Db {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
    tx: <T>(fn: (q: Db) => Promise<T>) => (sql as postgres.Sql).begin((t) => fn(wrap(t))) as Promise<T>,
  }
}

export function useDb(): Promise<Db> {
  if (!ready) {
    const url = useRuntimeConfig().databaseUrl
    if (!url) throw createError({ statusCode: 503, data: { message: 'Оплата временно недоступна.' }, statusMessage: 'NUXT_DATABASE_URL не задан' })
    const db = wrap(postgres(url, { max: 3, idle_timeout: 30, connect_timeout: 10, prepare: false }))
    ready = ensureSchema(db).then(() => db).catch((e) => {
      ready = null
      throw e
    })
  }
  return ready
}
