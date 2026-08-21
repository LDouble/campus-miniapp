import * as fs from 'node:fs'
import * as path from 'node:path'
const root = path.resolve(__dirname, '..')
const repository = fs.readFileSync(path.join(root, 'src/features/campus-crowd/repository.ts'), 'utf8')
const appConfig = fs.readFileSync(path.join(root, 'src/app.config.ts'), 'utf8')

if (!repository.includes('/api/v1/blue-bike-faults/${id}/resolve')) {
  throw new Error('小蓝故障必须保留共享恢复接口')
}
for (const page of ['pages/blue-bike-faults/index']) {
  if (!appConfig.includes(page)) throw new Error(`页面未注册：${page}`)
}

console.log('campus crowd smoke passed')
