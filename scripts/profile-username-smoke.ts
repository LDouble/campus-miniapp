import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  normalizeUsername,
  validateUsername,
} from '../src/features/profile/username'

assert.equal(normalizeUsername('  海大同学_87  '), '海大同学_87')
assert.equal(validateUsername('海大同学_87'), '')
assert.equal(validateUsername('a'), '昵称需要 2–32 个字符')
assert.equal(validateUsername('bad name'), '仅支持中文、字母、数字、点、下划线和短横线')

const accountApi = readFileSync(resolve(__dirname, '../src/api/account.ts'), 'utf8')
const profilePage = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const generatedSchema = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')

assert.ok(accountApi.includes("path: '/api/v1/auth/me'"), '账号 API 缺少本人资料路径')
assert.ok(accountApi.includes("method: 'PATCH'"), '账号 API 缺少 username PATCH 请求')
assert.ok(accountApi.includes("createIdempotencyKey('profile-username')"), '昵称更新必须携带幂等键')
assert.ok(profilePage.includes('KeyboardSafeInput'), '昵称编辑必须使用键盘安全输入框')
assert.ok(profilePage.includes('updateCurrentUsername(username)'), '个人页缺少昵称保存动作')
assert.ok(profilePage.includes('currentUser?.user.username'), '个人页必须优先展示 username')
assert.ok(generatedSchema.includes('UpdateMeRequest'), '生成客户端未同步本人更新契约')

process.stdout.write('profile username smoke: ok\n')
