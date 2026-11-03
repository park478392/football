'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './SiteHeader.module.css'

type User = { id: string; username: string }
export default function SiteHeader({ active }: { active: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('auth')
      const result = await response.json()
      if (!controller.signal.aborted) setUser(result.user)
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setReady(true) })
    return () => controller.abort()
  }, [])
  function open() { setError(''); setMode('login'); dialog.current?.showModal() }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const values = new FormData(event.currentTarget)
    const password = String(values.get('password') || '')
    if (mode === 'signup' && password !== values.get('confirm')) { setError('비밀번호가 일치하지 않습니다.'); setBusy(false); return }
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, username: values.get('username'), password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '로그인하지 못했습니다.')
      setUser(data.user); setNotice(`${data.user.username}님, 반갑습니다.`); form.current?.reset(); dialog.current?.close()
    } catch (err) { setError(err instanceof Error ? err.message : '연결을 확인해 주세요.') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      setUser(null); setNotice('로그아웃했습니다.')
    } catch (err) { setNotice(err instanceof Error ? err.message : '연결을 확인해 주세요.') }
    finally { setBusy(false) }
  }
  const links = [{ href: '/', label: '홈' }, { href: '/matches', label: '경기' }, { href: '/standings', label: '순위' }, { href: '/predictions', label: '승부 예측' }]
  return <>
    <header className="header"><Link className="logo" href="/">FOOTBALL DATA</Link><nav aria-label="주 메뉴" className={styles.nav}>
      {links.map((link) => <Link key={link.href} href={link.href} className={active === link.href ? 'active' : undefined} aria-current={active === link.href ? 'page' : undefined}>{link.label}</Link>)}
      <a href="#">선수</a><a href="#">본전 뽑았나?</a><a href="#">라부 예측</a>
      {user ? <div className={styles.account}><span>{user.username}님</span><button disabled={busy} onClick={logout}>로그아웃</button></div> : <button className={styles.login} disabled={!ready || busy} onClick={open}>로그인</button>}
    </nav></header>
    <span className={styles.srOnly} role="status">{notice}</span>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="auth-title" onClose={() => form.current?.reset()}>
      <button className={styles.close} aria-label="로그인 창 닫기" onClick={() => dialog.current?.close()}>×</button>
      <span className={styles.label}>FOOTBALL DATA</span><h2 id="auth-title">{mode === 'login' ? '다시 만나서 반가워요' : '함께 축구를 즐겨요'}</h2><p>{mode === 'login' ? '아이디와 비밀번호로 로그인하세요.' : '아이디를 만들고 시작해 보세요.'}</p>
      <div className={styles.tabs}><button disabled={busy} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); form.current?.reset() }}>로그인</button><button disabled={busy} aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); form.current?.reset() }}>회원가입</button></div>
      <form ref={form} onSubmit={submit}>
        <label>아이디<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" placeholder="영문·숫자·밑줄 3~20자" disabled={busy} /></label>
        <label>비밀번호<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="8자 이상 입력" disabled={busy} /></label>
        {mode === 'signup' && <label>비밀번호 확인<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} /></label>}
        <p className={styles.error} role="alert">{error}</p><button className={styles.submit} disabled={busy} type="submit">{busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입하고 시작하기'}</button>
      </form><p className={styles.note}>포인트와 아이템은 현재 브라우저의 개인 기록으로 유지됩니다.</p>
    </dialog>
  </>
}
