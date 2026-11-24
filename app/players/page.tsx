'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import SiteHeader from '../SiteHeader'
import TransferHistory from './TransferHistory'
import savedPlayerPhotos from '../../public/players/manifest.json'
import styles from './players.module.css'

const playerPhotos: Record<string, { image: string }> = savedPlayerPhotos
const leagues = [
  { code: 'PL', name: '프리미어리그' },
  { code: 'PD', name: '라리가' },
  { code: 'BL1', name: '분데스리가' },
  { code: 'SA', name: '세리에 A' },
  { code: 'FL1', name: '리그 1' },
]

type PlayerRecord = {
  player: {
    id: number
    name: string
    dateOfBirth: string | null
    nationality: string | null
    section?: string | null
    position: string | null
    shirtNumber: number | null
    photo: string | null
  }
  team: { id: number; name: string; shortName: string; crest: string | null }
  playedMatches: number | null
  goals: number | null
  assists: number | null
  penalties: number | null
  goalRank: number | null
}

type LeagueData = {
  season: { startDate: string; endDate: string }
  teams: PlayerRecord['team'][]
  players: PlayerRecord[]
  statsAvailable: boolean
}

function display(value: number | null | undefined) {
  return value == null ? '미제공' : value.toLocaleString('ko-KR')
}

function perMatch(value: number | null, appearances: number | null) {
  return value != null && appearances != null && appearances > 0 ? value / appearances : null
}

function positionName(player: PlayerRecord['player']) {
  const value = player.position || player.section
  const names: Record<string, string> = {
    Offence: '공격수', Offense: '공격수', Forward: '공격수', Attack: '공격수',
    Midfield: '미드필더', Midfielder: '미드필더',
    Defence: '수비수', Defense: '수비수', Defender: '수비수', Goalkeeper: '골키퍼',
    'Centre-Forward': '중앙 공격수', 'Left Winger': '왼쪽 윙어', 'Right Winger': '오른쪽 윙어',
    'Attacking Midfield': '공격형 미드필더', 'Central Midfield': '중앙 미드필더',
    'Defensive Midfield': '수비형 미드필더', 'Centre-Back': '중앙 수비수',
    'Left-Back': '왼쪽 풀백', 'Right-Back': '오른쪽 풀백',
  }
  return value ? names[value] || value : '미제공'
}

const positionOrder: Record<string, number> = {
  '중앙 공격수': 0,
  '공격수': 0,
  '왼쪽 윙어': 1,
  '오른쪽 윙어': 1,
  '공격형 미드필더': 2,
  '중앙 미드필더': 3,
  '미드필더': 3,
  '수비형 미드필더': 4,
  '중앙 수비수': 5,
  '수비수': 5,
  '왼쪽 풀백': 5,
  '오른쪽 풀백': 5,
  '골키퍼': 6,
}

function age(dateOfBirth: string | null) {
  if (!dateOfBirth) return '미제공'
  const birth = new Date(dateOfBirth)
  if (!Number.isFinite(birth.getTime())) return '미제공'
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const beforeBirthday = today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
  return `${today.getUTCFullYear() - birth.getUTCFullYear() - Number(beforeBirthday)}세`
}

function Portrait({ player, large = false }: { player: PlayerRecord['player']; large?: boolean }) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const { id, name, photo } = player
  const source = [photo, playerPhotos[id]?.image].find((url) => url && !failedSources.includes(url))
  return (
    <div className={large ? styles.portrait : styles.avatar}>
      {source
        ? <Image src={source} alt={large ? name : ''} width={320} height={400} unoptimized loading={large ? 'eager' : 'lazy'} onError={() => setFailedSources((failed) => [...failed, source])} />
        : <span aria-label={`${name} 사진 없음`}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>}
    </div>
  )
}

function PlayerDetails({ record, season, leagueName }: {
  record: PlayerRecord; season: string; leagueName: string
}) {
  const { player, team, goals, assists, penalties, playedMatches } = record
  const contributions = goals != null && assists != null ? goals + assists : null
  const nonPenaltyGoals = goals != null && penalties != null ? goals - penalties : null
  const goalRank = record.goalRank
  const summary = [
    { label: '출전 경기', value: playedMatches, unit: '경기' },
    { label: '득점', value: goals, unit: '골' },
    { label: '도움', value: assists, unit: '개' },
    { label: '공격 포인트', value: contributions, unit: '개' },
  ]

  return (
    <div className={styles.details}>
      <section className={styles.profile} aria-labelledby="player-name">
        <div className={styles.identity}>
          <div className={styles.club}>
            {team.crest && <img src={team.crest} alt="" width={26} height={26} />}
            <span>{team.shortName || team.name}</span>
          </div>
          <h2 id="player-name">{player.name}</h2>
          <p className={styles.position}>{positionName(player)}{player.shirtNumber != null && ` · ${player.shirtNumber}`}</p>
          <dl className={styles.bio}>
            <div><dt>국적</dt><dd>{player.nationality || '미제공'}</dd></div>
            <div><dt>나이</dt><dd>{age(player.dateOfBirth)}</dd></div>
            <div><dt>생년월일</dt><dd>{player.dateOfBirth || '미제공'}</dd></div>
          </dl>
        </div>
        <Portrait key={player.id} player={player} large />
        <div className={styles.profileFooter}><span>{leagueName} · {season}</span><strong>{goalRank == null ? '득점 순위 미제공' : `득점 ${goalRank}위`}</strong></div>
      </section>

      <section className={styles.summary} aria-label="시즌 주요 기록">
        {summary.map((item) => <div key={item.label}>
          <span>{item.label}</span><strong className={item.value == null ? styles.missing : undefined}>{display(item.value)}{item.value != null && <small>{item.unit}</small>}</strong>
        </div>)}
      </section>

      <div className={styles.analysis}>
        <TransferHistory key={player.id} name={player.name} born={player.dateOfBirth} currentTeam={team.shortName || team.name} />

        <section className={styles.card} aria-labelledby="records-title">
          <div className={styles.cardHeading}><h3 id="records-title">시즌 기록</h3><span>{season}</span></div>
          <p className={styles.description}>{leagueName} 기록</p>
          <table className={styles.records}>
            <caption className={styles.srOnly}>{player.name}의 {season} {leagueName} 기록</caption>
            <thead><tr><th scope="col">항목</th><th scope="col">기록</th></tr></thead>
            <tbody>
              {[
                ['출전 경기', display(playedMatches)], ['득점', display(goals)],
                ['도움', display(assists)], ['공격 포인트', display(contributions)],
                ['페널티킥 득점', display(penalties)], ['페널티킥 제외 득점', display(nonPenaltyGoals)],
                ['경기당 득점', perMatch(goals, playedMatches)?.toFixed(2) ?? '미제공'],
              ].map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
            </tbody>
          </table>
          <p className={styles.note}>미제공 항목은 데이터가 확보되면 표시됩니다.</p>
        </section>
      </div>
    </div>
  )
}

function LeaguePlayers({ league }: { league: typeof leagues[number] }) {
  const [data, setData] = useState<LeagueData | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedTeam, setSelectedTeam] = useState('ALL')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/players?league=${league.code}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '선수 정보를 불러오지 못했습니다.')
        if (!controller.signal.aborted) setData(result)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '선수 정보를 불러오지 못했습니다.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [league.code, attempt])

  const records = data?.players ?? []
  const teams = [...(data?.teams ?? [])]
    .sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name))
  const teamRecords = records.filter((record) => selectedTeam === 'ALL' || String(record.team.id) === selectedTeam)
  const search = query.trim().toLocaleLowerCase()
  const filtered = teamRecords
    .filter(({ player, team }) => `${player.name} ${team.name} ${team.shortName}`.toLocaleLowerCase().includes(search))
    .sort((a, b) => (positionOrder[positionName(a.player)] ?? 7) - (positionOrder[positionName(b.player)] ?? 7))
  const selected = filtered.find((record) => record.player.id === selectedId) ?? filtered[0]
  const selectedClub = teams.find((team) => String(team.id) === selectedTeam)
  const season = data?.season ? `${data.season.startDate.slice(0, 4)}/${data.season.endDate.slice(2, 4)}` : '현재 시즌'

  function chooseTeam(id: string) {
    setSelectedTeam(id)
    setSelectedId(null)
    setQuery('')
  }

  if (loading) return <div className={styles.state} role="status"><div className="loader" /><p>선수 정보를 불러오고 있습니다.</p></div>
  if (error) return <div className={styles.state} role="alert"><h2>선수 정보를 불러올 수 없습니다</h2><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>
  if (!records.length) return <div className={styles.state}><h2>등록된 선수 기록이 없습니다.</h2><p>이 리그의 시즌 기록이 제공되면 표시됩니다.</p></div>

  return <>
    <section className={styles.teamPicker} aria-labelledby="team-picker-title">
      <div className={styles.teamPickerHeading}><h2 id="team-picker-title">{league.name} 팀 선택</h2><span>{teams.length}개 팀 · {records.length}명</span></div>
      <div className={styles.teamGrid}>
        <button className={selectedTeam === 'ALL' ? styles.selectedTeam : undefined} aria-pressed={selectedTeam === 'ALL'} onClick={() => chooseTeam('ALL')}>
          <span className={styles.allTeamsIcon} aria-hidden="true">전체</span><span><strong>전체 팀</strong><small>{records.length}명</small></span>
        </button>
        {teams.map((team) => <button key={team.id} className={selectedTeam === String(team.id) ? styles.selectedTeam : undefined} aria-pressed={selectedTeam === String(team.id)} onClick={() => chooseTeam(String(team.id))}>
          <span className={styles.teamCrest}>{team.crest && <Image src={team.crest} alt="" width={30} height={30} unoptimized onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}</span>
          <span><strong>{team.shortName || team.name}</strong><small>{records.filter((record) => record.team.id === team.id).length}명</small></span>
        </button>)}
      </div>
    </section>
    <div className={styles.workspace}>
      <aside className={styles.roster} aria-label="선수 선택">
        <div className={styles.rosterHeading}><h2>{selectedClub ? `${selectedClub.shortName || selectedClub.name} 선수` : '전체 선수'}</h2><span>{filtered.length}명</span></div>
        <label className={styles.search}><span className={styles.srOnly}>선수 또는 팀 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="선수 또는 팀 이름 검색" /></label>
        <p className={styles.rosterNote}>{selectedTeam === 'ALL' ? `리그 등록 선수 ${records.length}명` : `선택한 팀의 등록 선수 ${teamRecords.length}명`} · 포지션순</p>
        <div className={styles.playerList}>
          {filtered.map((record) => <button key={record.player.id} className={selected?.player.id === record.player.id ? styles.activePlayer : styles.playerButton} aria-pressed={selected?.player.id === record.player.id} onClick={() => setSelectedId(record.player.id)}>
            <Portrait player={record.player} />
            <span className={styles.playerName}><strong>{record.player.name}</strong><small>{selectedClub ? positionName(record.player) : record.team.shortName || record.team.name}</small></span>
            <span className={styles.shirtNumber}>{record.player.shirtNumber ?? '—'}<small>등번호</small></span>
          </button>)}
          {!filtered.length && <p className={styles.noResults}>검색 결과가 없습니다.<br />선수의 영문 이름이나 팀 이름으로 검색해 주세요.</p>}
        </div>
      </aside>
      {selected ? <PlayerDetails record={selected} season={season} leagueName={league.name} /> : <div className={styles.state}>선택한 팀에 조회되는 선수가 없습니다. 팀 선택이나 검색어를 변경해 주세요.</div>}
    </div>
    <p className={styles.source}>데이터 제공 <a href="https://www.football-data.org/" target="_blank" rel="noreferrer">football-data.org</a> · {league.name} {season} · 팀별 등록 선수단 기준<br />등번호·사진 <a href="https://www.espn.com/soccer/" target="_blank" rel="noreferrer">ESPN</a> · <a href="https://www.api-football.com/" target="_blank" rel="noreferrer">API-Football</a>{league.code === 'PL' && <> · <a href="https://fantasy.premierleague.com/" target="_blank" rel="noreferrer">Fantasy Premier League</a></>}<br />{data?.statsAvailable ? '시즌 기록은 API 제공 선수에 한해 표시됩니다.' : '시즌 기록을 불러오지 못했습니다. 선수 프로필을 먼저 표시합니다.'}</p>
  </>
}

export default function PlayersPage() {
  const [leagueCode, setLeagueCode] = useState('PL')
  const league = leagues.find((item) => item.code === leagueCode)!
  return <div className="site">
    <SiteHeader active="/players" />
    <main className={styles.main}>
      <div className={styles.hero}><span>PLAYER PROFILE</span><h1>선수의 모든 순간을, 기록으로.</h1><p>프로필부터 이적 이력과 시즌 기록까지 확인하세요.</p></div>
      <div className={styles.tabs} aria-label="리그 선택">{leagues.map((item) => <button key={item.code} className={leagueCode === item.code ? styles.selectedTab : undefined} aria-pressed={leagueCode === item.code} onClick={() => setLeagueCode(item.code)}>{item.name}</button>)}</div>
      <LeaguePlayers key={leagueCode} league={league} />
    </main>
  </div>
}
