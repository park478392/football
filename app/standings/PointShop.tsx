'use client'

import { useState } from 'react'
import { items, type Category } from './shop'
import { useAccount, UserIdentity } from '../AccountProvider'
import styles from './standings.module.css'

const categories = [
  { id: 'name', name: '닉네임' },
  { id: 'cursor', name: '포인터' },
  { id: 'title', name: '칭호' },
  { id: 'frame', name: '프레임' },
  { id: 'theme', name: '카드 테마' },
] as const
const tabs = [{ id: 'all', name: '전체' }, ...categories] as const

export default function PointShop() {
  const { user, wallet, pending, perform } = useAccount()
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [message, setMessage] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  async function act(id: string, buying: boolean) {
    try {
      const next = await perform({ action: buying ? 'purchase' : 'equip', itemId: id })
      setConfirmId(null)
      const item = items.find((candidate) => candidate.id === id)!
      setMessage(buying ? `${item.name} 구매 완료! 바로 장착했습니다.` : next.equipped?.[item.category] === id ? `${item.name} 장착 완료` : `${item.name} 장착 해제`)
    } catch (err) { setMessage(err instanceof Error ? err.message : '아이템을 저장하지 못했습니다.') }
  }
  if (!user || !wallet) return null
  return <section className={styles.shop} aria-label="포인트 상점">
    <div className={styles.shopHeader}><div><span className="section-label">POINT SHOP</span><h3>예측의 보상, 나만의 스타일</h3><p>닉네임 장식·마우스 포인터·칭호를 구매하고 장착하세요.</p></div><strong>{wallet.balance.toLocaleString()} P</strong></div>
    <div className={styles.shopProfile}><span>내 스타일</span><UserIdentity /></div>
    <div className={styles.shopTabs} aria-label="아이템 종류">{tabs.map((tab) => <button key={tab.id} aria-pressed={category === tab.id} onClick={() => { setCategory(tab.id); setConfirmId(null) }}>{tab.name}</button>)}<span>보유 {wallet.inventory?.length ?? 0} / {items.length}</span></div>
    {categories.filter((group) => category === 'all' || group.id === category).map((group) => <section key={group.id} className={styles.shopGroup}>
      <h4 className={styles.shopGroupTitle}>{group.name}</h4>
      <div className={styles.shopGrid}>{items.filter((item) => item.category === group.id).map((item) => {
        const owned = wallet.inventory?.includes(item.id)
        const active = wallet.equipped?.[item.category] === item.id
        return <article key={item.id} className={styles.shopItem}>
          <div className={styles.itemPreview} style={{ color: item.color, borderColor: item.category === 'frame' ? item.color : undefined, background: `${item.color}0d` }}>{item.category === 'name' ? <span className="user-name" data-name-style={item.id} style={{ fontSize: 16 }}>{user.username}</span> : <span aria-hidden="true">{item.icon}</span>}<small>{item.category === 'title' ? item.name : item.category === 'cursor' ? '마우스 포인터' : item.category === 'name' ? '내 닉네임' : item.category === 'frame' ? 'MY PROFILE' : 'MATCH DAY'}</small></div>
          <h5>{item.name}</h5><p>{item.description}</p><div className={styles.itemBottom}><strong>{owned ? '보유 중' : `${item.price.toLocaleString()} P`}</strong><button disabled={pending || (!owned && wallet.balance < item.price)} aria-pressed={owned ? active : undefined} onClick={() => owned ? void act(item.id, false) : setConfirmId(item.id)}>{active ? '장착 해제' : owned ? '장착하기' : wallet.balance < item.price ? '포인트 부족' : '구매하기'}</button></div>
          {confirmId === item.id && <div className={styles.purchaseConfirm} role="group" aria-label={`${item.name} 구매 확인`}><p>{item.price.toLocaleString()}P 사용 · 남은 포인트 {Math.max(0, wallet.balance - item.price).toLocaleString()}P</p><button disabled={pending} onClick={() => { void act(item.id, true) }}>구매 확정</button><button disabled={pending} onClick={() => setConfirmId(null)}>취소</button></div>}
        </article>
      })}</div>
    </section>)}
    <p className={styles.gameMessage} role="status">{message}</p><p className={styles.gameRule}>아이템은 꾸미기 전용이며 예측 확률과 획득 포인트에 영향을 주지 않습니다. 구매 시 바로 장착되고 종류별로 하나씩 적용됩니다.</p>
  </section>
}
