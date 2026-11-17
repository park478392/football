'use client'

import { useEffect, useState } from 'react'
import styles from './players.module.css'

type Transfer = {
  id: string
  team: string
  joined: string | null
  departed: string | null
  type: string | null
}

const moveTypes: Record<string, string> = {
  Permanent: '완전 이적', Loan: '임대', Youth: '유소년',
  'Free Transfer': '자유 이적', Free: '자유 이적', 'End of Loan': '임대 복귀',
}

export default function TransferHistory({ name, born, currentTeam }: { name: string; born: string | null; currentTeam: string }) {
  const [data, setData] = useState<{ transfers: Transfer[]; source: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ name, born: born || '' })
        const response = await fetch(`/api/players/transfers?${params}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '이적 기록을 불러오지 못했습니다.')
        if (!controller.signal.aborted) setData(result)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '이적 기록을 불러오지 못했습니다.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [name, born, attempt])

  const latestDeparture = data?.transfers.map((transfer) => transfer.departed)
    .filter((value): value is string => !!value && /^\d{4}/.test(value))
    .sort().at(-1)?.slice(0, 4)

  return <section className={styles.card} aria-labelledby="transfers-title" aria-busy={loading}>
    <div className={styles.cardHeading}><h3 id="transfers-title">이적 기록</h3><span>최근순</span></div>
    <p className={styles.description}>소속팀과 재적 기간</p>
    {loading ? <p className={styles.transferState} role="status">이적 기록을 불러오는 중…</p>
      : error ? <div className={styles.transferState} role="alert"><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>
      : !data?.transfers.length ? <p className={styles.transferState}>등록된 이적 기록이 없습니다.</p>
      : <>
        <ol className={styles.transfers}>
          <li>
            <div><span title="직전 소속팀의 퇴단 연도 기준">{latestDeparture || '합류 연도 미제공'} ~</span><strong>{currentTeam}</strong></div>
            <small>현재 소속</small>
          </li>
          {data.transfers.map((transfer) => <li key={transfer.id}>
            <div><span>{transfer.joined || '합류 연도 미제공'} – {transfer.departed || '퇴단 연도 미제공'}</span><strong>{transfer.team}</strong></div>
            {transfer.type && <small>{moveTypes[transfer.type] || transfer.type}</small>}
          </li>)}
        </ol>
        <p className={styles.note}>데이터 제공 <a href={data.source || 'https://www.thesportsdb.com/'} target="_blank" rel="noreferrer">TheSportsDB</a> · 제공 범위 내 소속 이력</p>
      </>}
  </section>
}
