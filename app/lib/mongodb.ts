import 'server-only'
import { MongoClient, type Db } from 'mongodb'

const state = globalThis as typeof globalThis & { mongoDatabases?: Map<string, Promise<Db>> }

export function getMongoDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri || uri.includes('<db_password>')) throw new Error('MongoDB 연결 설정이 필요합니다.')
  const name = process.env.MONGODB_DATABASE?.trim() || 'football-analysis'
  const key = `${uri}|${name}`
  const databases = state.mongoDatabases ??= new Map()
  const existing = databases.get(key)
  if (existing) return existing
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
  const ready = client.connect().then(() => client.db(name)).catch(async error => {
    databases.delete(key)
    await client.close().catch(() => {})
    throw error
  })
  databases.set(key, ready)
  return ready
}
