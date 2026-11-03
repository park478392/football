'use client'

import { useEffect, useState } from 'react'
import styles from './standings.module.css'

type Row = {
  position: number
  team: { id: number; name: string; shortName: string; crest: string | null }
  points: number
  playedGames: number
  goalsFor: number
  goalsAgainst: number
}
type Fixture = {
  id: number; utcDate: string
  homeTeam: { id: number; name: string; shortName?: string }
  awayTeam: { id: number; name: string; shortName?: string }
}
const name = (row: Row) => row.team.shortName || row.team.name

export default function TeamRace({ league, table }: { league: string; table: Row[] }) {
  const [teamId, setTeamId] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`football-team-${league}`))
      if (table.some((row) => row.team.id === saved)) return saved
    } catch { /* Team selection also works without browser storage. */ }
    return table[0].team.id
  })
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [fixtureState, setFixtureState] = useState('loading')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setFixtureState('loading')
      try {
        const response = await fetch(`/api/standings/fixtures?league=${league}`, { signal: controller.signal })
        if (!response.ok) throw new Error('fixtures')
        const result = await response.json()
        if (!controller.signal.aborted) { setFixtures(result.matches); setFixtureState('ready') }
      } catch {
        if (!controller.signal.aborted) setFixtureState('error')
      }
    }
    void load()
    return () => controller.abort()
  }, [league, retry])
  const index = table.findIndex((row) => row.team.id === teamId)
  const current = table[index] || table[0]
  const above = table[index - 1]
  const below = table[index + 1]
  const rivals = table.slice(Math.max(0, index - 2), Math.min(table.length, index + 3))
  const min = Math.min(...table.map((row) => row.points))
  const max = Math.max(...table.map((row) => row.points))
  const upcoming = (id: number) => fixtures.find((match) => match.homeTeam.id === id || match.awayTeam.id === id)
  const meeting = fixtures.find((match) =>
    (match.homeTeam.id === teamId && [above?.team.id, below?.team.id].includes(match.awayTeam.id)) ||
    (match.awayTeam.id === teamId && [above?.team.id, below?.team.id].includes(match.homeTeam.id)))
  function choose(id: number) {
    setTeamId(id)
    try { localStorage.setItem(`football-team-${league}`, String(id)) } catch { /* Optional persistence. */ }
  }
  const date = (utc: string) => new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(utc))
  return <section className={styles.race} aria-label="내 팀 추격전">
    <div className={styles.raceHeader}>
      <div><span className="section-label">MY TEAM, MY RACE</span><h2>내 팀의 추격전</h2></div>
      <label>응원 팀 <select value={teamId} onChange={(event) => choose(Number(event.target.value))}>{table.map((row) => <option key={row.team.id} value={row.team.id}>{name(row)}</option>)}</select></label>
    </div>
    <div className={styles.raceCards} aria-live="polite">
      <article><span>따라잡을 팀</span><h3>{above ? name(above) : '우리가 리그 선두'}</h3><strong>{above ? `${above.points - current.points}점 차` : '1위'}</strong><p>{above ? `${above.position}위 · ${above.points}점 · ${above.playedGames}경기` : '추격을 따돌리고 선두를 지켜보세요.'}</p></article>
      <article className={styles.myTeam}><span>MY TEAM</span><h3>{name(current)}</h3><strong>{current.position}위 <small>· {current.points}점</small></strong><p>{current.playedGames}경기 · 선두와 {max - current.points}점 차</p></article>
      <article><span>뒤쫓는 팀</span><h3>{below ? name(below) : '이제 올라갈 차례'}</h3><strong>{below ? `${current.points - below.points}점 차` : '추격 시작'}</strong><p>{below ? `${below.position}위 · ${below.points}점 · ${below.playedGames}경기` : '바로 위 팀과의 간격을 좁혀보세요.'}</p></article>
    </div>
    <div className={styles.raceGrid}>
      <div className={styles.map}>
        <div className={styles.panelTitle}><h3>승점 추격 지도</h3><span>팀을 누르면 중심 팀이 바뀝니다</span></div>
        <div className={styles.axis}><span>{min}점</span><span>리그 전체 승점 범위</span><span>{max}점</span></div>
        {table.map((row) => <button key={row.team.id} className={`${styles.mapRow} ${row.team.id === teamId ? styles.mapActive : ''}`} aria-pressed={row.team.id === teamId} onClick={() => choose(row.team.id)}>
          <span className={styles.mapName}><small>{row.position}</small>{name(row)}</span>
          <span className={styles.track}><span className={styles.dot} style={{ left: `${max === min ? 50 : (row.points - min) / (max - min) * 100}%` }} /></span><b>{row.points}</b>
        </button>)}
        <p className={styles.explanation}>가로 위치는 실제 승점 간격입니다. 같은 승점의 팀은 같은 위치에 표시됩니다.</p>
      </div>
      <div className={styles.fixtures}>
        <div className={styles.panelTitle}><h3>경쟁 팀의 다음 경기</h3><span>한국 시간 기준</span></div>
        {fixtureState === 'loading' ? <p className={styles.explanation} role="status">경기 일정을 불러오고 있습니다.</p> : fixtureState === 'error' ? <div className={styles.explanation}>일정을 불러오지 못했습니다. <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div> : <>
          {rivals.map((row) => {
            const match = upcoming(row.team.id)
            const opponent = match && (match.homeTeam.id === row.team.id ? match.awayTeam : match.homeTeam)
            return <div key={row.team.id} className={`${styles.fixture} ${row.team.id === teamId ? styles.fixtureActive : ''}`}><strong>{name(row)} {row.team.id === teamId && <small>내 팀</small>}</strong>{match && opponent ? <><p><span>{match.homeTeam.id === row.team.id ? '홈' : '원정'}</span> vs {opponent.shortName || opponent.name}</p><time dateTime={match.utcDate}>{date(match.utcDate)}</time></> : <p>확정된 다음 경기가 없습니다.</p>}</div>
          })}
          <div className={styles.meeting}><span>승점 간격을 바꿀 맞대결</span>{meeting ? <><strong>{meeting.homeTeam.shortName || meeting.homeTeam.name} vs {meeting.awayTeam.shortName || meeting.awayTeam.name}</strong><time dateTime={meeting.utcDate}>{date(meeting.utcDate)}</time></> : <p>바로 위·아래 팀과의 예정된 맞대결이 없습니다.</p>}</div>
        </>}
      </div>
    </div>
    <p className={styles.explanation}>승점 차는 현재 기록 기준이며, 경기 수 차이와 동률 순위 규정에 따라 실제 추월 조건은 달라집니다.</p>
  </section>
}
