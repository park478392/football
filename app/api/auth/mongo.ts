import 'server-only'
import { MongoServerError } from 'mongodb'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Account, Session, AuthStorage } from './store'
import { getMongoDatabase } from '../../lib/mongodb'

type StoredSession = Session & { expiresAt: Date }
const state = globalThis as typeof globalThis & { authMongoConnections?: Map<string, Promise<AuthStorage>> }

export function hasMongoConfiguration() {
  const uri = process.env.MONGODB_URI?.trim()
  return !!uri && !uri.includes('<db_password>')
}

export async function mongoStorage(): Promise<AuthStorage> {
  const uri = process.env.MONGODB_URI!.trim()
  const databaseName = process.env.MONGODB_DATABASE?.trim() || 'football-analysis'
  const key = `${uri}|${databaseName}`
  const connections = state.authMongoConnections ??= new Map()
  const existing = connections.get(key)
  if (existing) return existing

  const ready = (async (): Promise<AuthStorage> => {
    const db = await getMongoDatabase()
    const users = db.collection<Account>('users')
    const sessions = db.collection<StoredSession>('sessions')
    await Promise.all([
      users.createIndex({ username: 1 }, { unique: true }),
      users.createIndex({ id: 1 }, { unique: true }),
      sessions.createIndex({ tokenHash: 1 }, { unique: true }),
      sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ])

    const migrations = db.collection<{ _id: string; completedAt: Date }>('_migrations')
    if (!await migrations.findOne({ _id: 'local-auth-v1' })) {
      const file = path.join(process.env.AUTH_DATA_DIR || path.join(process.cwd(), '.data'), 'accounts.json')
      let legacy: { users: Account[]; sessions: Session[] } = { users: [], sessions: [] }
      try {
        legacy = JSON.parse(await readFile(file, 'utf8'))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const importedIds = new Set<string>()
      for (const account of legacy.users) {
        try {
          await users.updateOne({ username: account.username }, { $setOnInsert: account }, { upsert: true })
        } catch (error) {
          if (!(error instanceof MongoServerError) || error.code !== 11000) throw error
        }
        const stored = await users.findOne({ username: account.username })
        if (stored?.id === account.id) importedIds.add(account.id)
      }
      for (const session of legacy.sessions) {
        if (session.expires <= Date.now() || !importedIds.has(session.userId)) continue
        await sessions.updateOne({ tokenHash: session.tokenHash }, {
          $setOnInsert: { ...session, expiresAt: new Date(session.expires) },
        }, { upsert: true })
      }
      await migrations.updateOne({ _id: 'local-auth-v1' }, { $set: { completedAt: new Date() } }, { upsert: true })
    }

    return {
      findAccount: (username) => users.findOne({ username }),
      async createAccount(account) {
        try { await users.insertOne(account) }
        catch (error) {
          if (error instanceof MongoServerError && error.code === 11000) throw new Error('이미 사용 중인 아이디입니다.')
          throw error
        }
      },
      async createSession(session) {
        await sessions.insertOne({ ...session, expiresAt: new Date(session.expires) })
      },
      async sessionUser(tokenHash) {
        const session = await sessions.findOne({ tokenHash, expires: { $gt: Date.now() } })
        if (!session) return null
        const user = await users.findOne({ id: session.userId })
        return user ? { id: user.id, username: user.username, role: user.role } : null
      },
      async revoke(tokenHash) { await sessions.deleteOne({ tokenHash }) },
    }
  })().catch(async (error) => {
    console.error('MongoDB auth storage initialization failed', { name: error.name, code: error.code })
    connections.delete(key)
    throw error
  })
  connections.set(key, ready)
  return ready
}
