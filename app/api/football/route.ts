import { NextRequest, NextResponse } from 'next/server'

const allowedLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1']

export async function GET(request: NextRequest) {
  const apiKey = process.env.FOOTBALL_DATA_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'FOOTBALL_DATA_KEY를 찾을 수 없습니다.' },
      { status: 500 },
    )
  }

  const league = request.nextUrl.searchParams.get('league') || 'PL'

  if (!allowedLeagues.includes(league)) {
    return NextResponse.json(
      { error: '지원하지 않는 리그입니다.' },
      { status: 400 },
    )
  }

  try {
    const headers = {
      'X-Auth-Token': apiKey,
    }

    const [standingsResponse, scorersResponse] = await Promise.all([
      fetch(
        `https://api.football-data.org/v4/competitions/${league}/standings`,
        {
          headers,
          next: {
            revalidate: 300,
          },
        },
      ),

      fetch(
        `https://api.football-data.org/v4/competitions/${league}/scorers?limit=50`,
        {
          headers,
          next: {
            revalidate: 300,
          },
        },
      ),
    ])

    const standingsData = await standingsResponse.json()

    const scorersData = await scorersResponse.json()

    if (!standingsResponse.ok) {
      return NextResponse.json(
        {
          error: '리그 순위를 불러오지 못했습니다.',
          detail: standingsData,
        },
        {
          status: standingsResponse.status,
        },
      )
    }

    if (!scorersResponse.ok) {
      return NextResponse.json(
        {
          error: '선수 순위를 불러오지 못했습니다.',
          detail: scorersData,
        },
        {
          status: scorersResponse.status,
        },
      )
    }

    return NextResponse.json({
      competition: standingsData.competition,
      season: standingsData.season,
      standings: standingsData.standings,
      scorers: scorersData.scorers,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: '서버 오류가 발생했습니다.',
      },
      {
        status: 500,
      },
    )
  }
}
