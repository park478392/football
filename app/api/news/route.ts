import { NextResponse } from 'next/server'
import { distinctStories } from './deduplicate'

function decode(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const point = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code)
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
    })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
}
function tag(xml: string, name: string) {
  return decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '')
}
export async function GET() {
  try {
    const params = new URLSearchParams({ q: '(프리미어리그 OR 챔피언스리그 OR 라리가 OR 분데스리가 OR "세리에 A" OR "리그 1") 축구 -K리그 -K리그1 -K리그2 when:7d', hl: 'ko', gl: 'KR', ceid: 'KR:ko' })
    const response = await fetch(`https://news.google.com/rss/search?${params}`, {
      next: { revalidate: 900 }, signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error('News feed unavailable')
    const xml = await response.text()
    if (!xml.includes('<rss')) throw new Error('Invalid news feed')
    const seen = new Set<string>()
    const articles = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap((match) => {
      const item = match[1]
      const source = tag(item, 'source')
      let title = tag(item, 'title')
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3).trim()
      const link = tag(item, 'link')
      try { if (new URL(link).protocol !== 'https:') return [] } catch { return [] }
      if (!title || seen.has(title) || seen.has(link)) return []
      seen.add(title); seen.add(link)
      const timestamp = Date.parse(tag(item, 'pubDate'))
      return [{ title, link, source: source || 'Google 뉴스', publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null }]
    }).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    return NextResponse.json({ articles: distinctStories(articles, 10) })
  } catch {
    return NextResponse.json({ error: '뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
  }
}
