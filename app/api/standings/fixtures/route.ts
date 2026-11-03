import { NextRequest, NextResponse } from 'next/server'

type Fixture = { id: number; status: string; utcDate: string; homeTeam: { id: number; name: string; shortName?: string }; awayTeam: { id: number; name: string; shortName?: string } }

export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get('league') || 'PL'
  if (!['PL', 'PD', 'BL1', 'SA', 'FL1'].includes(league)) return NextResponse.json({ error: '지원하지 않는 리그입니다.' }, { status: 400 })
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 503 })
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/${league}/matches`, {
      headers: { 'X-Auth-Token': key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return NextResponse.json({ error: '일정을 불러오지 못했습니다.' }, { status: response.status === 429 ? 429 : 502 })
    const data = await response.json()
    const now = Date.now()
    const matches = (data.matches as Fixture[]).filter((match) => ['SCHEDULED', 'TIMED'].includes(match.status) && Date.parse(match.utcDate) > now)
      .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate))
      .map(({ id, utcDate, homeTeam, awayTeam }) => ({ id, utcDate, homeTeam, awayTeam }))
    return NextResponse.json({ matches })
  } catch {
    return NextResponse.json({ error: '일정 서버에 연결하지 못했습니다.' }, { status: 502 })
  }
}
