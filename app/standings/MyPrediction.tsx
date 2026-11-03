'use client'

import { useState } from 'react'
import styles from './standings.module.css'

type Outcome = 'HOME' | 'DRAW' | 'AWAY'

export default function MyPrediction({ matchId, teamName, isHome }: { matchId: number; teamName: string; isHome: boolean }) {
  const storageKey = `football-prediction-${matchId}`
  const [choice, setChoice] = useState<Outcome | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'HOME' || saved === 'DRAW' || saved === 'AWAY') return saved
    } catch { /* Browser storage is optional. */ }
    return null
  })
  const [storageFailed, setStorageFailed] = useState(false)
  const options: { label: string; value: Outcome }[] = [
    { label: '승리', value: isHome ? 'HOME' : 'AWAY' },
    { label: '무승부', value: 'DRAW' },
    { label: '패배', value: isHome ? 'AWAY' : 'HOME' },
  ]
  function select(value: Outcome | null) {
    setChoice(value)
    try {
      if (value) localStorage.setItem(storageKey, value)
      else localStorage.removeItem(storageKey)
      setStorageFailed(false)
    } catch { setStorageFailed(true) }
  }
  return <div className={styles.myPrediction}>
    <div className={styles.pickHeading}><h4>나의 경기 예측</h4><span>{teamName} 기준</span></div>
    <div className={styles.pickButtons} role="group" aria-label={`${teamName}의 다음 경기 결과 예측`}>
      {options.map((option) => <button type="button" key={option.value} aria-pressed={choice === option.value}
        className={choice === option.value ? styles.pickSelected : ''} onClick={() => select(option.value)}>
        {option.label}{choice === option.value && <span aria-hidden="true"> ✓</span>}
      </button>)}
    </div>
    <div className={styles.pickFeedback}>
      <p role="status">{choice ? `${teamName} ${options.find((option) => option.value === choice)?.label} 예측${storageFailed ? '을 선택했습니다. 이 브라우저에 저장할 수 없어 현재 화면에서만 유지됩니다.' : '을 이 브라우저에 저장했습니다.'}` : '경기 결과를 예상해 보세요. 선택은 언제든 바꿀 수 있습니다.'}</p>
      {choice && <button type="button" onClick={() => select(null)}>선택 취소</button>}
    </div>
  </div>
}
