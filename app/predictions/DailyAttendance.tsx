'use client'

import { useEffect, useState } from 'react'
import { claimAttendance, koreaDate, readWallet, saveWallet, type Wallet } from '../standings/point-game'
import styles from '../standings/standings.module.css'

export default function DailyAttendance() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [today, setToday] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const sync = () => {
      setToday(koreaDate())
      try { setWallet(readWallet()) } catch { setMessage('출석 기록을 읽을 수 없습니다. 브라우저 저장 공간을 확인해 주세요.') }
    }
    const initial = setTimeout(sync, 0)
    const timer = setInterval(sync, 30000)
    window.addEventListener('storage', sync)
    window.addEventListener('football-wallet-change', sync)
    window.addEventListener('focus', sync)
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('football-wallet-change', sync); window.removeEventListener('focus', sync) }
  }, [])
  const claimed = !!wallet?.lastAttendance && wallet.lastAttendance >= today
  async function claim() {
    setBusy(true)
    try {
      const award = () => {
        const next = claimAttendance(readWallet())
        saveWallet(next); setWallet(next); setToday(koreaDate()); setMessage('출석 완료! 100P가 지급되었습니다.')
      }
      if (navigator.locks) await navigator.locks.request('football-daily-attendance', award)
      else award()
    } catch (err) { setMessage(err instanceof Error ? err.message : '출석 보상을 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className={styles.attendance} aria-label="매일 출석 보상"><div className={styles.attendanceIcon} aria-hidden="true">✓</div><div className={styles.attendanceText}><span className="section-label">DAILY CHECK-IN</span><h2>매일 출석하고 <b>100P</b> 받기</h2><p>한국 시간 자정에 초기화 · 하루 한 번, 버튼을 눌러 받아보세요.</p><p role="status">{message || (claimed ? '오늘 보상을 받았습니다. 내일 다시 만나요!' : '출석 포인트는 예측과 상점에서 사용할 수 있습니다.')}</p></div><div className={styles.attendanceAction}><strong>{wallet ? `${wallet.balance.toLocaleString()} P` : '— P'}</strong><button onClick={claim} disabled={!wallet || busy || claimed}>{busy ? '지급 중…' : claimed ? '오늘 출석 완료 ✓' : '출석하기 +100P'}</button></div></section>
}
