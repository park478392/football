'use client'

import SiteHeader from '../SiteHeader'

import { useEffect, useState } from 'react'
import PredictionBoard from './PredictionBoard'
import DailyAttendance from './DailyAttendance'
import styles from '../standings/standings.module.css'

const leagues = [
  { code: 'PL', name: '프리미어리그' }, { code: 'PD', name: '라리가' },
  { code: 'BL1', name: '분데스리가' }, { code: 'SA', name: '세리에 A' }, { code: 'FL1', name: '리그 1' },
]
type Row = { position: number; team: { id: number; name: string; shortName: string; crest: string | null }; points: number; playedGames: number; goalsFor: number; goalsAgainst: number }
type Data = { standings: { type: string; table: Row[] }[] }

export default function PredictionsPage() {
  const [league, setLeague] = useState('PL')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError(''); setData(null)
      try {
        const response = await fetch(`/api/standings?league=${league}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '예측 데이터를 불러오지 못했습니다.')
        if (!controller.signal.aborted) setData(result)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '예측 데이터를 불러오지 못했습니다.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [league, attempt])
  const table = data?.standings.find((item) => item.type === 'TOTAL')?.table ?? []
  return <div className="site">
    <SiteHeader active="/predictions" />
    <main className={styles.main}><div className={styles.hero}><span className="section-label">PICK YOUR WINNER</span><h1>승부 예측</h1><p>다음 경기의 승·무·패를 예측하고 가상 포인트로 도전해 보세요.</p></div>
      <DailyAttendance />
      <div className={styles.tabs} aria-label="리그 선택">{leagues.map((item) => <button key={item.code} aria-pressed={league === item.code} className={league === item.code ? styles.selected : ''} onClick={() => setLeague(item.code)}>{item.name}</button>)}</div>
      {loading ? <div className={styles.state} role="status"><div className="loader" /><p>경기 예측을 준비하고 있습니다.</p></div>
        : error ? <div className={styles.state} role="alert"><strong>예측 정보를 불러올 수 없습니다</strong><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>
        : !table.length ? <div className={styles.state}><p>아직 시즌 기록이 없습니다.</p></div>
        : <PredictionBoard key={league} league={league} table={table} homeTable={data?.standings.find((item) => item.type === 'HOME')?.table ?? []} awayTable={data?.standings.find((item) => item.type === 'AWAY')?.table ?? []} />}
      <p className={styles.source}>가상 포인트 전용 · 데이터 제공: football-data.org</p>
    </main>
  </div>
}
