'use client'

import { useEffect, useState } from 'react'
import savedPlayerPhotos from '../public/players/manifest.json'

const playerPhotos: Record<string, { image: string }> = savedPlayerPhotos

type League = {
  code: string
  name: string
  englishName: string
  country: string
}

type Standing = {
  position: number

  team: {
    id: number
    name: string
    shortName: string
    crest: string
  }

  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalDifference: number
}

type Scorer = {
  player: {
    id: number
    name: string
    firstName?: string
    lastName?: string
  }

  team: {
    id: number
    name: string
    shortName: string
    crest: string
  }

  playedMatches: number
  goals: number
  assists: number | null
  penalties: number | null
}

type ApiData = {
  competition?: {
    id: number
    name: string
    emblem: string
  }

  season?: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number
  }

  standings?: {
    type: string
    table: Standing[]
  }[]

  scorers?: Scorer[]
}

const leagues: League[] = [
  {
    code: 'PL',
    name: '프리미어리그',
    englishName: 'PREMIER LEAGUE',
    country: '잉글랜드',
  },

  {
    code: 'PD',
    name: '라리가',
    englishName: 'LA LIGA',
    country: '스페인',
  },

  {
    code: 'BL1',
    name: '분데스리가',
    englishName: 'BUNDESLIGA',
    country: '독일',
  },

  {
    code: 'SA',
    name: '세리에 A',
    englishName: 'SERIE A',
    country: '이탈리아',
  },

  {
    code: 'FL1',
    name: '리그 1',
    englishName: 'LIGUE 1',
    country: '프랑스',
  },
]

export default function Home() {
  const [leagueIndex, setLeagueIndex] = useState(0)

  const [leagueData, setLeagueData] = useState<Record<string, ApiData>>({})

  const [initialLoading, setInitialLoading] = useState(true)

  const [error, setError] = useState('')

  const currentLeague = leagues[leagueIndex]

  const data = leagueData[currentLeague.code]

  /*
    =========================
    5대 리그 데이터 가져오기
    =========================
  */

  useEffect(() => {
    async function loadAllLeagues() {
      try {
        setInitialLoading(true)
        setError('')

        const results = await Promise.all(
          leagues.map(async (league) => {
            try {
              const response = await fetch(
                `/api/football?league=${league.code}`,
              )

              const result = await response.json()

              if (!response.ok) {
                console.error(`${league.name} API 오류`, result)

                return {
                  code: league.code,
                  data: null,
                }
              }

              return {
                code: league.code,

                data: result as ApiData,
              }
            } catch (error) {
              console.error(`${league.name} 오류`, error)

              return {
                code: league.code,
                data: null,
              }
            }
          }),
        )

        const newLeagueData: Record<string, ApiData> = {}

        results.forEach((result) => {
          if (result.data) {
            newLeagueData[result.code] = result.data
          }
        })

        setLeagueData(newLeagueData)

        if (!newLeagueData.PL) {
          setError('프리미어리그 데이터를 불러오지 못했습니다.')
        }
      } catch (error) {
        console.error(error)

        setError('축구 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setInitialLoading(false)
      }
    }

    loadAllLeagues()
  }, [])

  /*
    =========================
    자동 리그 변경
    =========================
  */

  /*
    =========================
    순위
    =========================
  */

  const standings =
    data?.standings?.find((standing) => standing.type === 'TOTAL')?.table || []

  const firstPlace = standings[0]

  /*
    =========================
    득점 1위
    =========================
  */

  const topScorer =
    data?.scorers && data.scorers.length > 0
      ? [...data.scorers].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0]
      : null

  /*
    =========================
    도움 1위
    =========================
  */

  const topAssist =
    data?.scorers && data.scorers.length > 0
      ? [...data.scorers].sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0]
      : null

  const currentImages = {
    scorer: topScorer ? playerPhotos[topScorer.player.id]?.image : undefined,
    assist: topAssist ? playerPhotos[topAssist.player.id]?.image : undefined,
  }

  /*
    =========================
    시즌
    =========================
  */

  const seasonStart = data?.season?.startDate
    ? new Date(data.season.startDate).getFullYear()
    : null

  const seasonText = seasonStart
    ? `${seasonStart}/${String(seasonStart + 1).slice(-2)}`
    : ''

  /*
    =========================
    리그 이동
    =========================
  */

  const previousLeague = () => {
    setLeagueIndex((current) => (current - 1 + leagues.length) % leagues.length)
  }

  const nextLeague = () => {
    setLeagueIndex((current) => (current + 1) % leagues.length)
  }

  /*
    =========================
    최초 로딩
    =========================
  */

  if (initialLoading) {
    return (
      <main className="site">
        <header className="header">
          <div className="logo">FOOTBALL DATA</div>

          <nav>
            <a href="/">홈</a>

            <a className="active" href="/matches">
              경기
            </a>

            <a href="#">순위</a>

            <a href="#">선수</a>

            <a href="#">본전 뽑았나?</a>

            <a href="#">라부 예측</a>
          </nav>
        </header>

        <div className="content">
          <section className="loading-box">
            <strong>{error}</strong>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="site">
      {/* HEADER */}

      <header className="header">
        <div className="logo">FOOTBALL DATA</div>

        <nav>
          <a className="active" href="/">
            홈
          </a>

          <a href="/matches">경기</a>

          <a href="#">순위</a>

          <a href="#">선수</a>

          <a href="#">본전 뽑았나?</a>

          <a href="#">라부 예측</a>
        </nav>
      </header>

      <div className="content">
        {/* =========================
            리그
        ========================= */}

        <section className="league-slider">
          <button className="slider-arrow slider-left" onClick={previousLeague}>
            ‹
          </button>

          <div className="league-slide" key={currentLeague.code}>
            <div className="league-logo-box">
              {data?.competition?.emblem ? (
                <img src={data.competition.emblem} alt={currentLeague.name} />
              ) : (
                <div className="logo-loading">⚽</div>
              )}
            </div>

            <div className="league-slide-info">
              <span className="league-country">{currentLeague.country}</span>

              <h1>{currentLeague.name}</h1>

              <p>{currentLeague.englishName}</p>
            </div>

            <div className="league-season">
              <span>SEASON</span>

              <strong>{seasonText || 'CURRENT'}</strong>

              {data?.season?.currentMatchday && (
                <small>
                  {data.season.currentMatchday}
                  라운드
                </small>
              )}
            </div>
          </div>

          <button className="slider-arrow slider-right" onClick={nextLeague}>
            ›
          </button>

          <div className="slider-dots">
            {leagues.map((league, index) => (
              <button
                key={league.code}
                className={
                  index === leagueIndex ? 'slider-dot active' : 'slider-dot'
                }
                onClick={() => setLeagueIndex(index)}
              />
            ))}
          </div>
        </section>

        {!data ? (
          <section className="loading-box">
            <strong>{currentLeague.name} 데이터를 불러오지 못했습니다.</strong>
          </section>
        ) : (
          <>
            {/* =========================
                카드
            ========================= */}

            <section className="summary-grid">
              {/* 리그 1위 */}

              <div className="summary-card">
                <span className="card-label">리그 1위</span>

                <div className="club-info">
                  {firstPlace && (
                    <>
                      <img
                        src={firstPlace.team.crest}
                        alt={firstPlace.team.name}
                      />

                      <strong>
                        {firstPlace.team.shortName || firstPlace.team.name}
                      </strong>
                    </>
                  )}
                </div>

                <p>{firstPlace?.points ?? 0} POINTS</p>
              </div>

              {/* 현재 라운드 */}

              <div className="summary-card">
                <span className="card-label">현재 라운드</span>

                <strong className="big-number">
                  {data.season?.currentMatchday ?? '-'}
                </strong>

                <p>MATCHDAY</p>
              </div>

              {/* 득점 1위 */}

              <div className="summary-card player-card">
                <span className="card-label">득점 1위</span>

                {topScorer ? (
                  <>
                    <div className="player-info">
                      <div className="player-photo-box">
                        <img
                          src={currentImages?.scorer || topScorer.team.crest}
                          alt={topScorer.player.name}
                        />
                      </div>

                      <div className="player-text">
                        <strong>{topScorer.player.name}</strong>

                        <span>
                          {topScorer.team.shortName || topScorer.team.name}
                        </span>
                      </div>
                    </div>

                    <p className="player-stat">
                      <b>{topScorer.goals}</b> GOALS
                    </p>
                  </>
                ) : (
                  <p>데이터 없음</p>
                )}
              </div>

              {/* 도움 1위 */}

              <div className="summary-card player-card">
                <span className="card-label">도움 1위</span>

                {topAssist ? (
                  <>
                    <div className="player-info">
                      <div className="player-photo-box">
                        <img
                          src={currentImages?.assist || topAssist.team.crest}
                          alt={topAssist.player.name}
                        />
                      </div>

                      <div className="player-text">
                        <strong>{topAssist.player.name}</strong>

                        <span>
                          {topAssist.team.shortName || topAssist.team.name}
                        </span>
                      </div>
                    </div>

                    <p className="player-stat">
                      <b>{topAssist.assists ?? 0}</b> ASSISTS
                    </p>
                  </>
                ) : (
                  <p>데이터 없음</p>
                )}
              </div>
            </section>

            {/* =========================
                순위표
            ========================= */}

            <section className="ranking-box">
              <div className="box-header">
                <div>
                  <span className="section-label">STANDINGS</span>

                  <h2>리그 순위</h2>
                </div>

                <div className="ranking-meta">
                  <span>{currentLeague.name}</span>

                  <strong>{seasonText}</strong>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>순위</th>

                      <th className="team-column">클럽</th>

                      <th>경기</th>

                      <th>승</th>

                      <th>무</th>

                      <th>패</th>

                      <th>득실</th>

                      <th>승점</th>
                    </tr>
                  </thead>

                  <tbody>
                    {standings.map((team) => (
                      <tr key={team.team.id}>
                        <td className="rank">{team.position}</td>

                        <td className="team">
                          <img src={team.team.crest} alt={team.team.name} />

                          <strong>
                            {team.team.shortName || team.team.name}
                          </strong>
                        </td>

                        <td>{team.playedGames}</td>

                        <td>{team.won}</td>

                        <td>{team.draw}</td>

                        <td>{team.lost}</td>

                        <td>
                          {team.goalDifference > 0
                            ? `+${team.goalDifference}`
                            : team.goalDifference}
                        </td>

                        <td className="points">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
