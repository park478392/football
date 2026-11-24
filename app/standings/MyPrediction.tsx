'use client'

import { useEffect, useState } from 'react'
import { rewardMultiplier, payout, type Outcome } from './point-game'
import { useAccount } from '../AccountProvider'
import styles from './standings.module.css'
import { items } from './shop'
import OutcomeButtons from './OutcomeButtons'

export default function MyPrediction({ matchId, teamId, teamName, isHome, kickoff, league, probabilities }: { matchId: number; teamId: number; teamName: string; isHome: boolean; kickoff: string; league: string; probabilities: number[] }) {
  const { user, wallet, pending: busy, perform, error, refresh, openAuth } = useAccount()
  const [choice, setChoice] = useState<Outcome | null>(null)
  const [stake, setStake] = useState('100')
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const accountId = user?.id
  const walletReady = !!wallet

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!accountId || !walletReady) return
    let active = true
    async function update() {
      try { await perform({ action: 'settle' }) }
      catch (err) {
        if (active && err instanceof Error && !err.message.includes('이전 요청')) setMessage(err.message)
      }
    }
    void update()
    const timer = setInterval(() => { void update() }, 60000)
    const focus = () => { void update() }
    window.addEventListener('focus', focus)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [accountId, walletReady, perform])

  if (!user) return <div className={styles.state}><p>로그인하고 승부 예측에 참여해 보세요.</p><button onClick={() => openAuth('login')}>로그인</button></div>
  if (!wallet) return <div className={styles.state}><p>{error || '계정 포인트를 불러오고 있습니다.'}</p>{error && <button onClick={() => { void refresh() }}>다시 시도</button>}</div>

  const existing = wallet.picks.find(pick => pick.matchId === matchId)
  const probabilityFor = (outcome: Outcome) => probabilities[outcome === 'HOME' ? 0 : outcome === 'DRAW' ? 1 : 2]
  const selectedMultiplier = existing?.multiplier ?? (existing ? 2 : choice ? rewardMultiplier(probabilityFor(choice)) : null)
  const projected = selectedMultiplier ? payout(existing?.stake ?? (Number(stake) || 0), selectedMultiplier) : 0
  const locked = now >= Date.parse(kickoff)
  const completed = wallet.picks.filter(pick => ['WON', 'LOST'].includes(pick.status))
  const wins = completed.filter(pick => pick.status === 'WON').length
  const pending = wallet.picks.filter(pick => pick.status === 'PENDING')
  const level = completed.length >= 20 && wins / completed.length >= .7 ? '예측 마스터' : completed.length >= 5 && wins / completed.length >= .5 ? '예측 챌린저' : '예측 루키'
  const equippedTitle = items.find(item => item.id === wallet.equipped?.title && item.category === 'title')

  async function submit() {
    if (!choice) { setMessage('승리·무승부·패배 중 하나를 선택해 주세요.'); return }
    try {
      await perform({ action: 'predict', matchId, league, teamId, outcome: choice, stake: Number(stake) })
      setMessage('예측을 확정했습니다. 경기 종료 후 결과를 확인해 주세요.')
    } catch (err) { setMessage(err instanceof Error ? err.message : '예측을 저장하지 못했습니다.') }
  }
  async function checkResults() {
    setChecking(true)
    try {
      await perform({ action: 'settle' })
      setMessage('결과를 확인했습니다. 진행 중인 경기는 결과를 기다립니다.')
    } catch (err) { setMessage(err instanceof Error ? err.message : '결과를 확인하지 못했습니다.') }
    finally { setChecking(false) }
  }
  return <div className={styles.myPrediction} data-theme={wallet.equipped?.theme}>
    <div className={styles.pickHeading}><h4>가상 포인트 예측</h4><span>충전·환전 없는 무료 게임</span></div>
    <div className={styles.walletStats} data-frame={wallet.equipped?.frame}><div><span>보유 포인트</span><strong>{wallet.balance.toLocaleString()} P</strong></div><div><span>적중률 · {completed.length}경기</span><strong>{completed.length ? `${Math.round(wins / completed.length * 100)}%` : '—'}</strong></div><div><span>나의 등급</span><strong>{level}</strong>{equippedTitle && <small className={styles.titleBadge} style={{ color: equippedTitle.color }}>{equippedTitle.icon} {equippedTitle.name}</small>}</div></div>
    <p className={styles.gameRule}>시작 1,000P · 예측 확률에 따라 획득 포인트가 달라집니다 · 지급분에 사용 포인트 포함 · 미적중 0P · 취소·연기·중단 시 반환</p>
    <div className={styles.pickHeading}><h4>{teamName} 기준 결과 선택</h4><span>{existing ? '참여 완료' : locked ? '예측 마감' : '경기 시작 전 참여 가능'}</span></div>
    <OutcomeButtons pick={existing} isHome={isHome} selected={choice} disabled={busy || !!existing || locked} probabilities={probabilities} onSelect={setChoice} />
    {selectedMultiplier !== null && <div className={styles.rewardPreview}><span>적중 시 총 지급 <strong>{projected.toLocaleString()}P</strong></span><small>사용분 포함 · 순획득 +{Math.max(0, projected - (existing?.stake ?? (Number(stake) || 0))).toLocaleString()}P</small></div>}
    {!existing && !locked && <div className={styles.stakeRow}><label>사용 포인트<input type="number" min={10} max={Math.min(500, wallet.balance)} step={1} value={stake} onChange={(event) => setStake(event.target.value)} /></label><button type="button" disabled={busy || !choice || wallet.balance < 10} onClick={submit}>예측 확정</button></div>}
    <p className={styles.gameRule}>{existing ? `${existing.stake}P로 참여했습니다. 확정 시 예상 지급 포인트가 유지됩니다.` : '10~500P 참여 가능. 확정 시 포인트가 차감됩니다.'}</p>
    <p className={styles.gameMessage} role="status">{message}</p>
    <div className={styles.pickHeading}><h4>나의 예측 이력 · 대기 {pending.length}건</h4><button className={styles.resultButton} disabled={busy || checking || !pending.length} onClick={checkResults}>{checking ? '확인 중…' : '결과 확인'}</button></div>
    {!wallet.picks.length ? <p className={styles.gameRule}>첫 예측에 참여해 보세요.</p> : <ul className={styles.resultHistory}>{wallet.picks.slice(0, 10).map((pick) => <li key={pick.matchId}><div className={styles.historyHeading}><div><strong>{pick.title}</strong><p>{pick.teamName ? `${pick.teamName} 기준 · ` : '홈·원정 기준 · '}{pick.stake}P{pick.finalScore ? ` · 최종 ${pick.finalScore}` : ''}</p></div><b>{({ PENDING: '결과 대기', WON: `적중 +${pick.reward}P`, LOST: '미적중', VOID: `반환 +${pick.reward}P` })[pick.status]}</b></div><OutcomeButtons pick={pick} isHome={pick.isHome} />{pick.status === 'VOID' && <p className={styles.gameRule}>경기가 취소·연기·중단되어 포인트를 반환했습니다.</p>}</li>)}</ul>}
    <p className={styles.gameRule}>예측 기록과 포인트는 로그인한 계정에 저장됩니다. 모은 포인트로 닉네임·포인터·칭호를 구매할 수 있습니다.</p>
  </div>
}
