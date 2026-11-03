// Google News RSS uses an intermediate page; resolve its signed article ID.
// This endpoint is undocumented, so failures must leave the original link usable.
export async function resolveArticle(link: string): Promise<string | null> {
  const url = new URL(link)
  if (url.hostname !== 'news.google.com' || url.protocol !== 'https:') return null
  const id = url.pathname.match(/^\/(?:rss\/)?articles\/([\w-]+)$/)?.[1]
  if (!id) return null
  const page = await fetch(link, { signal: AbortSignal.timeout(10000), next: { revalidate: 3600 } })
  if (!page.ok) return null
  const html = await page.text()
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
  const timestamp = Number(html.match(/data-n-a-ts="(\d+)"/)?.[1])
  if (!signature || !timestamp) return null
  const payload = ['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, timestamp, signature]
  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', JSON.stringify(payload), null, 'generic']]]) }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) return null
  const body = await response.text()
  for (const line of body.split('\n')) {
    if (!line.startsWith('[[')) continue
    const frames = JSON.parse(line) as unknown[][]
    const frame = frames.find((item) => item[0] === 'wrb.fr' && item[1] === 'Fbv4je')
    if (typeof frame?.[2] !== 'string') continue
    const decoded = JSON.parse(frame[2])
    if (decoded[0] !== 'garturlres' || typeof decoded[1] !== 'string') continue
    const target = new URL(decoded[1])
    if (target.protocol !== 'https:' || target.hostname === 'news.google.com') return null
    return target.href
  }
  return null
}
