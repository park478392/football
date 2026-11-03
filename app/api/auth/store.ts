import 'server-only'
import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

const scrypt = promisify(scryptCallback)
type Account = { id: string; username: string; salt: string; hash: string }
type Session = { tokenHash: string; userId: string; expires: number }
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

export async function authenticate(username: string, password: string, signup: boolean) {
  return database(async (db) => {
    let account = db.users.find((user) => user.username === username)
    if (signup) {
      if (account) throw new Error('이미 사용 중인 아이디입니다.')
      const salt = randomBytes(16).toString('hex')
      const hash = (await scrypt(password, salt, 64) as Buffer).toString('hex')
      account = { id: randomBytes(16).toString('hex'), username, salt, hash }
      db.users.push(account)
    } else {
      const hash = await scrypt(password, account?.salt || 'missing-account-salt', 64) as Buffer
      if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
    }
    const token = randomBytes(32).toString('hex')
    db.sessions.push({ tokenHash: digest(token), userId: account.id, expires: Date.now() + SESSION_SECONDS * 1000 })
    return { token, user: { id: account.id, username: account.username } }
  })
}

export async function sessionUser(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  return database((db) => {
    const session = db.sessions.find((item) => item.tokenHash === digest(token))
    const user = db.users.find((item) => item.id === session?.userId)
    return user ? { id: user.id, username: user.username } : null
  })
}

export async function revoke(token: string | undefined) {
  if (!token) return
  await database((db) => { db.sessions = db.sessions.filter((item) => item.tokenHash !== digest(token)) })
}
