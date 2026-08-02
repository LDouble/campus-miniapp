import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { CookieJar } from '../../src/lib/http-session/cookie-jar'
import {
  CookiePersistence,
  CookieStorageSnapshot,
} from '../../src/lib/http-session/cookie-storage'
import { HttpSession } from '../../src/lib/http-session/session'
import {
  HttpTransport,
  SessionError,
  TransportRequest,
  TransportResponse,
} from '../../src/lib/http-session/types'

const scope = {
  platformUserId: 9,
  educationLevel: 'graduate' as const,
}

class RecordingTransport implements HttpTransport {
  requests: TransportRequest[] = []

  responses: TransportResponse[]

  beforeSend?: (request: TransportRequest, index: number) => void

  constructor(responses: TransportResponse[]) {
    this.responses = responses
  }

  send = async (request: TransportRequest) => {
    this.beforeSend?.(request, this.requests.length)
    this.requests.push({ ...request, headers: { ...request.headers } })
    const response = this.responses.shift()
    if (!response) throw new Error('missing response')
    return response
  }
}

const response = (
  statusCode: number,
  headers: TransportResponse['headers'] = {},
  cookies: string[] = [],
  data = '',
): TransportResponse => ({ statusCode, headers, cookies, data })

const sessionFor = (
  transport: HttpTransport,
  jar = new CookieJar({ scope }),
) => new HttpSession({
  jar,
  transport,
  allowedHosts: [
    'id.ouc.edu.cn',
    'my.ouc.edu.cn',
    'jwgl2024.ouc.edu.cn',
    'pgs.ouc.edu.cn',
  ],
})

test('302 Cookie 在下一跳请求前写入并发送', async () => {
  let persisted: CookieStorageSnapshot | null = null
  const persistence: CookiePersistence = {
    load: () => persisted,
    save: (snapshot) => {
      persisted = structuredClone(snapshot)
    },
    clear: () => {
      persisted = null
    },
  }
  const transport = new RecordingTransport([
    response(302, { Location: '/service' }, ['CASTGC=ticket; Path=/; Secure']),
    response(200, {}, [], 'ok'),
  ])
  transport.beforeSend = (_request, index) => {
    if (index === 1) {
      assert.equal(persisted?.cookies.some((cookie) => cookie.name === 'CASTGC'), true)
    }
  }
  const result = await sessionFor(
    transport,
    new CookieJar({ scope, persistence }),
  ).get('https://id.ouc.edu.cn/sso/login')

  assert.equal(result.data, 'ok')
  assert.equal(transport.requests[1].headers.cookie, 'CASTGC=ticket')
  assert.equal(transport.requests[1].headers.Cookie, undefined)
  assert.equal(result.history.length, 1)
})

test('跨子域 302 不携带来源 HostOnly Cookie', async () => {
  const transport = new RecordingTransport([
    response(
      302,
      { location: 'https://jwgl2024.ouc.edu.cn/?ticket=ST-test' },
      ['JSESSIONID=id-only; Path=/; Secure; HttpOnly'],
    ),
    response(200, {}, [], 'academic'),
  ])

  await sessionFor(transport).get(
    'https://id.ouc.edu.cn/sso/login?service=https%3A%2F%2Fjwgl2024.ouc.edu.cn%2F',
  )

  assert.equal(transport.requests[0].headers.cookie, undefined)
  assert.equal(transport.requests[1].headers.cookie, undefined)
})

test('302 POST 改写 GET 并移除 Body Header', async () => {
  const transport = new RecordingTransport([
    response(302, { location: 'https://my.ouc.edu.cn/home' }),
    response(200),
  ])
  await sessionFor(transport).post(
    'https://id.ouc.edu.cn/sso/login',
    'username=student',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  assert.equal(transport.requests[0].method, 'POST')
  assert.equal(transport.requests[1].method, 'GET')
  assert.equal(transport.requests[1].body, undefined)
  assert.equal(transport.requests[1].headers['Content-Type'], undefined)
})

test('307 保持方法、Body 和 Content-Type', async () => {
  const transport = new RecordingTransport([
    response(307, { location: '/sso/continue' }),
    response(200),
  ])
  await sessionFor(transport).post(
    'https://id.ouc.edu.cn/sso/login',
    'flowId=1',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  assert.equal(transport.requests[1].method, 'POST')
  assert.equal(transport.requests[1].body, 'flowId=1')
  assert.equal(
    transport.requests[1].headers['Content-Type'],
    'application/x-www-form-urlencoded',
  )
})

test('安全改写研究生固定旧版 SSO 跳转', async () => {
  const service = encodeURIComponent('https://pgs.ouc.edu.cn/py/page/student/grkcgl.htm')
  const transport = new RecordingTransport([
    response(302, {
      location: `http://id.ouc.edu.cn:8071/sso/login?service=${service}`,
    }),
    response(200),
  ])
  await sessionFor(transport).get('https://pgs.ouc.edu.cn/py/page/student/grkcgl.htm')
  assert.equal(
    transport.requests[1].url,
    `https://id.ouc.edu.cn/sso/login?service=${service}`,
  )
})

test('拒绝白名单外跳转、循环和超限', async () => {
  const blocked = new RecordingTransport([
    response(302, { location: 'https://example.com/steal' }),
  ])
  await assert.rejects(
    () => sessionFor(blocked).get('https://id.ouc.edu.cn/sso/login'),
    (error: unknown) => error instanceof SessionError && error.code === 'blocked_redirect',
  )

  const loop = new RecordingTransport([
    response(302, { location: '/sso/login' }),
  ])
  await assert.rejects(
    () => sessionFor(loop).get('https://id.ouc.edu.cn/sso/login'),
    (error: unknown) => error instanceof SessionError && error.code === 'redirect_loop',
  )
})

test('302 Cookie Storage 写入失败时不发送下一跳', async () => {
  const persistence: CookiePersistence = {
    load: () => null,
    save: () => {
      throw new Error('full')
    },
    clear: () => {},
  }
  const transport = new RecordingTransport([
    response(302, { location: '/service' }, ['sid=1; Path=/']),
    response(200),
  ])
  await assert.rejects(
    () => sessionFor(
      transport,
      new CookieJar({ scope, persistence }),
    ).get('https://id.ouc.edu.cn/sso/login'),
    (error: unknown) => error instanceof SessionError && error.code === 'storage_error',
  )
  assert.equal(transport.requests.length, 1)
})
