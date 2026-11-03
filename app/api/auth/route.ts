import { NextRequest, NextResponse } from 'next/server'
import { authenticate, sessionUser, revoke, COOKIE_NAME, SESSION_SECONDS } from './store'

export const runtime = 'nodejs'
const attempts = new Map<string, { count: number; expires: number }>()
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: NextRequest) {
  try { return reply({ user: await sessionUser(request.cookies.get(COOKIE_NAME)?.value) }) }
  catch { return reply({ error: '로그인 저장소에 연결하지 못했습니다.' }, 503) }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== request.nextUrl.origin) return reply({ error: '허용되지 않는 요청입니다.' }, 403)
  try {
    if (Number(request.headers.get('content-length')) > 4096) return reply({ error: '요청이 너무 큽니다.' }, 413)
    const body = await request.json()
    if (body.action === 'logout') {
      await revoke(request.cookies.get(COOKIE_NAME)?.value)
      const response = reply({ user: null })
      response.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
      return response
    }
    if (!['login', 'signup'].includes(body.action)) return reply({ error: '잘못된 요청입니다.' }, 400)
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^[a-z0-9_]{3,20}$/.test(username) || password.length < 8 || password.length > 128) return reply({ error: '아이디는 영문·숫자·밑줄 3~20자, 비밀번호는 8~128자로 입력해 주세요.' }, 400)
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const now = Date.now()
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key)
    const key = `${address}:${username}`
    const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 }
    if (entry.count >= 10) return reply({ error: '시도가 너무 많습니다. 15분 후 다시 시도해 주세요.' }, 429)
    entry.count++; attempts.set(key, entry)
    let result
    try { result = await authenticate(username, password, body.action === 'signup') }
    catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (['이미 사용 중인 아이디입니다.', '아이디 또는 비밀번호가 올바르지 않습니다.'].includes(message)) return reply({ error: message }, body.action === 'signup' ? 409 : 401)
      throw error
    }
    attempts.delete(key)
    const previous = request.cookies.get(COOKIE_NAME)?.value
    if (previous) await revoke(previous)
    const response = reply({ user: result.user })
    response.cookies.set(COOKIE_NAME, result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_SECONDS })
    return response
  } catch { return reply({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503) }
}
