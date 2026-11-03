'use client'

import { useEffect, useState } from 'react'
import styles from './FootballNews.module.css'

export default function NewsSummary({ link }: { link: string }) {
  const [result, setResult] = useState<{ summary?: string; message?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/news/summary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link }), signal: controller.signal,
        })
        const data = await response.json()
        if (!controller.signal.aborted) setResult(data)
      } catch {
        if (!controller.signal.aborted) setResult({ message: '요약을 불러오지 못했습니다. 원문에서 확인해 주세요.' })
      }
    }
    void load()
    return () => controller.abort()
  }, [link])
  return <div className={styles.summary} aria-live="polite"><span>✦ AI 핵심 요약</span><p>{result?.summary || result?.message || '기사 본문을 확인하고 요약하고 있습니다…'}</p>{result?.summary && <small>Gemini가 생성한 요약입니다. 정확한 내용은 원문을 확인해 주세요.</small>}</div>
}
