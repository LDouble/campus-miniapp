import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { CookieJar } from '../../src/lib/http-session/cookie-jar'
import { HttpSession } from '../../src/lib/http-session/session'
import type {
  HttpTransport,
  TransportRequest,
  TransportResponse,
} from '../../src/lib/http-session/types'
import {
  academicResponseRequiresAuthentication,
  authenticateAcademicSession,
} from '../../src/features/academic-direct/sso'

class ScriptedTransport implements HttpTransport {
  readonly requests: TransportRequest[] = []

  private readonly script: Array<(request: TransportRequest) => TransportResponse>

  constructor(script: Array<(request: TransportRequest) => TransportResponse>) {
    this.script = [...script]
  }

  send = async (request: TransportRequest) => {
    this.requests.push(request)
    const step = this.script.shift()
    if (!step) throw new Error('unexpected request')
    return step(request)
  }
}

const response = (
  statusCode: number,
  data: string,
  headers: Record<string, string | string[]> = {},
): TransportResponse => ({
  statusCode,
  data,
  headers,
  cookies: [],
})

test('SSO 表单登录保留隐藏字段，并携带 302 写入的认证 Cookie', async () => {
  const loginPage = `
    <form action="/sso/login">
      <input type="hidden" name="flowId" value="flow-1">
      <input type="hidden" name="execution" value="e1s1">
      <input name="username">
      <input type="password" name="password">
    </form>
    <script>var ssoConfig = {"sm2":{"enabled":false,"publicKey":""}};</script>`
  const transport = new ScriptedTransport([
    () => response(200, loginPage, { 'Set-Cookie': 'FLOW=abc; Path=/; Secure; HttpOnly' }),
    (request) => {
      assert.match(String(request.body), /flowId=flow-1/)
      assert.match(String(request.body), /execution=e1s1/)
      assert.match(String(request.body), /username=student/)
      assert.match(String(request.body), /password=p%40ss/)
      assert.equal(request.headers.cookie, 'FLOW=abc')
      return response(302, '', {
        Location: 'https://my.ouc.edu.cn/home',
        'Set-Cookie': 'CASTGC=ticket; Path=/; Secure; HttpOnly',
      })
    },
    () => response(200, '<html>portal</html>'),
    (request) => {
      assert.equal(request.headers.cookie, 'FLOW=abc; CASTGC=ticket')
      return response(302, '', { Location: 'https://jwgl2024.ouc.edu.cn/' })
    },
    (request) => {
      assert.equal(request.headers.cookie, undefined)
      return response(200, '<html>academic home</html>')
    },
  ])
  const session = new HttpSession({
    jar: new CookieJar({
      scope: { platformUserId: 1, educationLevel: 'undergraduate' },
    }),
    transport,
    allowedHosts: [
      'id.ouc.edu.cn',
      'my.ouc.edu.cn',
      'jwgl2024.ouc.edu.cn',
    ],
  })

  await authenticateAcademicSession(
    session,
    'student',
    'p@ss',
    'https://jwgl2024.ouc.edu.cn/',
  )
  const service = await session.get(
    'https://id.ouc.edu.cn/sso/login?service=https%3A%2F%2Fjwgl2024.ouc.edu.cn%2F',
  )

  assert.equal(service.url, 'https://jwgl2024.ouc.edu.cn/')
  assert.equal(transport.requests.length, 5)
})

test('密码过期提示继续后，按已离开 SSO 表单识别登录成功', async () => {
  const loginPage = `
    <form action="/sso/login">
      <input type="hidden" name="flowId" value="flow-1">
      <input name="username">
      <input type="password" name="password">
    </form>
    <script>var ssoConfig = {"sm2":{"enabled":false,"publicKey":""}};</script>`
  const passwordWarning = `
    <form action="">
      <input type="hidden" name="flowId" value="flow-2">
      <input type="hidden" name="continue" value="">
    </form>
    <script>
      var error = {"code":40605,"msg":"expired"};
      var pageName = "resetWarn";
      var ssoConfig = {"sm2":{"enabled":false,"publicKey":""}};
    </script>`
  const transport = new ScriptedTransport([
    () => response(200, loginPage),
    () => response(200, passwordWarning),
    () => response(
      200,
      '<html><script>window.location.replace("/academic/home")</script></html>',
    ),
  ])
  const session = new HttpSession({
    jar: new CookieJar({
      scope: { platformUserId: 1, educationLevel: 'undergraduate' },
    }),
    transport,
    allowedHosts: ['id.ouc.edu.cn', 'my.ouc.edu.cn'],
  })

  await authenticateAcademicSession(
    session,
    'student',
    'password',
    'https://jwgl2024.ouc.edu.cn/',
  )
  assert.equal(transport.requests.length, 3)
})

test('业务接口返回 401/403 时触发一次认证恢复', () => {
  assert.equal(
    academicResponseRequiresAuthentication(
      401,
      'https://pgs.ouc.edu.cn/py/page/student/grkcgl.htm',
      '',
    ),
    true,
  )
  assert.equal(
    academicResponseRequiresAuthentication(
      403,
      'https://pgs.ouc.edu.cn/py/page/student/grkcgl.htm',
      '<html>Forbidden</html>',
    ),
    true,
  )
  assert.equal(
    academicResponseRequiresAuthentication(
      500,
      'https://pgs.ouc.edu.cn/py/page/student/grkcgl.htm',
      '<html>Server Error</html>',
    ),
    false,
  )
})
