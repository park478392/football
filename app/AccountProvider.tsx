'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AccountUser } from './api/auth/store'
import type { Wallet, Outcome } from './standings/point-game'
import { items } from './standings/shop'
import type { ProfileLeague } from './profile/teams'

export type { AccountUser } from './api/auth/store'
type Action = { action: 'purchase' | 'equip'; itemId: string }
  | { action: 'attendance' | 'settle' }
  | { action: 'favoriteTeam'; league: ProfileLeague; teamId: number | null }
  | { action: 'predict'; league: string; matchId: number; outcome: Outcome; stake: number; teamId: number }
type AccountContext = {
  user: AccountUser | null
  wallet: Wallet | null
  loading: boolean
  pending: boolean
  error: string
  authDialog: 'login' | 'signup' | null
  openAuth(mode: 'login' | 'signup'): void
  closeAuth(): void
  authenticated(user: AccountUser | null): Promise<void>
  refresh(): Promise<void>
  perform(action: Action): Promise<Wallet>
}
const Context = createContext<AccountContext | null>(null)

function broadcast(key: string) {
  try { localStorage.setItem(key, `${Date.now()}-${Math.random()}`) } catch { /* Account storage is on the server. */ }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [authDialog, setAuthDialog] = useState<'login' | 'signup' | null>(null)
  const epoch = useRef(0)
  const activeUser = useRef<AccountUser | null>(null)
  const actionPending = useRef(false)
  const applyWallet = useCallback((incoming: Wallet) => {
    setWallet(current => !current || (incoming.revision ?? 0) >= (current.revision ?? 0) ? incoming : current)
  }, [])

  const refreshWallet = useCallback(async (generation: number) => {
    const response = await fetch('/api/game', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '포인트 정보를 불러오지 못했습니다.')
    if (epoch.current === generation && activeUser.current?.id === result.userId) applyWallet(result.wallet)
  }, [applyWallet])

  const refresh = useCallback(async () => {
    const generation = ++epoch.current
    setLoading(true)
    setError('')
    activeUser.current = null
    setUser(null)
    setWallet(null)
    try {
      const response = await fetch('/api/auth', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '로그인 상태를 확인하지 못했습니다.')
      if (epoch.current !== generation) return
      activeUser.current = result.user
      setUser(result.user)
      setWallet(null)
      if (result.user) await refreshWallet(generation)
    } catch (err) {
      if (epoch.current === generation) setError(err instanceof Error ? err.message : '계정 정보를 불러오지 못했습니다.')
    } finally { if (epoch.current === generation) setLoading(false) }
  }, [refreshWallet])

  useEffect(() => {
    const initial = setTimeout(() => { void refresh() }, 0)
    const generation = epoch
    const sync = (event: StorageEvent) => {
      if (event.key === 'football-account-change') void refresh()
      if (event.key === 'football-wallet-update' && activeUser.current) {
        void refreshWallet(epoch.current).catch(() => {})
      }
    }
    const focus = () => {
      const current = epoch.current
      void fetch('/api/auth', { cache: 'no-store' }).then(async response => {
        if (!response.ok || epoch.current !== current) return
        const result = await response.json()
        if (epoch.current !== current) return
        if (result.user?.id !== activeUser.current?.id || result.user?.role !== activeUser.current?.role) await refresh()
        else if (activeUser.current) await refreshWallet(current)
      }).catch(() => {})
    }
    window.addEventListener('storage', sync)
    window.addEventListener('focus', focus)
    return () => { clearTimeout(initial); generation.current++; window.removeEventListener('storage', sync); window.removeEventListener('focus', focus) }
  }, [refresh, refreshWallet])

  const authenticated = useCallback(async (nextUser: AccountUser | null) => {
    const generation = ++epoch.current
    activeUser.current = nextUser
    setUser(nextUser)
    setWallet(null)
    setError('')
    setAuthDialog(null)
    broadcast('football-account-change')
    if (nextUser) {
      try { await refreshWallet(generation) }
      catch (err) { if (epoch.current === generation) setError(err instanceof Error ? err.message : '포인트를 불러오지 못했습니다.') }
    }
  }, [refreshWallet])

  const perform = useCallback(async (action: Action): Promise<Wallet> => {
    if (!activeUser.current) { setAuthDialog('login'); throw new Error('로그인 후 이용해 주세요.') }
    if (actionPending.current) throw new Error('이전 요청을 처리 중입니다. 잠시 기다려 주세요.')
    actionPending.current = true
    setPending(true)
    const generation = epoch.current
    try {
      const response = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, expectedUserId: activeUser.current.id }) })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 401 || result.accountChanged) await refresh()
        throw new Error(result.error || '계정 요청을 처리하지 못했습니다.')
      }
      if (epoch.current === generation && activeUser.current?.id === result.userId) applyWallet(result.wallet)
      broadcast('football-wallet-update')
      return result.wallet
    } finally { actionPending.current = false; setPending(false) }
  }, [refresh, applyWallet])

  return <Context.Provider value={{ user, wallet, loading, pending, error, authDialog, openAuth: setAuthDialog, closeAuth: () => setAuthDialog(null), authenticated, refresh, perform }}>
    <CursorEffect cursor={user ? wallet?.equipped?.cursor : undefined} />
    {children}
  </Context.Provider>
}

export function useAccount() {
  const context = useContext(Context)
  if (!context) throw new Error('AccountProvider가 필요합니다.')
  return context
}

export function UserIdentity() {
  const { user, wallet } = useAccount()
  if (!user) return null
  const title = items.find(item => item.id === wallet?.equipped?.title && item.category === 'title')
  return <span className="user-identity" data-frame={wallet?.equipped?.frame}>
    {title && <small className="user-title" style={{ color: title.color }}>{title.icon} {title.name}</small>}
    <span className="user-name" data-name-style={wallet?.equipped?.name}>{user.role === 'admin' && <small className="user-admin-badge" lang="ko" translate="no">관리자</small>}{user.username}</span>
  </span>
}

function CursorEffect({ cursor }: { cursor?: string }) {
  useEffect(() => {
    if (!cursor) return
    let value = 'crosshair'
    const pointer = items.find((item) => item.category === 'cursor' && item.id === cursor)
    if (pointer && cursor !== 'cursor-crosshair') {
      const canvas = document.createElement('canvas')
      canvas.width = 40
      canvas.height = 40
      const context = canvas.getContext('2d')
      if (context) {
        context.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(pointer.icon, 20, 20)
        value = `url("${canvas.toDataURL('image/png')}") 20 20, auto`
      }
    }
    document.body.dataset.accountCursor = cursor
    document.body.style.setProperty('--account-cursor', value)
    return () => { delete document.body.dataset.accountCursor; document.body.style.removeProperty('--account-cursor') }
  }, [cursor])
  return null
}
