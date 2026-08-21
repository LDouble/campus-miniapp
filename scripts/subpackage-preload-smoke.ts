import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const appConfig = readFileSync(join(process.cwd(), 'src/app.config.ts'), 'utf8')

assert.match(
  appConfig,
  /const preloadPackageRoots = subPackages\.map\(\(\{ root \}\) => root\)/u,
  '预下载列表应从当前版本实际生成的分包派生',
)
assert.match(
  appConfig,
  /const preloadRule = Object\.fromEntries\([\s\S]*tabBarList\.map/u,
  '所有可用主 Tab 都应触发分包预下载',
)
assert.match(appConfig, /network: 'all' as const/u, '分包预下载应覆盖移动网络')
assert.match(appConfig, /packages: preloadPackageRoots/u, '预下载规则应包含全部业务分包')
assert.match(appConfig, /\n\s+preloadRule,\n/u, 'preloadRule 必须写入全局小程序配置')

console.log('subpackage preload smoke: ok')
