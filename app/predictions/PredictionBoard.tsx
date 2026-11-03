'use client'

import { useEffect, useState } from 'react'
import styles from '../standings/standings.module.css'
import { predictMatch } from '../standings/prediction'
import MyPrediction from '../standings/MyPrediction'

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

export default function PredictionBoard({ league, table, homeTable, awayTable }: { league: string; table: Row[]; homeTable: Row[]; awayTable: Row[] }) {
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
  const current = table.find((row) => row.team.id === teamId) || table[0]
  const upcoming = (id: number) => fixtures.find((match) => match.homeTeam.id === id || match.awayTeam.id === id)
  const nextMatch = upcoming(teamId)
  const home = table.find((row) => row.team.id === nextMatch?.homeTeam.id)
  const away = table.find((row) => row.team.id === nextMatch?.awayTeam.id)
  const prediction = home && away ? predictMatch(home, away, homeTable, awayTable, table) : null
  const myHome = nextMatch?.homeTeam.id === teamId
  function choose(id: number) {
    setTeamId(id)
    try { localStorage.setItem(`football-team-${league}`, String(id)) } catch { /* Optional persistence. */ }
  }
  const date = (utc: string) => new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(utc))
  return <section className={styles.race} aria-label="승부 예측">
    <div className={styles.raceHeader}><div><span className="section-label">MATCH PREDICTION</span><h2>내 팀의 다음 경기</h2></div><label>응원 팀 <select value={teamId} onChange={(event) => choose(Number(event.target.value))}>{table.map((row) => <option key={row.team.id} value={row.team.id}>{name(row)}</option>)}</select></label></div>
    <section className={styles.prediction} aria-label="다음 경기 승리 예측" aria-live="polite">
      <div className={styles.panelTitle}><span>NEXT MATCH FORECAST</span><h3>다음 경기, 이길 수 있을까?</h3></div>
      {fixtureState === 'loading' ? <p role="status">다음 경기를 확인하고 있습니다.</p> : fixtureState === 'error' ? <p>경기 일정을 불러오면 예측을 확인할 수 있습니다. <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button></p> : !nextMatch ? <p>예정된 다음 경기가 없습니다.</p> : !prediction || !home || !away ? <p>예측에 필요한 두 팀의 시즌 기록이 아직 충분하지 않습니다.</p> : <>
        <div className={styles.forecastMatch}><div><span>홈 · {home.position}위</span><strong>{name(home)}</strong></div><div className={styles.forecastScore}><span>최빈 스코어</span><b>{prediction.score[0]} : {prediction.score[1]}</b><time dateTime={nextMatch.utcDate}>{date(nextMatch.utcDate)}</time></div><div><span>원정 · {away.position}위</span><strong>{name(away)}</strong></div></div>
        <div className={styles.forecastSummary}><strong>{name(current)} 승리 가능성 {prediction.percentages[myHome ? 0 : 2]}%</strong><span>{myHome ? '홈' : '원정'} 경기 · 시즌 기록 기반 추정</span></div>
        <div className={styles.probabilityBar} aria-hidden="true">{prediction.percentages.map((value, i) => <span key={i} style={{ width: `${value}%` }} />)}</div>
        <div className={styles.probabilityLabels}><span>{name(home)} 승 <b>{prediction.percentages[0]}%</b></span><span>무승부 <b>{prediction.percentages[1]}%</b></span><span>{name(away)} 승 <b>{prediction.percentages[2]}%</b></span></div>
        <MyPrediction key={`${nextMatch.id}-${teamId}`} matchId={nextMatch.id} teamName={name(current)} isHome={myHome} kickoff={nextMatch.utcDate} league={league} matchTitle={`${name(home)} vs ${name(away)}`} probabilities={prediction.percentages} />
        <details className={styles.method}><summary>예측 근거 보기</summary><p>{prediction.venue ? '홈 팀의 홈 성적과 원정 팀의 원정 성적' : '홈·원정 기록이 없는 팀은 시즌 전체 성적'}의 경기당 득점·실점을 사용합니다. 리그 평균 5경기분을 더해 적은 표본의 영향을 줄인 뒤, 포아송 모형으로 스코어별 확률을 계산합니다.</p><p>모형 예상 득점: {name(home)} {prediction.homeMean.toFixed(2)} · {name(away)} {prediction.awayMean.toFixed(2)}. 두 팀 중 적은 시즌 표본: {prediction.sample}경기.</p><p>최빈 스코어는 개별 스코어 중 확률이 가장 높은 값으로, 승·무·패 중 가장 높은 결과와 다를 수 있습니다. 부상·선발·최근 이적은 반영하지 않으며, 정확도를 검증한 예측 모델은 아닙니다.</p></details>
      </>}
    </section>
  </section>
}
