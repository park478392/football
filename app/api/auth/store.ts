import 'server-only'
import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { hasMongoConfiguration, mongoStorage } from './mongo'

const scrypt = promisify(scryptCallback)
export type AccountUser = { id: string; username: string; role?: 'admin' }
export type Account = AccountUser & { salt: string; hash: string }
export type Session = { tokenHash: string; userId: string; expires: number }
export type AuthStorage = {
  findAccount(username: string): Promise<Account | null>
  createAccount(account: Account): Promise<void>
  createSession(session: Session): Promise<void>
  sessionUser(tokenHash: string): Promise<AccountUser | null>
  revoke(tokenHash: string): Promise<void>
}
type Database = { users: Account[]; sessions: Session[] }
const globalStore = globalThis as typeof globalThis & { authQueue?: Promise<unknown> }
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
export const COOKIE_NAME = 'football_session'
export const SESSION_SECONDS = 7 * 24 * 60 * 60

async function database<T>(work: (db: Database) => Promise<T> | T): Promise<T> {
  // A single persistent Node server owns this file. Production requires an explicit volume.
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_DATA_DIR) throw new Error('AUTH_STORAGE_UNAVAILABLE')
  const directory = process.env.AUTH_DATA_DIR || path.join(process.cwd(), '.data')
  const run = async () => {
    await mkdir(directory, { recursive: true })
    const file = path.join(directory, 'accounts.json')
    let db: Database
    try { db = JSON.parse(await readFile(file, 'utf8')) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      db = { users: [], sessions: [] }
    }
    db.sessions = db.sessions.filter((session) => session.expires > Date.now())
    const result = await work(db)
    const temp = path.join(directory, `accounts-${randomBytes(8).toString('hex')}.tmp`)
    await writeFile(temp, JSON.stringify(db), { mode: 0o600 })
    await rename(temp, file)
    return result
  }
  const queued = (globalStore.authQueue ?? Promise.resolve()).then(run, run)
  globalStore.authQueue = queued.catch(() => {})
  return queued
}

const fileStorage: AuthStorage = {
  findAccount: (username) => database((db) => db.users.find((user) => user.username === username) ?? null),
  createAccount: (account) => database((db) => {
    if (db.users.some((user) => user.username === account.username)) throw new Error('이미 사용 중인 아이디입니다.')
    db.users.push(account)
  }),
  createSession: (session) => database((db) => { db.sessions.push(session) }),
  sessionUser: (tokenHash) => database((db) => {
    const session = db.sessions.find((item) => item.tokenHash === tokenHash)
    const user = db.users.find((item) => item.id === session?.userId)
    return user ? { id: user.id, username: user.username, role: user.role } : null
  }),
  revoke: (tokenHash) => database((db) => { db.sessions = db.sessions.filter((item) => item.tokenHash !== tokenHash) }),
}

export async function authenticate(username: string, password: string, signup: boolean) {
  const storage = hasMongoConfiguration() ? await mongoStorage() : fileStorage
  let account = await storage.findAccount(username)
  if (signup) {
    if (account) throw new Error('이미 사용 중인 아이디입니다.')
    const salt = randomBytes(16).toString('hex')
    const hash = (await scrypt(password, salt, 64) as Buffer).toString('hex')
    account = { id: randomBytes(16).toString('hex'), username, salt, hash }
    await storage.createAccount(account)
  } else {
    const hash = await scrypt(password, account?.salt || 'missing-account-salt', 64) as Buffer
    if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
  }
  const token = randomBytes(32).toString('hex')
  await storage.createSession({ tokenHash: digest(token), userId: account.id, expires: Date.now() + SESSION_SECONDS * 1000 })
  return { token, user: { id: account.id, username: account.username, role: account.role } }
}

export async function sessionUser(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const storage = hasMongoConfiguration() ? await mongoStorage() : fileStorage
  return storage.sessionUser(digest(token))
}

export async function revoke(token: string | undefined) {
  if (!token) return
  const storage = hasMongoConfiguration() ? await mongoStorage() : fileStorage
  await storage.revoke(digest(token))
}
