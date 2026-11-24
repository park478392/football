'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './SiteHeader.module.css'
import { normalizeUsername, usernameError } from './username'
import { useAccount, UserIdentity } from './AccountProvider'

export default function SiteHeader({ active }: { active: string }) {
  const { user, loading, authDialog, openAuth, closeAuth, authenticated } = useAccount()
  const mode = authDialog || 'login'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (authDialog) dialog.current?.showModal()
    else dialog.current?.close()
  }, [authDialog])
  function open(nextMode: 'login' | 'signup') { setError(''); openAuth(nextMode) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const values = new FormData(event.currentTarget)
    const username = normalizeUsername(String(values.get('username') || ''))
    const invalidUsername = usernameError(username, mode === 'signup')
    if (invalidUsername) { setError(invalidUsername); setBusy(false); return }
    const password = String(values.get('password') || '')
    if (mode === 'signup' && password !== values.get('confirm')) { setError('비밀번호가 일치하지 않습니다.'); setBusy(false); return }
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, username, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '로그인하지 못했습니다.')
      await authenticated(data.user); setNotice(`${data.user.username}님, 반갑습니다.`); form.current?.reset()
    } catch (err) { setError(err instanceof Error ? err.message : '연결을 확인해 주세요.') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      await authenticated(null); setNotice('로그아웃했습니다.')
    } catch (err) { setNotice(err instanceof Error ? err.message : '연결을 확인해 주세요.') }
    finally { setBusy(false) }
  }
  const links = [{ href: '/', label: '홈' }, { href: '/matches', label: '경기' }, { href: '/standings', label: '순위' }, { href: '/predictions', label: '승부 예측' }, { href: '/players', label: '선수' }]
  return <>
    <header className="header"><Link className="logo" href="/">FOOTBALL DATA</Link><nav aria-label="주 메뉴" className={styles.nav}>
      {links.map((link) => <Link key={link.href} href={link.href} className={active === link.href ? 'active' : undefined} aria-current={active === link.href ? 'page' : undefined}>{link.label}</Link>)}
      <a href="#">본전 뽑았나?</a><a href="#">라부 예측</a>
      {user ? <div className={styles.account}><Link href="/profile" className={styles.profileLink} aria-current={active === '/profile' ? 'page' : undefined}><UserIdentity /></Link><button disabled={busy} onClick={logout}>로그아웃</button></div> : <div className={styles.authActions}>
        <button className={styles.signup} disabled={loading || busy} onClick={() => open('signup')}>회원가입</button>
        <button className={styles.login} lang="ko" translate="no" disabled={loading || busy} onClick={() => open('login')}>로그인</button>
      </div>}
    </nav></header>
    <span className={styles.srOnly} role="status">{notice}</span>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="auth-title" onClose={() => { closeAuth(); form.current?.reset() }}>
      <button className={styles.close} aria-label="로그인 창 닫기" onClick={() => dialog.current?.close()}>×</button>
      <span className={styles.label}>FOOTBALL DATA</span><h2 id="auth-title">{mode === 'login' ? '다시 만나서 반가워요' : '함께 축구를 즐겨요'}</h2><p>{mode === 'login' ? '아이디와 비밀번호로 로그인하세요.' : '아이디를 만들고 시작해 보세요.'}</p>
      <div className={styles.tabs}><button disabled={busy} aria-pressed={mode === 'login'} onClick={() => { openAuth('login'); setError(''); form.current?.reset() }}>로그인</button><button disabled={busy} aria-pressed={mode === 'signup'} onClick={() => { openAuth('signup'); setError(''); form.current?.reset() }}>회원가입</button></div>
      <form ref={form} onSubmit={submit}>
        <label>아이디<input name="username" required minLength={1} maxLength={40} autoComplete="username" placeholder="한글·띄어쓰기·특수문자 가능, 1~20자" disabled={busy} /></label>
        <label>비밀번호<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="8자 이상 입력" disabled={busy} /></label>
        {mode === 'signup' && <label>비밀번호 확인<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} /></label>}
        <p className={styles.error} role="alert">{error}</p><button className={styles.submit} disabled={busy} type="submit">{busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입하고 시작하기'}</button>
      </form><p className={styles.note}>예측 포인트와 꾸미기 아이템은 로그인한 계정에 저장됩니다.</p>
    </dialog>
  </>
}
