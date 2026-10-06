'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Team = {
  id?: number
  name: string
  shortName: string
  tla: string
  crest: string | null
}

type Match = {
  id: number
  utcDate: string
  koreanDate: string
  koreanTime: string
  status: string
  matchday?: number
  stage?: string

  homeTeam: Team
  awayTeam: Team

  score: {
    winner: string | null
    duration: string | null

    fullTime: {
      home: number | null
      away: number | null
    }

    halfTime: {
      home: number | null
      away: number | null
    }
  }
}

type League = {
  leagueCode: string
  leagueName: string

  competition: {
    id?: number
    code: string
    name: string
    emblem: string | null
  }

  matches: Match[]
}

type ApiResponse = {
  mode: string
  date: string
  timezone: string
  totalMatches: number
  leagues: League[]
}

const leagueTabs = [
  { code: 'ALL', name: '전체' },
  { code: 'PL', name: '프리미어리그' },
  { code: 'PD', name: '라리가' },
  { code: 'BL1', name: '분데스리가' },
  { code: 'SA', name: '세리에 A' },
  { code: 'FL1', name: '리그 1' },
]

/*
  =========================
  한국 기준 오늘 날짜
  =========================
*/

function getTodayKorea() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

/*
  =========================
  날짜 이동
  =========================
*/

function moveDate(dateString: string, amount: number) {
  const [year, month, day] = dateString.split('-').map(Number)

  const date = new Date(Date.UTC(year, month - 1, day))

  date.setUTCDate(date.getUTCDate() + amount)

  return date.toISOString().slice(0, 10)
}

/*
  =========================
  5일 날짜 생성

  선택 날짜 기준
  -2 / -1 / 선택 / +1 / +2
  =========================
*/

function getFiveDates(selectedDate: string) {
  return [-2, -1, 0, 1, 2].map((offset) => {
    return moveDate(selectedDate, offset)
  })
}

/*
  =========================
  날짜 숫자
  =========================
*/

function getDayNumber(dateString: string) {
  return Number(dateString.split('-')[2])
}

/*
  =========================
  월
  =========================
*/

function getMonthNumber(dateString: string) {
  return Number(dateString.split('-')[1])
}

/*
  =========================
  요일
  =========================
*/

function getWeekday(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)

  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date)
}

/*
  =========================
  년 / 월 제목
  =========================
*/

function getMonthTitle(dateString: string) {
  const [year, month] = dateString.split('-').map(Number)

  return `${year}년 ${month}월`
}

/*
  =========================
  오늘인지 확인
  =========================
*/

function isToday(dateString: string) {
  return dateString === getTodayKorea()
}

/*
  =========================
  경기 상태
  =========================
*/

function getStatusText(status: string) {
  switch (status) {
    case 'FINISHED':
      return '경기 종료'

    case 'IN_PLAY':
      return '경기 중'

    case 'PAUSED':
      return '하프타임'

    case 'POSTPONED':
      return '연기'

    case 'CANCELLED':
      return '취소'

    case 'SUSPENDED':
      return '중단'

    default:
      return '경기 예정'
  }
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return <div className="team-logo fallback">⚽</div>
  }

  return (
    <div className="team-logo">
      <img src={src} alt={name} />
    </div>
  )
}

export default function MatchesPage() {
  const [selectedLeague, setSelectedLeague] = useState('ALL')

  const [selectedDate, setSelectedDate] = useState(getTodayKorea())

  const [calendarOpen, setCalendarOpen] = useState(false)

  const [data, setData] = useState<ApiResponse | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  /*
    화면에 표시할 5일
  */

  const fiveDates = useMemo(() => {
    return getFiveDates(selectedDate)
  }, [selectedDate])

  /*
    =========================
    경기 데이터
    =========================
  */

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/matches?league=${selectedLeague}&date=${selectedDate}`,
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '경기 데이터를 불러오지 못했습니다.')
      }

      setData(result)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('경기 데이터를 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedLeague, selectedDate])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMatches()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadMatches])

  /*
    경기 없는 리그 숨김
  */

  const visibleLeagues = useMemo(() => {
    if (!data) {
      return []
    }

    return data.leagues.filter((league) => league.matches.length > 0)
  }, [data])

  /*
    =========================
    날짜 이동
    =========================
  */

  const previousDay = () => {
    setSelectedDate((current) => moveDate(current, -1))
  }

  const nextDay = () => {
    setSelectedDate((current) => moveDate(current, 1))
  }

  const goToday = () => {
    setSelectedDate(getTodayKorea())
    setCalendarOpen(false)
  }

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #f4f7fb;
          color: #172033;
          font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input {
          font-family: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .site {
          min-height: 100vh;
        }

        /*
          =========================
          HEADER
          홈 페이지와 동일한 구조
          =========================
        */

        /*
          =========================
          HERO
          =========================
        */

        .match-hero {
          background:
            radial-gradient(
              circle at 82% 20%,
              rgba(87, 153, 255, 0.18),
              transparent 30%
            ),
            linear-gradient(135deg, #edf5ff, #f9fbff);

          border-bottom: 1px solid #e3ebf5;

          padding: 54px 7% 88px;
        }

        .hero-inner {
          max-width: 1400px;

          margin: 0 auto;
        }

        .hero-label {
          display: block;

          margin-bottom: 10px;

          color: #3478f6;

          font-size: 12px;
          font-weight: 900;

          letter-spacing: 2px;
        }

        .match-hero h1 {
          margin: 0;

          color: #172033;

          font-size: 40px;
          font-weight: 900;

          letter-spacing: -1.5px;
        }

        .match-hero p {
          margin: 13px 0 0;

          color: #748197;

          font-size: 15px;
        }

        /*
          =========================
          MAIN
          =========================
        */

        .match-content {
          max-width: 1400px;

          margin: -42px auto 0;

          padding: 0 30px 80px;

          position: relative;
          z-index: 10;
        }

        .match-panel {
          background: #ffffff;

          border: 1px solid #e1e8f1;

          border-radius: 20px;

          box-shadow: 0 15px 45px rgba(42, 72, 110, 0.09);

          overflow: visible;
        }

        /*
          =========================
          LEAGUE TABS
          =========================
        */

        .league-tabs {
          display: flex;

          align-items: center;

          gap: 8px;

          padding: 22px 26px;

          border-bottom: 1px solid #e9eef5;

          overflow-x: auto;
        }

        .league-tab {
          flex-shrink: 0;

          border: 1px solid #e0e7f0;

          background: #f7f9fc;

          color: #65738a;

          padding: 11px 19px;

          border-radius: 10px;

          font-size: 13px;
          font-weight: 800;

          cursor: pointer;

          transition: 0.2s;
        }

        .league-tab:hover {
          background: #edf4ff;

          border-color: #cadbf7;

          color: #3478f6;
        }

        .league-tab.active {
          background: #3478f6;

          border-color: #3478f6;

          color: white;

          box-shadow: 0 5px 14px rgba(52, 120, 246, 0.2);
        }

        /*
          =========================
          DATE AREA
          =========================
        */

        .date-area {
          padding: 24px 28px 25px;

          border-bottom: 1px solid #e9eef5;

          position: relative;

          z-index: 50;
        }

        .date-top {
          display: flex;

          justify-content: space-between;

          align-items: center;

          margin-bottom: 17px;
        }

        .month-title {
          font-size: 17px;

          font-weight: 900;

          color: #273449;
        }

        .match-count {
          color: #8995a7;

          font-size: 13px;
        }

        .match-count strong {
          color: #3478f6;

          font-size: 17px;

          margin: 0 3px;
        }

        /*
          날짜 전체 줄
        */

        .date-navigation {
          display: grid;

          grid-template-columns:
            44px
            minmax(0, 1fr)
            44px
            auto;

          gap: 10px;

          align-items: stretch;
        }

        /*
          좌우 버튼
        */

        .date-arrow {
          border: 1px solid #dfe6ef;

          background: #ffffff;

          color: #607088;

          border-radius: 12px;

          font-size: 25px;

          cursor: pointer;

          transition: 0.2s;
        }

        .date-arrow:hover {
          background: #edf4ff;

          color: #3478f6;

          border-color: #c7daf8;
        }

        /*
          5일
        */

        .date-list {
          display: grid;

          grid-template-columns: repeat(5, 1fr);

          gap: 7px;
        }

        .date-card {
          min-height: 74px;

          border: 1px solid #e1e7ef;

          background: #f9fbfd;

          border-radius: 12px;

          cursor: pointer;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          transition: 0.2s;

          position: relative;
        }

        .date-card:hover {
          background: #f0f6ff;

          border-color: #c8daf7;

          transform: translateY(-1px);
        }

        .date-card.active {
          background: #3478f6;

          border-color: #3478f6;

          box-shadow: 0 7px 18px rgba(52, 120, 246, 0.2);
        }

        .date-card-month {
          color: #a0aaba;

          font-size: 10px;

          font-weight: 700;

          margin-bottom: 3px;
        }

        .date-card-day {
          color: #29364a;

          font-size: 20px;

          font-weight: 900;

          line-height: 1;
        }

        .date-card-weekday {
          color: #8b97a9;

          font-size: 11px;

          font-weight: 700;

          margin-top: 6px;
        }

        .date-card.active .date-card-month,
        .date-card.active .date-card-day,
        .date-card.active .date-card-weekday {
          color: white;
        }

        /*
          오늘 표시
        */

        .today-dot {
          position: absolute;

          top: 7px;
          right: 8px;

          width: 6px;
          height: 6px;

          border-radius: 50%;

          background: #3478f6;
        }

        .date-card.active .today-dot {
          background: white;
        }

        /*
          오늘 + 달력
        */

        .date-actions {
          display: flex;

          gap: 7px;

          position: relative;
        }

        .today-button {
          min-width: 62px;

          border: 1px solid #dfe6ef;

          background: white;

          color: #586980;

          border-radius: 11px;

          padding: 0 14px;

          font-size: 13px;

          font-weight: 800;

          cursor: pointer;

          transition: 0.2s;
        }

        .today-button:hover {
          background: #edf4ff;

          color: #3478f6;

          border-color: #c7daf8;
        }

        .calendar-wrapper {
          position: relative;
        }

        .calendar-button {
          width: 46px;
          height: 100%;

          min-height: 74px;

          border: 1px solid #dfe6ef;

          background: white;

          color: #50617a;

          border-radius: 11px;

          cursor: pointer;

          font-size: 19px;

          transition: 0.2s;
        }

        .calendar-button:hover,
        .calendar-button.active {
          background: #edf4ff;

          border-color: #c7daf8;
        }

        /*
          =========================
          CALENDAR POPUP
          =========================
        */

        .calendar-popup {
          position: absolute;

          top: calc(100% + 10px);

          right: 0;

          width: 260px;

          padding: 17px;

          background: white;

          border: 1px solid #dfe6ef;

          border-radius: 14px;

          box-shadow: 0 18px 45px rgba(30, 53, 88, 0.18);

          z-index: 999;
        }

        .calendar-title {
          margin-bottom: 11px;

          color: #35435a;

          font-size: 13px;

          font-weight: 900;
        }

        .calendar-input {
          width: 100%;

          padding: 11px 12px;

          border: 1px solid #dbe4ef;

          background: #f8fafd;

          border-radius: 9px;

          color: #253349;

          font-size: 14px;

          outline: none;

          cursor: pointer;
        }

        .calendar-input:focus {
          border-color: #3478f6;

          box-shadow: 0 0 0 3px rgba(52, 120, 246, 0.1);
        }

        .calendar-today {
          width: 100%;

          margin-top: 9px;

          padding: 10px;

          border: 0;

          border-radius: 8px;

          background: #edf4ff;

          color: #3478f6;

          font-size: 12px;

          font-weight: 900;

          cursor: pointer;
        }

        /*
          =========================
          MATCH CONTENT
          =========================
        */

        .games-content {
          min-height: 450px;

          padding: 28px;
        }

        /*
          =========================
          LEAGUE SECTION
          =========================
        */

        .league-section {
          margin-bottom: 24px;

          border: 1px solid #e2e8f0;

          border-radius: 16px;

          background: white;

          overflow: hidden;
        }

        .league-section:last-child {
          margin-bottom: 0;
        }

        .league-header {
          min-height: 66px;

          padding: 13px 21px;

          display: flex;

          align-items: center;

          gap: 13px;

          background: linear-gradient(90deg, #f7faff, #ffffff);

          border-bottom: 1px solid #e8edf4;
        }

        .league-emblem {
          width: 37px;
          height: 37px;

          object-fit: contain;
        }

        .league-emblem-placeholder {
          width: 37px;
          height: 37px;

          display: flex;

          align-items: center;

          justify-content: center;

          border-radius: 9px;

          background: #edf4ff;
        }

        .league-name {
          color: #253249;

          font-size: 16px;

          font-weight: 900;
        }

        .league-game-count {
          margin-left: auto;

          color: #909bae;

          font-size: 12px;
        }

        /*
          =========================
          MATCH ROW
          =========================
        */

        .match-row {
          min-height: 112px;

          padding: 18px 38px;

          display: grid;

          grid-template-columns:
            minmax(220px, 1fr)
            150px
            minmax(220px, 1fr);

          align-items: center;

          border-bottom: 1px solid #edf1f5;

          transition: 0.2s;
        }

        .match-row:last-child {
          border-bottom: none;
        }

        .match-row:hover {
          background: #f8fbff;
        }

        /*
          팀
        */

        .match-team {
          display: flex;

          align-items: center;

          gap: 16px;
        }

        .match-team.home {
          justify-content: flex-end;

          text-align: right;
        }

        .match-team.away {
          justify-content: flex-start;
        }

        .team-logo {
          width: 52px;
          height: 52px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;
        }

        .team-logo img {
          max-width: 100%;
          max-height: 100%;

          object-fit: contain;
        }

        .team-logo.fallback {
          border-radius: 50%;

          background: #edf3fb;

          font-size: 23px;
        }

        .team-name {
          color: #1d293c;

          font-size: 15px;

          font-weight: 900;
        }

        .team-code {
          margin-top: 5px;

          color: #9aa5b5;

          font-size: 10px;

          font-weight: 700;
        }

        /*
          중앙
        */

        .match-center {
          text-align: center;
        }

        .match-time {
          color: #1d2b40;

          font-size: 21px;

          font-weight: 900;
        }

        .match-status {
          margin-top: 6px;

          color: #929dae;

          font-size: 10px;

          font-weight: 800;
        }

        .match-status.live {
          color: #e94f5f;
        }

        /*
          점수
        */

        .score {
          display: flex;

          align-items: center;

          justify-content: center;

          gap: 11px;
        }

        .score-number {
          width: 38px;
          height: 38px;

          display: flex;

          align-items: center;

          justify-content: center;

          border-radius: 9px;

          background: #edf4ff;

          color: #286ce7;

          font-size: 21px;

          font-weight: 900;
        }

        .score-divider {
          color: #99a5b6;

          font-size: 17px;

          font-weight: 900;
        }

        /*
          =========================
          STATES
          =========================
        */

        .state-box {
          min-height: 390px;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          text-align: center;
        }

        .state-icon {
          width: 68px;
          height: 68px;

          margin-bottom: 17px;

          display: flex;

          align-items: center;

          justify-content: center;

          border-radius: 20px;

          background: #edf4ff;

          font-size: 30px;
        }

        .state-title {
          color: #28364b;

          font-size: 17px;

          font-weight: 900;
        }

        .state-description {
          margin-top: 7px;

          color: #8c98aa;

          font-size: 13px;
        }

        .state-title.error {
          color: #db4d5a;
        }

        /*
          로딩
        */

        .loader {
          width: 37px;
          height: 37px;

          margin-bottom: 17px;

          border: 4px solid #e4ecf7;

          border-top-color: #3478f6;

          border-radius: 50%;

          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /*
          =========================
          RESPONSIVE
          =========================
        */

        @media (max-width: 1000px) {
          .date-navigation {
            grid-template-columns: 42px minmax(0, 1fr) 42px;
          }

          .date-actions {
            grid-column: 1 / -1;

            justify-content: flex-end;
          }

          .calendar-button {
            height: 42px;
            min-height: 42px;
          }

          .today-button {
            height: 42px;
          }

          .match-row {
            grid-template-columns: 1fr 100px 1fr;

            padding: 18px;
          }
        }

        @media (max-width: 760px) {
          .match-hero {
            padding: 40px 20px 75px;
          }

          .match-hero h1 {
            font-size: 31px;
          }

          .match-content {
            padding: 0 14px 60px;
          }

          .league-tabs {
            padding: 17px;
          }

          .date-area {
            padding: 20px 15px;
          }

          .date-list {
            gap: 4px;
          }

          .date-card {
            min-height: 67px;
          }

          .date-card-month {
            display: none;
          }

          .date-card-day {
            font-size: 17px;
          }

          .games-content {
            padding: 15px;
          }

          .match-row {
            grid-template-columns: 1fr 72px 1fr;

            padding: 17px 8px;
          }

          .match-team {
            gap: 7px;
          }

          .match-team.home {
            flex-direction: column-reverse;

            text-align: center;
          }

          .match-team.away {
            flex-direction: column;

            text-align: center;
          }

          .team-logo {
            width: 42px;
            height: 42px;
          }

          .team-name {
            font-size: 11px;
          }

          .team-code {
            display: none;
          }

          .match-time {
            font-size: 16px;
          }

          .score {
            gap: 4px;
          }

          .score-number {
            width: 29px;
            height: 29px;

            font-size: 16px;
          }
        }
      `}</style>

      <main className="site">
        {/* =========================
            HEADER
        ========================= */}

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

        {/* =========================
            HERO
        ========================= */}

        <section className="match-hero">
          <div className="hero-inner">
            <span className="hero-label">MATCH CENTER</span>

            <h1>경기 일정</h1>

            <p>5대 리그의 경기 일정과 결과를 날짜별로 확인하세요.</p>
          </div>
        </section>

        {/* =========================
            CONTENT
        ========================= */}

        <div className="match-content">
          <section className="match-panel">
            {/* =========================
                LEAGUE TABS
            ========================= */}

            <div className="league-tabs">
              {leagueTabs.map((league) => (
                <button
                  key={league.code}
                  className={
                    selectedLeague === league.code
                      ? 'league-tab active'
                      : 'league-tab'
                  }
                  onClick={() => setSelectedLeague(league.code)}
                >
                  {league.name}
                </button>
              ))}
            </div>

            {/* =========================
                DATE
            ========================= */}

            <section className="date-area">
              <div className="date-top">
                <div className="month-title">{getMonthTitle(selectedDate)}</div>

                <div className="match-count">
                  총 <strong>{data?.totalMatches ?? 0}</strong>
                  경기
                </div>
              </div>

              <div className="date-navigation">
                {/* 이전 하루 */}

                <button
                  className="date-arrow"
                  onClick={previousDay}
                  aria-label="이전 날짜"
                >
                  ‹
                </button>

                {/* 5일 */}

                <div className="date-list">
                  {fiveDates.map((date) => (
                    <button
                      key={date}
                      className={
                        date === selectedDate ? 'date-card active' : 'date-card'
                      }
                      onClick={() => setSelectedDate(date)}
                    >
                      {isToday(date) && <span className="today-dot" />}

                      <span className="date-card-month">
                        {getMonthNumber(date)}월
                      </span>

                      <strong className="date-card-day">
                        {getDayNumber(date)}
                      </strong>

                      <span className="date-card-weekday">
                        {getWeekday(date)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 다음 하루 */}

                <button
                  className="date-arrow"
                  onClick={nextDay}
                  aria-label="다음 날짜"
                >
                  ›
                </button>

                {/* 오늘 / 달력 */}

                <div className="date-actions">
                  <button className="today-button" onClick={goToday}>
                    오늘
                  </button>

                  <div className="calendar-wrapper">
                    <button
                      className={
                        calendarOpen
                          ? 'calendar-button active'
                          : 'calendar-button'
                      }
                      onClick={() => setCalendarOpen((current) => !current)}
                      aria-label="달력 열기"
                    >
                      📅
                    </button>

                    {calendarOpen && (
                      <div className="calendar-popup">
                        <div className="calendar-title">날짜 선택</div>

                        <input
                          className="calendar-input"
                          type="date"
                          value={selectedDate}
                          onChange={(event) => {
                            if (!event.target.value) {
                              return
                            }

                            setSelectedDate(event.target.value)
                            setCalendarOpen(false)
                          }}
                        />

                        <button className="calendar-today" onClick={goToday}>
                          오늘로 이동
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* =========================
                GAMES
            ========================= */}

            <div className="games-content">
              {/* 로딩 */}

              {loading && (
                <div className="state-box">
                  <div className="loader" />

                  <div className="state-title">경기 정보를 불러오는 중...</div>

                  <div className="state-description">잠시만 기다려주세요.</div>
                </div>
              )}

              {/* 오류 */}

              {!loading && error && (
                <div className="state-box">
                  <div className="state-icon">!</div>

                  <div className="state-title error">
                    데이터를 불러오지 못했습니다.
                  </div>

                  <div className="state-description">{error}</div>
                </div>
              )}

              {/* 경기 없음 */}

              {!loading && !error && visibleLeagues.length === 0 && (
                <div className="state-box">
                  <div className="state-icon">⚽</div>

                  <div className="state-title">예정된 경기가 없습니다.</div>

                  <div className="state-description">
                    다른 날짜를 선택해보세요.
                  </div>
                </div>
              )}

              {/* 리그별 경기 */}

              {!loading &&
                !error &&
                visibleLeagues.map((league) => (
                  <section className="league-section" key={league.leagueCode}>
                    {/* 리그 제목 */}

                    <div className="league-header">
                      {league.competition.emblem ? (
                        <img
                          className="league-emblem"
                          src={league.competition.emblem}
                          alt={league.leagueName}
                        />
                      ) : (
                        <div className="league-emblem-placeholder">⚽</div>
                      )}

                      <div className="league-name">{league.leagueName}</div>

                      <div className="league-game-count">
                        {league.matches.length}경기
                      </div>
                    </div>

                    {/* 경기 */}

                    {league.matches.map((match) => (
                      <div className="match-row" key={match.id}>
                        {/* 홈 */}

                        <div className="match-team home">
                          <div>
                            <div className="team-name">
                              {match.homeTeam.shortName || match.homeTeam.name}
                            </div>

                            <div className="team-code">
                              {match.homeTeam.tla}
                            </div>
                          </div>

                          <TeamLogo
                            src={match.homeTeam.crest}
                            name={match.homeTeam.name}
                          />
                        </div>

                        {/* 중앙 */}

                        <div className="match-center">
                          {match.status === 'FINISHED' ? (
                            <>
                              <div className="score">
                                <span className="score-number">
                                  {match.score.fullTime.home ?? '-'}
                                </span>

                                <span className="score-divider">:</span>

                                <span className="score-number">
                                  {match.score.fullTime.away ?? '-'}
                                </span>
                              </div>

                              <div className="match-status">경기 종료</div>
                            </>
                          ) : (
                            <>
                              <div className="match-time">
                                {match.koreanTime}
                              </div>

                              <div
                                className={
                                  match.status === 'IN_PLAY'
                                    ? 'match-status live'
                                    : 'match-status'
                                }
                              >
                                {getStatusText(match.status)}
                              </div>
                            </>
                          )}
                        </div>

                        {/* 원정 */}

                        <div className="match-team away">
                          <TeamLogo
                            src={match.awayTeam.crest}
                            name={match.awayTeam.name}
                          />

                          <div>
                            <div className="team-name">
                              {match.awayTeam.shortName || match.awayTeam.name}
                            </div>

                            <div className="team-code">
                              {match.awayTeam.tla}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
