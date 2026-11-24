import { NextRequest, NextResponse } from 'next/server'
import rosterSnapshot from './roster-snapshot.json'

type RosterDetails = { shirtNumber?: number; photo?: string }
const rosterTeams: Partial<Record<string, Record<string, RosterDetails>>> = rosterSnapshot.teams

type Player = {
  id: number
  name: string
  dateOfBirth?: string | null
  nationality?: string | null
  position?: string | null
  section?: string | null
  shirtNumber?: number | null
}
type Team = {
  id: number
  name: string
  shortName: string
  crest: string | null
  squad: Player[]
}
type Scorer = {
  player: Player
  team: { id: number }
  playedMatches: number | null
  goals: number | null
  assists: number | null
  penalties: number | null
}

export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get('league') || 'PL'
  if (!['PL', 'PD', 'BL1', 'SA', 'FL1'].includes(league)) {
    return NextResponse.json({ error: '지원하지 않는 리그입니다.' }, { status: 400 })
  }
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) return NextResponse.json({ error: '선수 데이터 연결이 필요합니다.' }, { status: 503 })

  try {
    const options = { headers: { 'X-Auth-Token': key }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) }
    const [teamResult, scorerResult] = await Promise.allSettled([
      fetch(`https://api.football-data.org/v4/competitions/${league}/teams`, options),
      fetch(`https://api.football-data.org/v4/competitions/${league}/scorers?limit=500`, options),
    ])
    if (teamResult.status === 'rejected' || !teamResult.value.ok) {
      return NextResponse.json({ error: '팀별 선수 명단을 불러오지 못했습니다.' }, { status: 502 })
    }
    const teamData = await teamResult.value.json()
    let scorers: Scorer[] = []
    let statsAvailable = false
    if (scorerResult.status === 'fulfilled' && scorerResult.value.ok) {
      try {
        const scorerData = await scorerResult.value.json()
        if (scorerData.season?.id === teamData.season?.id) {
          scorers = scorerData.scorers || []
          statsAvailable = true
        }
      } catch { /* Squad profiles remain available when season statistics fail. */ }
    }
    const stats = new Map(scorers.map((scorer) => [`${scorer.team.id}-${scorer.player.id}`, scorer]))
    const teams: Team[] = teamData.teams || []
    const currentRosters = teamData.season?.startDate?.slice(0, 4) === rosterSnapshot.season
    const players = teams.flatMap((team) => (team.squad || []).map((player) => {
      const scorer = stats.get(`${team.id}-${player.id}`)
      const goals = scorer?.goals ?? null
      const roster = currentRosters ? rosterTeams[team.id]?.[player.id] : undefined
      return {
        player: {
          ...player,
          dateOfBirth: player.dateOfBirth ?? null,
          nationality: player.nationality ?? null,
          position: player.position ?? null,
          shirtNumber: player.shirtNumber ?? roster?.shirtNumber ?? null,
          photo: roster?.photo ?? null,
        },
        team: { id: team.id, name: team.name, shortName: team.shortName, crest: team.crest },
        playedMatches: scorer?.playedMatches ?? null,
        goals,
        assists: scorer?.assists ?? null,
        penalties: scorer?.penalties ?? null,
        goalRank: goals == null ? null : scorers.filter((entry) => entry.goals != null && entry.goals > goals).length + 1,
      }
    })).sort((a, b) => (b.goals ?? -1) - (a.goals ?? -1) || a.player.name.localeCompare(b.player.name))

    return NextResponse.json({
      season: teamData.season,
      teams: teams.map(({ id, name, shortName, crest }) => ({ id, name, shortName, crest })),
      players, statsAvailable,
    })
  } catch {
    return NextResponse.json({ error: '선수 데이터 서버에 연결하지 못했습니다.' }, { status: 502 })
  }
}
