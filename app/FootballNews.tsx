'use client'

import { useEffect, useState } from 'react'
import styles from './FootballNews.module.css'
import NewsSummary from './NewsSummary'

const PAGE_SIZE = 5

type Article = { title: string; link: string; source: string; publishedAt: string | null }
export default function FootballNews() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const pageCount = Math.ceil(articles.length / PAGE_SIZE)
  const visibleArticles = articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError('')
      try {
        const response = await fetch('/api/news', { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || '뉴스를 불러오지 못했습니다.')
        }
        setArticles(result.articles)
        setPage(1)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '뉴스를 불러오지 못했습니다.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [attempt])
  return <section className={`ranking-box ${styles.news}`} aria-labelledby="football-news-title" aria-busy={loading}>
    <div className={styles.header}><div><span className={styles.eyebrow}>THE FOOTBALL EDIT</span><h2 id="football-news-title">해외축구 뉴스<span>.</span></h2><p>경기장 밖에서도 계속되는 이야기</p></div><a className={styles.more} href="https://news.google.com/search?q=football&hl=ko&gl=KR&ceid=KR%3Ako" target="_blank" rel="noopener noreferrer">뉴스 더 보기 <span aria-hidden="true">↗</span></a></div>
    {loading ? <div className={styles.state} role="status"><div className="loader" /><p>최신 뉴스를 불러오고 있습니다.</p></div> : error ? <div className={styles.state} role="status"><strong>뉴스를 불러올 수 없습니다</strong><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : !articles.length ? <div className={styles.state}><p>새로운 뉴스가 아직 없습니다.</p></div> : <div className={styles.grid}>{visibleArticles.map((article, index) => <article key={article.link} className={index === 0 ? styles.featured : styles.card}><a href={article.link} target="_blank" rel="noopener noreferrer"><div className={styles.meta}><span>{index === 0 ? (page === 1 ? 'LATEST STORY' : 'MORE STORIES') : String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</span><span aria-hidden="true">↗</span></div><h3>{article.title}</h3>{index === 0 && <NewsSummary key={article.link} link={article.link} />}<div className={styles.byline}><span>{article.source}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(article.publishedAt))}</time>}</div>{index === 0 && <span className={styles.readArticle}>기사 원문 읽기 <span aria-hidden="true">→</span></span>}</a></article>)}</div>}
    {!loading && !error && pageCount > 1 && <nav className={styles.pagination} aria-label="뉴스 페이지">
      <span className={styles.pageInfo} role="status">전체 {articles.length}개 · {page} / {pageCount} 페이지</span>
      <div className={styles.pageButtons}>
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="이전 뉴스 페이지">‹ 이전</button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} aria-label={`뉴스 ${number}페이지`} aria-current={page === number ? 'page' : undefined} className={page === number ? styles.currentPage : ''} onClick={() => setPage(number)}>{number}</button>)}
        <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="다음 뉴스 페이지">다음 ›</button>
      </div>
    </nav>}
    <div className={styles.footer}><span>발행 시간은 한국 시간 기준입니다. Google 뉴스를 통해 기사 원문으로 이동합니다.</span><a href="https://news.google.com/" target="_blank" rel="noopener noreferrer">Google 뉴스에서 더 보기 ↗</a></div>
  </section>
}
