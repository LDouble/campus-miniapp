import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  elapsedStudySeconds,
  formatStudyDuration,
  STUDY_ROOM_MEMBER_PREVIEW_LIMIT,
} from '../src/features/study-rooms/time'

assert.equal(formatStudyDuration(0), '00:00:00')
assert.equal(formatStudyDuration(3661), '01:01:01')
assert.equal(elapsedStudySeconds(60, '2026-08-22T00:00:00.000Z', Date.parse('2026-08-22T00:01:30.000Z')), 150)
assert.equal(STUDY_ROOM_MEMBER_PREVIEW_LIMIT, 8)

const root = path.resolve(__dirname, '..')
const repository = fs.readFileSync(path.join(root, 'src/features/study-rooms/repository.ts'), 'utf8')
const roomPage = fs.readFileSync(path.join(root, 'src/pages/study-rooms/room.tsx'), 'utf8')
const appConfig = fs.readFileSync(path.join(root, 'src/app.config.ts'), 'utf8')
const buildConfig = fs.readFileSync(path.join(root, 'config/index.ts'), 'utf8')
const previewSource = fs.readFileSync(path.join(root, 'src/features/study-rooms/preview.ts'), 'utf8')

for (const endpoint of ['/members', '/messages', '/message-cooldown']) {
  assert.ok(repository.includes(endpoint), `缺少自习室接口：${endpoint}`)
}
assert.ok(repository.includes('invite_code'), '私密房间必须通过邀请凭据加入')
assert.ok(repository.includes('moderation_status'), '标题和消息必须保留审核状态')
assert.ok(roomPage.includes('members.slice(0, STUDY_ROOM_MEMBER_PREVIEW_LIMIT)'), '成员预览最多展示八人')
assert.ok(repository.includes("'study_room_message_cooldown'"), '预览模式必须真实拦截冷却期内的发言')
assert.ok(repository.includes('room.next_message_at = room.message_cooldown_seconds > 0'), '发送成功后必须更新下一次发言时间')
assert.ok(appConfig.includes("pages: ['index', 'room']"), '自习室页面必须注册为分包')
assert.ok(buildConfig.includes("studyRoomsPreviewEnabled && process.env.NODE_ENV !== 'development'"), '预览模式必须禁止进入非开发构建')
assert.ok(previewSource.includes('__CAMPUS_STUDY_ROOMS_PREVIEW__'), '预览模式必须由编译常量控制')

console.log('study rooms smoke passed')
