import type { Outcome, Pick } from './point-game'
import styles from './standings.module.css'

export default function OutcomeButtons({ pick, isHome, selected = null, disabled = true, probabilities, onSelect }: {
  pick?: Pick; isHome?: boolean; selected?: Outcome | null; disabled?: boolean; probabilities?: number[]; onSelect?: (outcome: Outcome) => void
}) {
  const options: { label: string; outcome: Outcome }[] = isHome === undefined
    ? [{ label: '홈 승리', outcome: 'HOME' }, { label: '무승부', outcome: 'DRAW' }, { label: '원정 승리', outcome: 'AWAY' }]
    : [{ label: '승리', outcome: isHome ? 'HOME' : 'AWAY' }, { label: '무승부', outcome: 'DRAW' }, { label: '패배', outcome: isHome ? 'AWAY' : 'HOME' }]
  return <div className={styles.pickButtons} role="group" aria-label="승리 무승부 패배 예측 결과">{options.map(({ label, outcome }) => {
    const chosen = (pick?.outcome ?? selected) === outcome
    const success = pick?.status === 'WON' && pick.outcome === outcome
    const failure = pick?.status === 'LOST' && pick.actualOutcome === outcome
    return <button type="button" key={outcome} disabled={disabled} aria-pressed={chosen}
      className={[chosen ? styles.pickSelected : '', success ? styles.pickSuccess : '', failure ? styles.pickFailure : '', pick ? styles.resultOutcome : ''].join(' ')}
      onClick={() => onSelect?.(outcome)} aria-label={`${label}${success ? ' 예측 성공!' : failure ? ' 실제 결과, 예측 실패!' : chosen ? ' 나의 선택' : ''}`}>
      {success ? '예측 성공!' : failure ? '예측 실패!' : label}
      {(success || failure) && <small className={styles.optionOdds}>{label}{pick?.finalScore ? ` · ${pick.finalScore}` : ''}</small>}
      {!success && !failure && probabilities && <small className={styles.optionOdds}>{probabilities[outcome === 'HOME' ? 0 : outcome === 'DRAW' ? 1 : 2]}%</small>}
    </button>
  })}</div>
}
