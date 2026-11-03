'use client'

import { useEffect, useState } from 'react'
import { enter, initialWallet, readWallet, settle, rewardMultiplier, payout, saveWallet, type Wallet, type Outcome, type MatchResult } from './point-game'
import styles from './standings.module.css'
import PointShop from './PointShop'
import { items } from './shop'
import OutcomeButtons from './OutcomeButtons'

export default function MyPrediction({ matchId, teamName, isHome, kickoff, league, matchTitle, probabilities }: { matchId: number; teamName: string; isHome: boolean; kickoff: string; league: string; matchTitle: string; probabilities: number[] }) {
  const [wallet, setWallet] = useState<Wallet>(() => { try { return readWallet() } catch { return initialWallet() } })
  const [choice, setChoice] = useState<Outcome | null>(null)
  const [stake, setStake] = useState('100')
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const existing = wallet.picks.find((pick) => pick.matchId === matchId)
  const probabilityFor = (outcome: Outcome) => probabilities[outcome === 'HOME' ? 0 : outcome === 'DRAW' ? 1 : 2]
  const selectedMultiplier = existing?.multiplier ?? (existing ? 2 : choice ? rewardMultiplier(probabilityFor(choice)) : null)
  const projected = selectedMultiplier ? payout(existing?.stake ?? (Number(stake) || 0), selectedMultiplier) : 0
  const locked = now >= Date.parse(kickoff)
  const completed = wallet.picks.filter((pick) => ['WON', 'LOST'].includes(pick.status))
  const wins = completed.filter((pick) => pick.status === 'WON').length
  const pending = wallet.picks.filter((pick) => pick.status === 'PENDING')
  const level = wallet.balance === 0 ? '븅신' : completed.length >= 20 && wins / completed.length >= .7 ? '예측 마스터' : completed.length >= 5 && wins / completed.length >= .5 ? '예측 챌린저' : '예측 루키'
  const equippedTitle = items.find((item) => item.id === wallet.equipped?.title && item.category === 'title')

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    const sync = () => { try { setWallet(readWallet()) } catch { setMessage('저장된 기록을 읽을 수 없습니다.') } }
    window.addEventListener('storage', sync)
    window.addEventListener('football-wallet-change', sync)
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('football-wallet-change', sync) }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const latest = readWallet()
        const leagues = [...new Set(latest.picks.filter((pick) => pick.status === 'PENDING' || (['WON', 'LOST'].includes(pick.status) && !pick.actualOutcome)).map((pick) => pick.league))]
        const groups = await Promise.all(leagues.map(async (code) => {
          const response = await fetch(`/api/standings/results?league=${code}`, { signal: controller.signal })
          if (!response.ok) throw new Error('결과를 가져오지 못했습니다.')
          return (await response.json()).matches as MatchResult[]
        }))
        if (controller.signal.aborted || !leagues.length) return
        const settled = settle(readWallet(), groups.flat())
        saveWallet(settled); setWallet(settled)
      } catch { if (!controller.signal.aborted) setMessage('자동 정산을 완료하지 못했습니다. 결과 확인을 눌러 주세요.') }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60000)
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [])

  function submit() {
    if (!choice) { setMessage('승리·무승부·패배 중 하나를 선택해 주세요.'); return }
    try {
      const next = enter(readWallet(), { matchId, league, title: matchTitle, kickoff, outcome: choice, probability: probabilityFor(choice), stake: Number(stake), isHome, teamName, status: 'PENDING', reward: 0 })
      saveWallet(next); setWallet(next); setMessage('예측을 확정했습니다. 경기 종료 후 결과를 확인해 주세요.')
    } catch (err) { setMessage(err instanceof Error ? err.message : '저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.') }
  }
  async function checkResults() {
    setChecking(true)
    try {
      const latest = readWallet()
      const leagues = [...new Set(latest.picks.filter((pick) => pick.status === 'PENDING' || (['WON', 'LOST'].includes(pick.status) && !pick.actualOutcome)).map((pick) => pick.league))]
      const groups = await Promise.all(leagues.map(async (code) => {
        const response = await fetch(`/api/standings/results?league=${code}`)
        if (!response.ok) throw new Error('결과 조회가 지연됩니다. 잠시 후 다시 시도해 주세요.')
        return (await response.json()).matches as MatchResult[]
      }))
      const next = settle(readWallet(), groups.flat())
      saveWallet(next); setWallet(next); setMessage('결과를 확인했습니다. 종료되지 않은 경기는 대기 중으로 유지됩니다.')
    } catch (err) { setMessage(err instanceof Error ? err.message : '결과를 확인하지 못했습니다.') }
    finally { setChecking(false) }
  }
  return <><div className={styles.myPrediction} data-theme={wallet.equipped?.theme}>
    <div className={styles.pickHeading}><h4>가상 포인트 예측</h4><span>충전·환전 없는 무료 게임</span></div>
    <div className={styles.walletStats} data-frame={wallet.equipped?.frame}><div><span>보유 포인트</span><strong>{wallet.balance.toLocaleString()} P</strong></div><div><span>적중률 · {completed.length}경기</span><strong>{completed.length ? `${Math.round(wins / completed.length * 100)}%` : '—'}</strong></div><div><span>나의 등급</span><strong>{level}</strong>{equippedTitle && <small className={styles.titleBadge} style={{ color: equippedTitle.color }}>{equippedTitle.icon} {equippedTitle.name}</small>}</div></div>
    <p className={styles.gameRule}>시작 1,000P · 예측 확률에 따라 획득 포인트가 달라집니다 · 지급분에 사용 포인트 포함 · 미적중 0P · 취소·연기·중단 시 반환</p>
    <div className={styles.pickHeading}><h4>{teamName} 기준 결과 선택</h4><span>{existing ? '참여 완료' : locked ? '예측 마감' : '경기 시작 전 참여 가능'}</span></div>
    <OutcomeButtons pick={existing} isHome={isHome} selected={choice} disabled={!!existing || locked} probabilities={probabilities} onSelect={setChoice} />
    {selectedMultiplier !== null && <div className={styles.rewardPreview}><span>적중 시 총 지급 <strong>{projected.toLocaleString()}P</strong></span><small>사용분 포함 · 순획득 +{Math.max(0, projected - (existing?.stake ?? (Number(stake) || 0))).toLocaleString()}P</small></div>}
    {!existing && !locked && <div className={styles.stakeRow}><label>사용 포인트<input type="number" min={10} max={Math.min(500, wallet.balance)} step={1} value={stake} onChange={(event) => setStake(event.target.value)} /></label><button type="button" disabled={!choice || wallet.balance < 10} onClick={submit}>예측 확정</button></div>}
    <p className={styles.gameRule}>{existing ? `${existing.stake}P로 참여했습니다. 확정 시 예상 지급 포인트가 유지됩니다.` : '10~500P 참여 가능. 확정 시 포인트가 차감됩니다.'}</p>
    <p className={styles.gameMessage} role="status">{message}</p>
    <div className={styles.pickHeading}><h4>나의 예측 이력 · 대기 {pending.length}건</h4><button className={styles.resultButton} disabled={checking || !pending.length} onClick={checkResults}>{checking ? '확인 중…' : '결과 확인'}</button></div>
    {!wallet.picks.length ? <p className={styles.gameRule}>첫 예측에 참여해 보세요.</p> : <ul className={styles.resultHistory}>{wallet.picks.slice(0, 10).map((pick) => <li key={pick.matchId}><div className={styles.historyHeading}><div><strong>{pick.title}</strong><p>{pick.teamName ? `${pick.teamName} 기준 · ` : '홈·원정 기준 · '}{pick.stake}P{pick.finalScore ? ` · 최종 ${pick.finalScore}` : ''}</p></div><b>{({ PENDING: '결과 대기', WON: `적중 +${pick.reward}P`, LOST: '미적중', VOID: `반환 +${pick.reward}P` })[pick.status]}</b></div><OutcomeButtons pick={pick} isHome={pick.isHome} />{pick.status === 'VOID' && <p className={styles.gameRule}>경기가 취소·연기·중단되어 포인트를 반환했습니다.</p>}</li>)}</ul>}
    <p className={styles.gameRule}>이 브라우저에 저장되는 개인 연습 기록입니다. 현금 가치와 사용자 간 순위는 없으며, 브라우저 데이터를 삭제하면 기록도 사라집니다.</p>
  </div><PointShop wallet={wallet} onChange={setWallet} /></>
}
