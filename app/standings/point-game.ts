export type Outcome = 'HOME' | 'DRAW' | 'AWAY'
export type Pick = { matchId: number; league: string; title: string; kickoff: string; outcome: Outcome; stake: number; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'; reward: number; probability?: number; multiplier?: number; actualOutcome?: Outcome; finalScore?: string; isHome?: boolean; teamName?: string }
export type Wallet = { balance: number; picks: Pick[]; inventory?: string[]; equipped?: Partial<Record<'title' | 'frame' | 'theme', string>>; lastAttendance?: string; credits?: string[] }
export type MatchResult = { id: number; status: string; winner: string | null; home: number | null; away: number | null }
export const initialWallet = (): Wallet => ({ balance: 1000, picks: [], credits: ['owner-test-refund-2026-11-03'] })
export const STORAGE_KEY = 'football-points-v1'

// One-time restoration requested by the owner after spending points in local testing.
export function restoreTestPoints(wallet: Wallet): Wallet {
  const credit = 'owner-test-refund-2026-11-03'
  if (wallet.credits?.includes(credit)) return wallet
  return { ...wallet, balance: wallet.balance + 1000, credits: [...(wallet.credits ?? []), credit] }
}

export function koreaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function claimAttendance(wallet: Wallet, now = new Date()): Wallet {
  const today = koreaDate(now)
  if (wallet.lastAttendance && wallet.lastAttendance >= today) throw new Error('오늘 출석 보상을 이미 받았습니다.')
  return { ...wallet, balance: wallet.balance + 100, lastAttendance: today }
}

export function saveWallet(wallet: Wallet) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet))
  window.dispatchEvent(new Event('football-wallet-change'))
}

export function rewardMultiplier(probability: number) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) throw new Error('올바른 예측 확률이 필요합니다.')
  return Math.floor(Math.min(20, 100 / Math.max(5, probability)) * 100) / 100
}

export function payout(stake: number, multiplier: number) {
  return Math.floor(stake * Math.round(multiplier * 100) / 100)
}

export function enter(wallet: Wallet, pick: Pick, now = Date.now()): Wallet {
  if (!Number.isInteger(pick.stake) || pick.stake < 10 || pick.stake > 500 || pick.stake > wallet.balance) throw new Error('10~500P 사이에서 보유 포인트 이하로 입력해 주세요.')
  if (!Number.isFinite(Date.parse(pick.kickoff)) || Date.parse(pick.kickoff) <= now) throw new Error('경기 시작 후에는 예측할 수 없습니다.')
  if (wallet.picks.some((item) => item.matchId === pick.matchId)) throw new Error('이미 참여한 경기입니다.')
  const multiplier = pick.probability === undefined ? 2 : rewardMultiplier(pick.probability)
  return { ...wallet, balance: wallet.balance - pick.stake, picks: [{ ...pick, multiplier, status: 'PENDING', reward: 0 }, ...wallet.picks] }
}

export function settle(wallet: Wallet, results: MatchResult[]): Wallet {
  let balance = wallet.balance
  const picks = wallet.picks.map((pick): Pick => {
    const match = results.find((item) => item.id === pick.matchId)
    if (pick.status !== 'PENDING') {
      if (['WON', 'LOST'].includes(pick.status) && !pick.actualOutcome && match?.status === 'FINISHED' && match.home !== null && match.away !== null) {
        return { ...pick, actualOutcome: match.home > match.away ? 'HOME' : match.home < match.away ? 'AWAY' : 'DRAW', finalScore: `${match.home} : ${match.away}` }
      }
      return pick
    }
    if (!match) return pick
    if (['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(match.status)) {
      balance += pick.stake
      return { ...pick, status: 'VOID', reward: pick.stake }
    }
    if (match.status !== 'FINISHED' || match.home === null || match.away === null) return pick
    const outcome = match.home > match.away ? 'HOME' : match.home < match.away ? 'AWAY' : 'DRAW'
    const won = pick.outcome === outcome
    const reward = won ? payout(pick.stake, pick.multiplier ?? 2) : 0
    balance += reward
    return { ...pick, status: won ? 'WON' : 'LOST', reward, actualOutcome: outcome, finalScore: `${match.home} : ${match.away}` }
  })
  return { ...wallet, balance, picks }
}

export function readWallet(): Wallet {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return initialWallet()
  const value = JSON.parse(raw)
  if (value.credits !== undefined && (!Array.isArray(value.credits) || value.credits.some((credit: unknown) => typeof credit !== 'string'))) throw new Error('포인트 지급 기록을 읽을 수 없습니다.')
  if (value.lastAttendance !== undefined && (typeof value.lastAttendance !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.lastAttendance))) throw new Error('출석 기록을 읽을 수 없습니다.')
  if ((value.inventory !== undefined && (!Array.isArray(value.inventory) || value.inventory.some((id: unknown) => typeof id !== 'string'))) || (value.equipped !== undefined && (value.equipped === null || typeof value.equipped !== 'object' || Object.values(value.equipped).some((id) => typeof id !== 'string')))) throw new Error('저장된 아이템 기록을 읽을 수 없습니다.')
  if (!Number.isSafeInteger(value.balance) || value.balance < 0 || !Array.isArray(value.picks) || value.picks.some((pick: Pick) =>
    !Number.isInteger(pick.matchId) || !['PL', 'PD', 'BL1', 'SA', 'FL1'].includes(pick.league) || typeof pick.title !== 'string' || !Number.isFinite(Date.parse(pick.kickoff)) || !['HOME', 'DRAW', 'AWAY'].includes(pick.outcome) || !['PENDING', 'WON', 'LOST', 'VOID'].includes(pick.status) || !Number.isInteger(pick.stake) || pick.stake < 10 || pick.stake > 500 || !Number.isInteger(pick.reward) || pick.reward < 0 || (pick.multiplier !== undefined && (!Number.isFinite(pick.multiplier) || pick.multiplier < 1 || pick.multiplier > 20)) || (pick.probability !== undefined && (!Number.isFinite(pick.probability) || pick.probability < 0 || pick.probability > 100)))) throw new Error('저장된 포인트 기록을 읽을 수 없습니다.')
  if (process.env.NODE_ENV === 'development') {
    const restored = restoreTestPoints(value)
    if (restored !== value) localStorage.setItem(STORAGE_KEY, JSON.stringify(restored))
    return restored
  }
  return value
}
