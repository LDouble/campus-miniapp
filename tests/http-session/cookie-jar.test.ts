import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { CookieJar, splitSetCookieHeader } from '../../src/lib/http-session/cookie-jar'
import {
  CookiePersistence,
  CookieStorageSnapshot,
} from '../../src/lib/http-session/cookie-storage'

const scope = {
  platformUserId: 7,
  educationLevel: 'undergraduate' as const,
}

class MemoryPersistence implements CookiePersistence {
  value: CookieStorageSnapshot | null = null

  saves = 0

  load = () => this.value && structuredClone(this.value)

  save = (snapshot: CookieStorageSnapshot) => {
    this.saves += 1
    this.value = structuredClone(snapshot)
  }

  clear = () => {
    this.value = null
  }
}

test('拆分包含 Expires 逗号的 Set-Cookie', () => {
  assert.deepEqual(
    splitSetCookieHeader('a=1; Expires=Wed, 30 Jul 2036 10:00:00 GMT, b=2; Path=/'),
    ['a=1; Expires=Wed, 30 Jul 2036 10:00:00 GMT', 'b=2; Path=/'],
  )
})

test('按 Domain、HostOnly、Secure 和 Path 选择 Cookie', () => {
  const jar = new CookieJar({ scope })
  jar.setCookies([
    'host=1; Path=/py; Secure',
    'shared=2; Domain=.ouc.edu.cn; Path=/; Secure',
    'plain=3; Path=/',
    'blocked=4; Domain=.edu.cn; Path=/',
  ], 'https://pgs.ouc.edu.cn/py/login')

  assert.equal(
    jar.getCookieHeader('https://pgs.ouc.edu.cn/py/page'),
    'host=1; shared=2; plain=3',
  )
  assert.equal(
    jar.getCookieHeader('https://jwgl2024.ouc.edu.cn/jsxsd'),
    'shared=2',
  )
  assert.equal(
    jar.getCookieHeader('http://pgs.ouc.edu.cn/py/page'),
    'plain=3',
  )
})

test('同名 Cookie 按更长 Path 优先并保持创建顺序', () => {
  let now = 1000
  const jar = new CookieJar({ scope, now: () => now })
  jar.setCookies(['sid=root; Path=/'], 'https://id.ouc.edu.cn/sso/login')
  now += 1
  jar.setCookies(['sid=sso; Path=/sso'], 'https://id.ouc.edu.cn/sso/login')
  now += 1
  jar.setCookies(['flow=1; Path=/sso'], 'https://id.ouc.edu.cn/sso/login')
  assert.equal(
    jar.getCookieHeader('https://id.ouc.edu.cn/sso/continue'),
    'sid=sso; flow=1; sid=root',
  )
})

test('Max-Age 优先于 Expires，并可删除已有 Cookie', () => {
  let now = Date.parse('2030-01-01T00:00:00Z')
  const jar = new CookieJar({ scope, now: () => now })
  jar.setCookies([
    'sid=active; Max-Age=60; Expires=Wed, 01 Jan 2020 00:00:00 GMT; Path=/',
  ], 'https://id.ouc.edu.cn/sso/login')
  assert.equal(jar.size(), 1)
  now += 61_000
  assert.equal(jar.getCookieHeader('https://id.ouc.edu.cn/sso/login'), '')

  jar.setCookies(['sid=again; Path=/'], 'https://id.ouc.edu.cn/sso/login')
  assert.equal(jar.size(), 1)
  jar.setCookies(['sid=gone; Max-Age=0; Path=/'], 'https://id.ouc.edu.cn/sso/login')
  assert.equal(jar.size(), 0)
})

test('Storage 恢复不延长 Jar 绝对 TTL', () => {
  let now = 10_000
  const persistence = new MemoryPersistence()
  const first = new CookieJar({
    scope,
    persistence,
    sessionTtlMs: 60_000,
    now: () => now,
  })
  first.setCookies(['sid=stored; Path=/; Secure'], 'https://id.ouc.edu.cn/sso/login')
  const originalExpiry = persistence.value?.sessionExpiresAt

  now += 20_000
  const restored = new CookieJar({
    scope,
    persistence,
    sessionTtlMs: 60_000,
    now: () => now,
  })
  assert.equal(restored.getCookieHeader('https://id.ouc.edu.cn/sso/login'), 'sid=stored')
  assert.equal(persistence.value?.sessionExpiresAt, originalExpiry)

  now = Number(originalExpiry) + 1
  const expired = new CookieJar({
    scope,
    persistence,
    sessionTtlMs: 60_000,
    now: () => now,
  })
  assert.equal(expired.size(), 0)
  assert.equal(persistence.value, null)
})
