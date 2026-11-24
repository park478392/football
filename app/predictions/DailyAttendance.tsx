'use client'

import { useEffect, useState } from 'react'
import { koreaDate } from '../standings/point-game'
import { useAccount } from '../AccountProvider'
import styles from '../standings/standings.module.css'

export default function DailyAttendance() {
  const { user, wallet, pending, perform } = useAccount()
  const [today, setToday] = useState(() => koreaDate())
  const [message, setMessage] = useState('')
  useEffect(() => {
    const sync = () => setToday(koreaDate())
    const timer = setInterval(sync, 30000)
    window.addEventListener('focus', sync)
    return () => { clearInterval(timer); window.removeEventListener('focus', sync) }
  }, [])
  const claimed = !!wallet?.lastAttendance && wallet.lastAttendance >= today
  async function claim() {
    try {
      await perform({ action: 'attendance' })
      setToday(koreaDate()); setMessage('출석 완료! 계정에 100P가 지급되었습니다.')
    } catch (err) { setMessage(err instanceof Error ? err.message : '출석 보상을 저장하지 못했습니다.') }
  }
  if (!user) return null
  return <section className={styles.attendance} aria-label="매일 출석 보상"><div className={styles.attendanceIcon} aria-hidden="true">✓</div><div className={styles.attendanceText}><span className="section-label">DAILY CHECK-IN</span><h2>매일 출석하고 <b>100P</b> 받기</h2><p>한국 시간 자정에 초기화 · 하루 한 번, 버튼을 눌러 받아보세요.</p><p role="status">{message || (claimed ? '오늘 보상을 받았습니다. 내일 다시 만나요!' : '출석 포인트는 예측과 상점에서 사용할 수 있습니다.')}</p></div><div className={styles.attendanceAction}><strong>{wallet ? `${wallet.balance.toLocaleString()} P` : '— P'}</strong><button onClick={claim} disabled={!wallet || pending || claimed}>{pending ? '처리 중…' : claimed ? '오늘 출석 완료 ✓' : '출석하기 +100P'}</button></div></section>
}
