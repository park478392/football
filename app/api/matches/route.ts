import { NextRequest, NextResponse } from 'next/server'

const API_URL = 'https://api.football-data.org/v4'

const LEAGUES = [
  {
    code: 'PL',
    name: '프리미어리그',
  },
  {
    code: 'PD',
    name: '라리가',
  },
  {
    code: 'BL1',
    name: '분데스리가',
  },
  {
    code: 'SA',
    name: '세리에 A',
  },
  {
    code: 'FL1',
    name: '리그앙',
  },
]

/*
  UTC → 한국 날짜

  예:
  2026-10-10T16:30:00Z
  → 2026-10-11
*/
function getKoreanDate(utcDate: string) {
  const date = new Date(utcDate)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value

  const month = parts.find((part) => part.type === 'month')?.value

  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

/*
  UTC → 한국 시간

  예:
  2026-10-10T11:30:00Z
  → 20:30
*/
function getKoreanTime(utcDate: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcDate))
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.FOOTBALL_DATA_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'FOOTBALL_DATA_KEY가 설정되지 않았습니다.',
      },
      {
        status: 500,
      },
    )
  }

  const searchParams = request.nextUrl.searchParams

  const selectedLeague = searchParams.get('league') || 'ALL'

  const selectedDate = searchParams.get('date')

  /*
    날짜 없으면 오류
  */
  if (!selectedDate) {
    return NextResponse.json(
      {
        error: '날짜를 입력해주세요.',
      },
      {
        status: 400,
      },
    )
  }

  /*
    리그 코드 확인
  */
  const validLeague =
    selectedLeague === 'ALL' ||
    LEAGUES.some((league) => league.code === selectedLeague)

  if (!validLeague) {
    return NextResponse.json(
      {
        error: '지원하지 않는 리그입니다.',
      },
      {
        status: 400,
      },
    )
  }

  /*
    ALL이면 5대 리그 전부

    아니면 선택한 리그 하나만
  */
  const targetLeagues =
    selectedLeague === 'ALL'
      ? LEAGUES
      : LEAGUES.filter((league) => league.code === selectedLeague)

  try {
    /*
      리그 API 동시 호출
    */
    const results = await Promise.all(
      targetLeagues.map(async (league) => {
        try {
          const response = await fetch(
            `${API_URL}/competitions/${league.code}/matches`,
            {
              headers: {
                'X-Auth-Token': apiKey,
              },

              /*
                테스트에서 정상 작동했던 방식
              */
              next: {
                revalidate: 3600,
              },
            },
          )

          const data = await response.json()

          if (!response.ok) {
            console.error(`${league.code} API 오류:`, data)

            return {
              leagueCode: league.code,

              leagueName: league.name,

              competition: {
                code: league.code,
                name: league.name,
                emblem: null,
              },

              matches: [],
            }
          }

          /*
            한국 날짜 기준으로
            선택한 날짜 경기만 추출
          */
          const filteredMatches = (data.matches || []).filter((match: any) => {
            if (!match.utcDate) {
              return false
            }

            return getKoreanDate(match.utcDate) === selectedDate
          })

          /*
            프론트에서 필요한 정보만 정리
          */
          const matches = filteredMatches.map((match: any) => {
            return {
              id: match.id,

              utcDate: match.utcDate,

              koreanDate: getKoreanDate(match.utcDate),

              koreanTime: getKoreanTime(match.utcDate),

              status: match.status,

              matchday: match.matchday,

              stage: match.stage,

              homeTeam: {
                id: match.homeTeam?.id,

                name: match.homeTeam?.name || '',

                shortName:
                  match.homeTeam?.shortName || match.homeTeam?.name || '',

                tla: match.homeTeam?.tla || '',

                crest: match.homeTeam?.crest || null,
              },

              awayTeam: {
                id: match.awayTeam?.id,

                name: match.awayTeam?.name || '',

                shortName:
                  match.awayTeam?.shortName || match.awayTeam?.name || '',

                tla: match.awayTeam?.tla || '',

                crest: match.awayTeam?.crest || null,
              },

              score: {
                winner: match.score?.winner || null,

                duration: match.score?.duration || null,

                fullTime: {
                  home: match.score?.fullTime?.home ?? null,

                  away: match.score?.fullTime?.away ?? null,
                },

                halfTime: {
                  home: match.score?.halfTime?.home ?? null,

                  away: match.score?.halfTime?.away ?? null,
                },
              },
            }
          })

          return {
            leagueCode: league.code,

            leagueName: league.name,

            competition: {
              id: data.competition?.id,

              code: data.competition?.code || league.code,

              name: data.competition?.name || league.name,

              emblem: data.competition?.emblem || null,
            },

            matches,
          }
        } catch (error) {
          console.error(`${league.code} 요청 실패:`, error)

          return {
            leagueCode: league.code,

            leagueName: league.name,

            competition: {
              code: league.code,
              name: league.name,
              emblem: null,
            },

            matches: [],
          }
        }
      }),
    )

    /*
      경기 없는 리그도 API에서는 유지한다.

      프론트에서 필요하면
      matches.length === 0인 리그를 숨기면 됨.
    */
    const totalMatches = results.reduce(
      (total, league) => total + league.matches.length,
      0,
    )

    return NextResponse.json({
      mode: selectedLeague === 'ALL' ? 'ALL' : 'SINGLE',

      date: selectedDate,

      timezone: 'Asia/Seoul',

      totalMatches,

      leagues: results,
    })
  } catch (error) {
    console.error('경기 API 서버 오류:', error)

    return NextResponse.json(
      {
        error: '경기 데이터를 불러오지 못했습니다.',
      },
      {
        status: 500,
      },
    )
  }
}
