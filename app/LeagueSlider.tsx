'use client'

import { useEffect, useState } from 'react'

export type League = {
  id: number
  name: string
  englishName: string
  country: string
  season: string
  logo: string
}

export const leagues: League[] = [
  {
    id: 39,
    name: '프리미어리그',
    englishName: 'PREMIER LEAGUE',
    country: '잉글랜드',
    season: '2024/25',
    logo: 'https://media.api-sports.io/football/leagues/39.png',
  },
  {
    id: 140,
    name: '라리가',
    englishName: 'LA LIGA',
    country: '스페인',
    season: '2024/25',
    logo: 'https://media.api-sports.io/football/leagues/140.png',
  },
  {
    id: 78,
    name: '분데스리가',
    englishName: 'BUNDESLIGA',
    country: '독일',
    season: '2024/25',
    logo: 'https://media.api-sports.io/football/leagues/78.png',
  },
  {
    id: 135,
    name: '세리에 A',
    englishName: 'SERIE A',
    country: '이탈리아',
    season: '2024/25',
    logo: 'https://media.api-sports.io/football/leagues/135.png',
  },
  {
    id: 61,
    name: '리그 1',
    englishName: 'LIGUE 1',
    country: '프랑스',
    season: '2024/25',
    logo: 'https://media.api-sports.io/football/leagues/61.png',
  },
]

type Props = {
  currentLeague: number
  onLeagueChange: (league: League) => void
}

export default function LeagueSlider({ currentLeague, onLeagueChange }: Props) {
  const currentIndex = leagues.findIndex(
    (league) => league.id === currentLeague,
  )

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % leagues.length

      onLeagueChange(leagues[nextIndex])
    }, 5000)

    return () => clearInterval(timer)
  }, [currentIndex, onLeagueChange])

  const previous = () => {
    const index = currentIndex === 0 ? leagues.length - 1 : currentIndex - 1

    onLeagueChange(leagues[index])
  }

  const next = () => {
    const index = (currentIndex + 1) % leagues.length

    onLeagueChange(leagues[index])
  }

  return (
    <section className="league-slider">
      <div
        className="league-track"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
      >
        {leagues.map((league) => (
          <div className="league-slide" key={league.id}>
            <div className="league-logo-box">
              <img src={league.logo} alt={league.name} />
            </div>

            <div className="league-slide-info">
              <span className="league-country">{league.country}</span>

              <h1>{league.name}</h1>

              <p>{league.englishName}</p>
            </div>

            <div className="league-season">
              <span>SEASON</span>

              <strong>{league.season}</strong>
            </div>
          </div>
        ))}
      </div>

      <button className="slider-arrow slider-left" onClick={previous}>
        ‹
      </button>

      <button className="slider-arrow slider-right" onClick={next}>
        ›
      </button>

      <div className="slider-dots">
        {leagues.map((league) => (
          <button
            key={league.id}
            className={
              league.id === currentLeague ? 'slider-dot active' : 'slider-dot'
            }
            onClick={() => onLeagueChange(league)}
          />
        ))}
      </div>
    </section>
  )
}
