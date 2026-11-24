import { NextRequest, NextResponse } from 'next/server'
import { sessionUser, COOKIE_NAME } from '../auth/store'
import { GET as getFixtures } from '../standings/fixtures/route'
import { GET as getStandings } from '../standings/route'
import { GET as getResults } from '../standings/results/route'
import { enter, settle, claimAttendance, type Outcome, type MatchResult, type Wallet } from '../../standings/point-game'
import { purchase, equip } from '../../standings/shop'
import { predictMatch, type TeamStats } from '../../standings/prediction'
import { readAccountWallet, publicWallet, updateAccountWallet } from './wallet'
import { profileLeagues, type LeagueStandings } from '../../profile/teams'

export const runtime = 'nodejs'
const leagues = ['PL', 'PD', 'BL1', 'SA', 'FL1']
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
class GameError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
type Fixture = { id: number; utcDate: string; homeTeam: { id: number; name: string; shortName?: string }; awayTeam: { id: number; name: string; shortName?: string } }
type Standings = { type: string; table: TeamStats[] }

function applyChange(change: () => Wallet) {
  try { return change() }
  catch (error) { throw new GameError(error instanceof Error ? error.message : '요청을 확인해 주세요.') }
}

export async function GET(request: NextRequest) {
  try {
    const user = await sessionUser(request.cookies.get(COOKIE_NAME)?.value)
    if (!user) return reply({ error: '로그인이 필요합니다.' }, 401)
    return reply({ wallet: publicWallet(await readAccountWallet(user.id)), userId: user.id })
  } catch { return reply({ error: '포인트 정보를 불러오지 못했습니다.' }, 503) }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return reply({ error: '허용되지 않는 요청입니다.' }, 403)
  try {
    const user = await sessionUser(request.cookies.get(COOKIE_NAME)?.value)
    if (!user) return reply({ error: '로그인 후 이용해 주세요.' }, 401)
    if (Number(request.headers.get('content-length')) > 4096) return reply({ error: '요청이 너무 큽니다.' }, 413)
    const body = await request.json()
    if (!body || !['predict', 'settle', 'attendance', 'purchase', 'equip', 'favoriteTeam'].includes(body.action)) throw new GameError('잘못된 요청입니다.')
    if (body.expectedUserId !== undefined && body.expectedUserId !== user.id) return reply({ error: '로그인 계정이 변경됐습니다. 다시 확인해 주세요.', accountChanged: true }, 409)
    let change: (wallet: Wallet) => Promise<Wallet> | Wallet
    if (body.action === 'predict') {
      if (!leagues.includes(body.league) || !Number.isSafeInteger(body.matchId) || !['HOME', 'DRAW', 'AWAY'].includes(body.outcome)
        || !Number.isSafeInteger(body.stake) || body.stake < 10 || body.stake > 500) throw new GameError('경기와 사용 포인트를 확인해 주세요.')
      const query = new NextRequest(`${request.nextUrl.origin}/api/standings?league=${body.league}`)
      const [fixturesResponse, standingsResponse] = await Promise.all([getFixtures(query), getStandings(query)])
      if (!fixturesResponse.ok || !standingsResponse.ok) throw new GameError('예측에 필요한 경기 정보를 불러오지 못했습니다.', 502)
      const fixtures = await fixturesResponse.json()
      const standings = await standingsResponse.json()
      const match = (fixtures.matches as Fixture[]).find(item => item.id === body.matchId)
      if (!match || Date.parse(match.utcDate) <= Date.now()) throw new GameError('참여 가능한 예정 경기가 아닙니다.')
      if (body.teamId !== undefined && body.teamId !== match.homeTeam.id && body.teamId !== match.awayTeam.id) throw new GameError('경기에 참가하는 팀을 선택해 주세요.')
      const tables = standings.standings as Standings[]
      const total = tables.find(item => item.type === 'TOTAL')?.table || []
      const home = total.find(item => item.team.id === match.homeTeam.id)
      const away = total.find(item => item.team.id === match.awayTeam.id)
      const prediction = home && away && predictMatch(home, away, tables.find(item => item.type === 'HOME')?.table || [], tables.find(item => item.type === 'AWAY')?.table || [], total)
      if (!prediction) throw new GameError('예측에 필요한 시즌 기록이 부족합니다.')
      const outcome: Outcome = body.outcome
      const isHome = body.teamId === undefined || body.teamId === match.homeTeam.id
      const team = isHome ? match.homeTeam : match.awayTeam
      change = wallet => applyChange(() => enter(wallet, {
        matchId: match.id, league: body.league,
        title: `${match.homeTeam.shortName || match.homeTeam.name} vs ${match.awayTeam.shortName || match.awayTeam.name}`,
        kickoff: match.utcDate, outcome, stake: body.stake,
        probability: prediction.percentages[outcome === 'HOME' ? 0 : outcome === 'DRAW' ? 1 : 2],
        teamName: team.shortName || team.name, isHome, status: 'PENDING', reward: 0,
      }))
    } else if (body.action === 'settle') {
      change = async wallet => {
        const codes = [...new Set(wallet.picks.filter(pick => pick.status === 'PENDING').map(pick => pick.league))]
        const groups = await Promise.all(codes.map(async code => {
          const response = await getResults(new NextRequest(`${request.nextUrl.origin}/api/standings/results?league=${code}`))
          if (!response.ok) throw new GameError('결과 조회가 지연됩니다. 잠시 후 다시 시도해 주세요.', 502)
          return (await response.json()).matches as MatchResult[]
        }))
        return settle(wallet, groups.flat())
      }
    } else if (body.action === 'attendance') {
      change = wallet => applyChange(() => claimAttendance(wallet))
    } else if (body.action === 'favoriteTeam') {
      if (body.teamId === null) {
        change = wallet => ({ ...wallet, favoriteTeam: null })
      } else {
        const league = profileLeagues.find((candidate) => candidate.code === body.league)
        if (!league || !Number.isSafeInteger(body.teamId) || body.teamId <= 0) throw new GameError('응원할 팀을 선택해 주세요.')
        const response = await getStandings(new NextRequest(`${request.nextUrl.origin}/api/standings?league=${league.code}`))
        if (!response.ok) throw new GameError('팀 목록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', response.status)
        const data: LeagueStandings = await response.json()
        const team = data.standings.find((group) => group.type === 'TOTAL')?.table.find((row) => row.team.id === body.teamId)?.team
        if (!team) throw new GameError('선택한 리그에서 해당 팀을 찾을 수 없습니다.')
        change = wallet => ({ ...wallet, favoriteTeam: { league: league.code, id: team.id, name: team.shortName || team.name, crest: team.crest } })
      }
    } else {
      if (typeof body.itemId !== 'string') throw new GameError('아이템을 선택해 주세요.')
      change = wallet => applyChange(() => body.action === 'purchase' ? purchase(wallet, body.itemId) : equip(wallet, body.itemId))
    }
    return reply({ wallet: await updateAccountWallet(user.id, change), userId: user.id })
  } catch (error) {
    if (error instanceof GameError) return reply({ error: error.message }, error.status)
    if (error instanceof SyntaxError) return reply({ error: '올바른 요청을 보내 주세요.' }, 400)
    return reply({ error: '계정 포인트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503)
  }
}
