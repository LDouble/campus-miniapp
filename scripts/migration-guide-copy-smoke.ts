import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_MIGRATION_GUIDE_COPY,
  normalizeMigrationGuideCopy,
} from '../src/features/app-edition/migration-copy'

assert.deepEqual(
  normalizeMigrationGuideCopy(undefined),
  DEFAULT_MIGRATION_GUIDE_COPY,
)

assert.deepEqual(normalizeMigrationGuideCopy({
  target_name: ' 海大校园 2.0 ',
  title: ' 服务入口已调整 ',
  entry_button_text: ' 查看新入口 ',
}), {
  ...DEFAULT_MIGRATION_GUIDE_COPY,
  target_name: '海大校园 2.0',
  title: '服务入口已调整',
  description: '校园社区、闲置互助、课程资料与社团服务，现已在「海大校园 2.0」提供。',
  entry_button_text: '查看新入口',
})

assert.deepEqual(normalizeMigrationGuideCopy({
  title: '',
  description: 123,
  open_button_text: '超'.repeat(21),
  app_id: 'wx-remote-override-forbidden',
  enabled: false,
}), DEFAULT_MIGRATION_GUIDE_COPY)

const normalized = normalizeMigrationGuideCopy({
  title: '自定义标题',
  app_id: 'wx-remote-override-forbidden',
  path: 'pages/publish/index',
  auto_redirect: true,
}) as Record<string, unknown>
assert.equal(normalized.title, '自定义标题')
assert.equal('app_id' in normalized, false)
assert.equal('path' in normalized, false)
assert.equal('auto_redirect' in normalized, false)

for (const page of [
  'src/pages/index/index.tsx',
  'src/pages/services/index.tsx',
  'src/pages/feature-migrated/index.tsx',
]) {
  const source = readFileSync(resolve(__dirname, '..', page), 'utf8')
  assert.ok(
    source.includes('getMigrationGuideCopy'),
    `${page} 必须通过统一入口读取迁移文案`,
  )
}

process.stdout.write('migration guide copy smoke: ok\n')
