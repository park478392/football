import { NextRequest, NextResponse } from 'next/server'

type Player = {
  idPlayer: string
  strPlayer: string
  strPlayerAlternate?: string | null
  strSport: string
  dateBorn?: string | null
}

type FormerTeam = {
  id: string
  idPlayer: string
  strSport: string
  strFormerTeam: string
  strJoined: string | null
  strDeparted: string | null
  strMoveType: string | null
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

async function getData(path: string) {
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/123/${path}`, {
    next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('이적 기록 제공 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  return response.json()
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim()
  const born = request.nextUrl.searchParams.get('born') || ''
  if (!name || name.length > 120 || (born && !/^\d{4}-\d{2}-\d{2}$/.test(born))) {
    return NextResponse.json({ error: '올바른 선수 정보를 입력해 주세요.' }, { status: 400 })
  }

  try {
    const plainName = name.normalize('NFD').replace(/\p{M}/gu, '')
    const surname = plainName.split(/\s+/).at(-1)!
    let player: Player | undefined
    for (const query of new Set([surname, plainName])) {
      const data = await getData(`searchplayers.php?p=${encodeURIComponent(query.replace(/\s+/g, '_'))}`)
      const candidates = ((data.player || []) as Player[]).filter((candidate) => {
        const names = [candidate.strPlayer, ...(candidate.strPlayerAlternate || '').split(';')]
        return ['soccer', 'football'].includes(candidate.strSport?.toLowerCase())
          && names.some((value) => normalize(value) === normalize(name))
          && (!born || candidate.dateBorn === born)
      })
      if (candidates.length === 1) {
        player = candidates[0]
        break
      }
    }

    if (!player) return NextResponse.json({ transfers: [], source: null })
    const data = await getData(`lookupformerteams.php?id=${encodeURIComponent(player.idPlayer)}`)
    const transfers = ((data.formerteams || []) as FormerTeam[])
      .filter((entry) => entry.idPlayer === player.idPlayer && entry.strFormerTeam
        && ['soccer', 'football'].includes(entry.strSport?.toLowerCase()))
      .map((entry) => ({
        id: entry.id, team: entry.strFormerTeam,
        joined: entry.strJoined || null, departed: entry.strDeparted || null,
        type: entry.strMoveType || null,
      }))
      .sort((a, b) => (b.joined || '').localeCompare(a.joined || '') || (b.departed || '').localeCompare(a.departed || ''))

    return NextResponse.json({
      transfers,
      source: `https://www.thesportsdb.com/player/${player.idPlayer}`,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '이적 기록을 불러오지 못했습니다.' }, { status: 502 })
  }
}
