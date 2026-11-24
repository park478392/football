const blockedKoreanWords = [
  '시발', '씨발', '시팔', '씨팔', '시벌', '씨벌', '씹',
  '병신', '븅신', '빙신', '좆', '좃', '개새끼', '새끼', '개새기', '개색기',
  '쌍년', '쌍놈', '개년', '개놈', '지랄', '미친놈', '미친년',
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄹ', 'ㅈ같',
].map(word => word.normalize('NFKC'))

export function normalizeUsername(value: string) {
  return value.trim().normalize('NFC').toLowerCase()
}

export function usernameError(username: string, signup: boolean) {
  const length = Array.from(username).length
  if (!length || length > 20) return '아이디는 공백만으로 만들 수 없으며, 1~20자로 입력해 주세요.'
  if (!signup) return ''

  const normalized = username.normalize('NFKC').toLowerCase()
  const compact = normalized.replace(/[^\p{L}]/gu, '')
  const containsKoreanProfanity = blockedKoreanWords.some(word => compact.includes(word))
  const containsEnglishProfanity = /fuck|shit|bitch|asshole/.test(compact) || /(?:^|[^a-z])cunt(?:$|[^a-z])/.test(normalized)
  return containsKoreanProfanity || containsEnglishProfanity ? '욕설이 포함된 아이디는 사용할 수 없습니다.' : ''
}
