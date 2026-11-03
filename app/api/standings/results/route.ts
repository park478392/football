import { NextRequest, NextResponse } from 'next/server'

type Match = { id: number; status: string; score: { winner: string | null; fullTime: { home: number | null; away: number | null } } }
export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get('league') || 'PL'
  if (!['PL', 'PD', 'BL1', 'SA', 'FL1'].includes(league)) return NextResponse.json({ error: '지원하지 않는 리그입니다.' }, { status: 400 })
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) return NextResponse.json({ error: '경기 데이터 연결이 필요합니다.' }, { status: 503 })
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/${league}/matches`, {
      headers: { 'X-Auth-Token': key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return NextResponse.json({ error: '경기 결과를 불러오지 못했습니다.' }, { status: 502 })
    const data = await response.json()
    return NextResponse.json({ matches: (data.matches as Match[]).map((match) => ({ id: match.id, status: match.status, winner: match.score.winner, home: match.score.fullTime.home, away: match.score.fullTime.away })) })
  } catch { return NextResponse.json({ error: '경기 결과 연결이 지연되고 있습니다.' }, { status: 502 }) }
}
