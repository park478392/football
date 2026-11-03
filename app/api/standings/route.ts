import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get('league') || 'PL'
  if (!['PL', 'PD', 'BL1', 'SA', 'FL1'].includes(league)) {
    return NextResponse.json({ error: '지원하지 않는 리그입니다.' }, { status: 400 })
  }
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) {
    return NextResponse.json({ error: '축구 데이터 API 키가 설정되지 않았습니다.' }, { status: 503 })
  }
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/${league}/standings`, {
      headers: { 'X-Auth-Token': key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      return NextResponse.json({ error: response.status === 429
        ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : '리그 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: response.status === 429 ? 429 : 502 })
    }
    const data = await response.json()
    return NextResponse.json({ competition: data.competition, season: data.season, standings: data.standings })
  } catch {
    return NextResponse.json({ error: '데이터 서버에 연결하지 못했습니다. 다시 시도해 주세요.' }, { status: 502 })
  }
}
