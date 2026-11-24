import type { Wallet } from './point-game'

export type Category = 'title' | 'frame' | 'theme' | 'name' | 'cursor'
export const items: { id: string; category: Category; name: string; description: string; price: number; icon: string; color: string }[] = [
  { id: 'name-blue', category: 'name', name: '블루 플레이메이커', description: '로그인한 내 이름을 푸른빛으로 꾸밉니다', price: 200, icon: 'Aa', color: '#60a5fa' },
  { id: 'name-gold', category: 'name', name: '골든 부트', description: '닉네임에 득점왕 트로피처럼 황금빛 광택을 더합니다', price: 800, icon: 'Aa', color: '#eab308' },
  { id: 'name-rainbow', category: 'name', name: '더비의 불꽃', description: '닉네임에 여러 색이 이어지는 그라데이션을 적용합니다', price: 1500, icon: 'Aa', color: '#a78bfa' },
  { id: 'name-pitch', category: 'name', name: '그린 피치', description: '닉네임을 경기장 잔디처럼 초록빛으로 꾸밉니다', price: 400, icon: 'Aa', color: '#4ade80' },
  { id: 'cursor-crosshair', category: 'cursor', name: '프리킥 조준 포인터', description: '프리킥의 방향을 겨누는 십자 모양 포인터', price: 200, icon: '⌖', color: '#2563eb' },
  { id: 'cursor-ball', category: 'cursor', name: '축구공 포인터', description: '마우스 포인터를 축구공으로 바꿉니다', price: 400, icon: '⚽', color: '#0d9488' },
  { id: 'cursor-star', category: 'cursor', name: '경기 MVP 포인터', description: '마우스 포인터를 경기 최우수 선수의 황금 별로 바꿉니다', price: 700, icon: '⭐', color: '#eab308' },
  { id: 'cursor-trophy', category: 'cursor', name: '우승컵 포인터', description: '마우스 포인터를 우승컵으로 바꿉니다', price: 900, icon: '🏆', color: '#b88b18' },
  { id: 'fan', category: 'title', name: '직관러', description: '축구 사랑을 보여주는 첫 칭호', price: 100, icon: '⚽', color: '#3478f6' },
  { id: 'tactician', category: 'title', name: '전술가', description: '경기의 흐름을 읽는 전략가', price: 500, icon: '♟', color: '#7c3aed' },
  { id: 'underdog', category: 'title', name: '역배의 신', description: '모두의 예상을 뒤집는 한 수', price: 1500, icon: '⚡', color: '#ea580c' },
  { id: 'owner', category: 'title', name: '구단주', description: '남다른 존재감을 위한 칭호', price: 5000, icon: '♛', color: '#b88b18' },
  { id: 'silver', category: 'frame', name: '실버 메달 프레임', description: '내 이름과 개인 기록 카드에 은빛 테두리', price: 200, icon: '🥈', color: '#94a3b8' },
  { id: 'gold', category: 'frame', name: '우승 메달 프레임', description: '개인 기록 카드에 황금빛 테두리', price: 1000, icon: '🥇', color: '#d4a528' },
  { id: 'emerald', category: 'frame', name: '플래티넘 프레임', description: '청록빛 금속 테두리와 은은한 광택', price: 1800, icon: '❖', color: '#0d9488' },
  { id: 'champion', category: 'frame', name: '다이아몬드 프레임', description: '얼음빛 블루 테두리와 보석 같은 광채', price: 2500, icon: '✦', color: '#38a8e8' },
  { id: 'mint', category: 'theme', name: '민트 피치', description: '예측 카드를 산뜻한 민트색으로', price: 300, icon: '◒', color: '#0d9488' },
  { id: 'sunset', category: 'theme', name: '선셋 킥오프', description: '따뜻한 오렌지빛 예측 카드', price: 500, icon: '☀', color: '#ea8b38' },
  { id: 'midnight', category: 'theme', name: '나이트 매치', description: '야간 경기를 닮은 남색 예측 카드', price: 800, icon: '☾', color: '#395281' },
  { id: 'lavender', category: 'theme', name: '라벤더 더비', description: '은은한 보랏빛으로 물든 예측 카드', price: 600, icon: '✿', color: '#9b6bd3' },
]

export function purchase(wallet: Wallet, id: string): Wallet {
  const item = items.find((candidate) => candidate.id === id)
  if (!item) throw new Error('존재하지 않는 아이템입니다.')
  if (wallet.inventory?.includes(id)) throw new Error('이미 보유한 아이템입니다.')
  if (wallet.balance < item.price) throw new Error('포인트가 부족합니다.')
  return { ...wallet, balance: wallet.balance - item.price, inventory: [...(wallet.inventory ?? []), id], equipped: { ...wallet.equipped, [item.category]: id } }
}

export function equip(wallet: Wallet, id: string): Wallet {
  const item = items.find((candidate) => candidate.id === id)
  if (!item || !wallet.inventory?.includes(id)) throw new Error('보유한 아이템만 장착할 수 있습니다.')
  const equipped = { ...wallet.equipped }
  if (equipped[item.category] === id) delete equipped[item.category]
  else equipped[item.category] = id
  return { ...wallet, equipped }
}
