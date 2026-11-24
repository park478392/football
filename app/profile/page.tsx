'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import SiteHeader from '../SiteHeader'
import { useAccount, UserIdentity } from '../AccountProvider'
import { profileLeagues, type Club, type LeagueStandings, type ProfileLeague } from './teams'
import styles from './profile.module.css'

function TeamPicker({ league }: { league: ProfileLeague }) {
  const { wallet, pending, perform } = useAccount()
  const [clubs, setClubs] = useState<Club[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [choice, setChoice] = useState('')
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const favorite = wallet?.favoriteTeam

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/standings?league=${league}`, { signal: controller.signal })
        if (!response.ok) throw new Error('팀 목록을 불러오지 못했습니다.')
        const data: LeagueStandings = await response.json()
        const teams = data.standings.find((group) => group.type === 'TOTAL')?.table.map(({ team }) => team)
        if (!teams?.length) throw new Error('선택한 리그의 팀 목록이 비어 있습니다.')
        if (!controller.signal.aborted) setClubs(teams.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : '팀 목록을 불러오지 못했습니다.')
      }
    }
    void load()
    return () => controller.abort()
  }, [league, attempt])

  async function save(teamId: number | null) {
    setNotice('')
    setSaveError('')
    try {
      await perform({ action: 'favoriteTeam', league, teamId })
      setChoice('')
      setNotice(teamId === null ? '응원 팀 설정을 해제했습니다.' : '응원 팀을 저장했습니다.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '응원 팀을 저장하지 못했습니다.')
    }
  }

  const savedId = favorite?.league === league ? favorite.id : undefined
  const availableSavedId = clubs?.some((club) => club.id === savedId) ? String(savedId) : ''
  const selectedId = choice || availableSavedId

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedId) void save(Number(selectedId))
  }

  return <>
    <form className={styles.form} onSubmit={submit}>
      <label>팀<select value={selectedId} onChange={(event) => { setChoice(event.target.value); setNotice(''); setSaveError('') }} disabled={!clubs || pending} required>
        <option value="" disabled>{clubs ? '팀 선택' : loadError ? '팀 목록 미제공' : '팀 불러오는 중…'}</option>
        {clubs?.map((club) => <option key={club.id} value={club.id}>{club.shortName || club.name}</option>)}
      </select></label>
      <button type="submit" disabled={pending || !wallet || !selectedId || Number(selectedId) === savedId}>저장</button>
      {favorite && <button type="button" className={styles.secondary} disabled={pending} onClick={() => { void save(null) }}>설정 해제</button>}
    </form>
    {loadError && <p className={styles.error} role="alert">{loadError} <button type="button" className={styles.secondary} onClick={() => { setLoadError(''); setAttempt((value) => value + 1) }}>다시 시도</button></p>}
    {saveError && <p className={styles.error} role="alert">{saveError}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </>
}

function ProfileSettings() {
  const { wallet, pending } = useAccount()
  const [selectedLeague, setSelectedLeague] = useState<ProfileLeague | null>(null)
  const favorite = wallet?.favoriteTeam
  const league = selectedLeague ?? favorite?.league ?? 'PL'
  const favoriteLeague = profileLeagues.find((candidate) => candidate.code === favorite?.league)

  return <section className={styles.settings} aria-labelledby="favorite-team">
    <h2 id="favorite-team">응원 팀</h2>
    <div className={styles.current}>
      {favorite?.crest && <Image src={favorite.crest} alt="" width={42} height={42} unoptimized />}
      <div><strong>{favorite?.name ?? '설정된 응원 팀 없음'}</strong>{favoriteLeague && <small>{favoriteLeague.name}</small>}</div>
    </div>
    <label className={styles.league}>리그<select value={league} disabled={pending} onChange={(event) => {
      const next = profileLeagues.find((candidate) => candidate.code === event.target.value)
      if (next) setSelectedLeague(next.code)
    }}>
      {profileLeagues.map((candidate) => <option key={candidate.code} value={candidate.code}>{candidate.name}</option>)}
    </select></label>
    <TeamPicker key={league} league={league} />
  </section>
}

export default function ProfilePage() {
  const { user, wallet, loading, error, openAuth, refresh } = useAccount()

  return <div className="site">
    <SiteHeader active="/profile" />
    <main className={styles.main}>
      <h1>내 프로필</h1>
      {loading ? <p className={styles.state} role="status">프로필을 불러오는 중…</p> : <>
        {error && <p className={styles.error} role="alert">{error} <button type="button" className={styles.secondary} onClick={() => { void refresh() }}>다시 시도</button></p>}
        {user ? <>
          <div className={styles.identity}>
            <UserIdentity />
            {wallet && <span>보유 포인트 <strong>{wallet.balance.toLocaleString('ko-KR')} P</strong></span>}
          </div>
          <ProfileSettings key={user.id} />
        </> : <div className={styles.state}>
          <p>로그인하면 프로필을 보고 응원 팀을 설정할 수 있습니다.</p>
          <button type="button" onClick={() => openAuth('login')}>로그인</button>
        </div>}
      </>}
    </main>
  </div>
}
