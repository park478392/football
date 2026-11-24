import 'server-only'
import { MongoServerError } from 'mongodb'
import { getMongoDatabase } from '../../lib/mongodb'
import { initialWallet, type Wallet } from '../../standings/point-game'

type StoredWallet = Wallet & { _id: string; version: number }

export async function readAccountWallet(userId: string) {
  const db = await getMongoDatabase()
  const wallets = db.collection<StoredWallet>('wallets')
  try {
    await wallets.updateOne({ _id: userId }, { $setOnInsert: { ...initialWallet(), version: 0 } }, { upsert: true })
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error
  }
  const stored = await wallets.findOne({ _id: userId })
  if (!stored) throw new Error('지갑 정보를 불러오지 못했습니다.')
  return stored
}

export function publicWallet(stored: StoredWallet): Wallet {
  return { balance: stored.balance, picks: stored.picks, inventory: stored.inventory || [], equipped: stored.equipped || {}, ...(stored.lastAttendance ? { lastAttendance: stored.lastAttendance } : {}), favoriteTeam: stored.favoriteTeam ?? null, revision: stored.version }
}

export async function updateAccountWallet(userId: string, change: (wallet: Wallet) => Promise<Wallet> | Wallet) {
  const db = await getMongoDatabase()
  for (let attempt = 0; attempt < 8; attempt++) {
    const stored = await readAccountWallet(userId)
    const next = await change(publicWallet(stored))
    if (!Number.isSafeInteger(next.balance) || next.balance < 0) throw new Error('포인트 잔액을 확인해 주세요.')
    const values = { ...next }
    delete values.revision
    const result = await db.collection<StoredWallet>('wallets').updateOne(
      { _id: userId, version: stored.version },
      { $set: values, $inc: { version: 1 } },
    )
    if (result.modifiedCount === 1) return { ...values, revision: stored.version + 1 }
  }
  throw new Error('다른 요청을 처리 중입니다. 잠시 후 다시 시도해 주세요.')
}
