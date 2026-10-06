import { NextRequest, NextResponse } from 'next/server'

type SportsDBPlayer = {
  idPlayer?: string
  strPlayer?: string
  strTeam?: string
  strSport?: string

  strThumb?: string | null
  strCutout?: string | null
  strRender?: string | null
}

export async function GET(request: NextRequest) {
  const playerName = request.nextUrl.searchParams.get('name')

  const teamName = request.nextUrl.searchParams.get('team')

  if (!playerName) {
    return NextResponse.json(
      {
        error: '선수 이름이 필요합니다.',
      },
      {
        status: 400,
      },
    )
  }

  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(
        playerName,
      )}`,
      {
        next: {
          revalidate: 86400,
        },
      },
    )

    if (!response.ok) {
      return NextResponse.json({
        image: null,
      })
    }

    const data = await response.json()

    const players: SportsDBPlayer[] = data.player || []

    if (players.length === 0) {
      return NextResponse.json({
        image: null,
      })
    }

    /*
      축구 선수만 남김
    */

    const footballPlayers = players.filter((player) => {
      const sport = player.strSport?.toLowerCase()

      return sport === 'soccer' || sport === 'football'
    })

    /*
      football-data.org의 팀 이름과
      TheSportsDB 팀 이름이 완전히 같지 않을 수도 있으므로
      includes 방식으로 비교
    */

    let selectedPlayer: SportsDBPlayer | undefined

    if (teamName) {
      const normalizedTeam = teamName.toLowerCase()

      selectedPlayer = footballPlayers.find((player) => {
        const sportsDBTeam = player.strTeam?.toLowerCase()

        if (!sportsDBTeam) {
          return false
        }

        return (
          sportsDBTeam.includes(normalizedTeam) ||
          normalizedTeam.includes(sportsDBTeam)
        )
      })
    }

    /*
      팀으로 못 찾으면
      첫 번째 축구 선수 사용
    */

    if (!selectedPlayer) {
      selectedPlayer = footballPlayers[0] || players[0]
    }

    /*
      이미지 우선순위

      1. Cutout
      2. Render
      3. Thumb
    */

    const image =
      selectedPlayer?.strCutout ||
      selectedPlayer?.strRender ||
      selectedPlayer?.strThumb ||
      null

    return NextResponse.json({
      image,
      player: selectedPlayer?.strPlayer || playerName,
    })
  } catch (error) {
    console.error('선수 이미지 API 오류:', error)

    return NextResponse.json({
      image: null,
    })
  }
}
