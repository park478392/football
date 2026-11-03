function normalize(title: string) {
  return title.toLowerCase().replace(/\[[^\]]*\]/g, ' ')
    .replace(/(\d+)\s*(?:라운드|r\b)/g, '$1라운드')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function sameStory(first: string, second: string) {
  const a = normalize(first)
  const b = normalize(second)
  if (a === b) return true
  const words = (value: string) => new Set(value.split(/\s+/).filter((word) => word.length >= 2))
  const left = words(a)
  const right = words(b)
  const common = [...left].filter((word) => right.has(word)).length
  // Require several shared words so one team/player name alone never merges stories.
  if (common >= 4 && common / Math.min(left.size, right.size) >= .6) return true
  const grams = (value: string) => {
    const compact = value.replace(/\s/g, '')
    return new Set(Array.from({ length: Math.max(0, compact.length - 2) }, (_, index) => compact.slice(index, index + 3)))
  }
  const x = grams(a)
  const y = grams(b)
  const shared = [...x].filter((gram) => y.has(gram)).length
  return shared >= 10 && shared / Math.min(x.size, y.size) >= .78
}

export function distinctStories<T extends { title: string }>(articles: T[], limit: number) {
  const selected: T[] = []
  for (const article of articles) {
    if (!selected.some((other) => sameStory(other.title, article.title))) selected.push(article)
    if (selected.length === limit) break
  }
  return selected
}
