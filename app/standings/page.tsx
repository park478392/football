'use client'

import SiteHeader from '../SiteHeader'

import { useEffect, useState } from 'react'
import styles from './standings.module.css'
import TeamRace from './TeamRace'

const leagues = [
  { code: 'PL', name: '프리미어리그', country: '잉글랜드' },
  { code: 'PD', name: '라리가', country: '스페인' },
  { code: 'BL1', name: '분데스리가', country: '독일' },
  { code: 'SA', name: '세리에 A', country: '이탈리아' },
  { code: 'FL1', name: '리그 1', country: '프랑스' },
]

type Standing = {
  position: number
  team: { id: number; name: string; shortName: string; crest: string | null }
  playedGames: number; won: number; draw: number; lost: number
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number
}
type LeagueData = {
  season: { startDate: string; endDate: string; currentMatchday: number | null }
  standings: { type: string; table: Standing[] }[]
}

export default function StandingsPage() {
  const [league, setLeague] = useState('PL')
  const [data, setData] = useState<LeagueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      setData(null)
      try {
        const response = await fetch(`/api/standings?league=${league}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '순위를 불러오지 못했습니다.')
        setData(result)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '순위를 불러오지 못했습니다.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [league, attempt])

  const selected = leagues.find((item) => item.code === league)!
  const table = data?.standings.find((item) => item.type === 'TOTAL')?.table ?? []
  const rows = table.filter((row) => `${row.team.name} ${row.team.shortName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const season = data ? `${data.season.startDate.slice(0, 4)}/${data.season.endDate.slice(2, 4)}` : '현재 시즌'

  return (
    <div className="site">
      <SiteHeader active="/standings" />
      <main className={styles.main}>
        <div className={styles.hero}>
          <span className="section-label">THE CHASE · 내 팀의 경쟁 상황</span>
          <h1>우리 팀, 어디까지 올라갈까?</h1>
          <p>따라잡아야 할 팀과 지켜야 할 승점. 내 팀을 중심으로 리그를 읽어보세요.</p>
        </div>
        <div className={styles.tabs} aria-label="리그 선택">
          {leagues.map((item) => <button key={item.code} aria-pressed={league === item.code}
            className={league === item.code ? styles.selected : ''}
            onClick={() => { setLeague(item.code); setQuery('') }}>{item.name}</button>)}
        </div>
        <section className="ranking-box" aria-label={`${selected.name} 순위`} aria-busy={loading}>
          <div className="box-header">
            <div><span className="section-label">{selected.country} · {season}</span><h2>{selected.name}</h2></div>
            <div className="ranking-meta"><strong>{data?.season.currentMatchday ? `${data.season.currentMatchday} 라운드` : '시즌 순위'}</strong><span>전체 경기 기준 · 데이터 5분 캐시</span></div>
          </div>
          <div className={styles.toolbar}>
            <span>참가 팀 <strong>{loading || error ? '—' : table.length}</strong></span>
            <label className={styles.search}>팀 검색<input type="search" placeholder="팀 이름을 입력하세요" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          {loading ? <div className={styles.state} role="status"><div className="loader" /><p>리그 순위를 불러오고 있습니다.</p></div>
            : error ? <div className={styles.state} role="alert"><strong>순위를 불러올 수 없습니다</strong><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>
            : !table.length ? <div className={styles.state}><strong>아직 등록된 순위가 없습니다.</strong><p>시즌 데이터가 제공되면 표시됩니다.</p></div>
            : !rows.length ? <div className={styles.state}><strong>검색 결과가 없습니다.</strong><p>다른 팀 이름으로 검색해 주세요.</p></div>
            : <div className="table-wrapper" tabIndex={0} aria-label="가로 스크롤 가능한 리그 순위표">
              <table className={styles.table}>
                <caption className={styles.srOnly}>{selected.name} {season} 전체 순위</caption>
                <thead><tr>{['순위', '팀', '경기', '승', '무', '패', '득점', '실점', '득실차', '승점'].map((title) => <th scope="col" key={title} className={title === '팀' ? 'team-column' : undefined}>{title}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row.team.id}>
                  <td className="rank">{row.position}</td>
                  <th scope="row"><div className="team">{row.team.crest && <img src={row.team.crest} alt="" width={34} height={34} onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}<strong>{row.team.shortName || row.team.name}</strong></div></th>
                  <td>{row.playedGames}</td><td>{row.won}</td><td>{row.draw}</td><td>{row.lost}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td>
                  <td>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td><td className="points">{row.points}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          <p className={styles.note}>승리 3점 · 무승부 1점 · 패배 0점. 동률 및 승점 징계는 리그 공식 순위를 따릅니다.</p>
        </section>
        {!loading && !error && table.length > 0 && <div className={styles.analysis}><TeamRace key={league} league={league} table={table} /></div>}
        <p className={styles.source}>데이터 제공: football-data.org</p>
      </main>
    </div>
  )
}
