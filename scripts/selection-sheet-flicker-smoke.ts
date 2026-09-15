import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const page = readFileSync(
  resolve(__dirname, '../src/pages/academic/selection/index.tsx'),
  'utf8',
)
const style = readFileSync(
  resolve(__dirname, '../src/pages/academic/selection/selection-sheet.scss'),
  'utf8',
)

assert.match(
  page,
  /import \{ Image, ScrollView, Text, View \} from '@tarojs\/components'/u,
  '选课结果 Sheet 需要使用原生 ScrollView 承载长内容',
)
assert.doesNotMatch(
  page,
  /academic-page--locked/u,
  '打开选课结果 Sheet 不得压缩列表页面高度',
)
assert.match(
  page,
  /className='academic-overlay selection-sheet-overlay' catchMove/u,
  '遮罩需要拦截背景滑动',
)
assert.match(
  page,
  /className=\{`academic-sheet selection-sheet academic-sheet--\$\{sheet\}`\} catchMove/u,
  'Sheet 本身应拦截触摸冒泡',
)
assert.match(
  page,
  /className='selection-sheet__scroll' scrollY enhanced showScrollbar=\{false\}/u,
  '长 Sheet 内容必须在独立滚动容器内滚动',
)
assert.match(
  page,
  /periodSheetScrollHeight\s*=\s*`min\(calc\(76vh - 80rpx - env\(safe-area-inset-bottom\)\), \$\{112 \+ periods\.length \* 128\}rpx\)`/u,
  '学期 Sheet 的滚动区应按条目数紧凑估算，同时受视口上限约束',
)
assert.match(
  page,
  /selection-sheet__scroll selection-sheet__scroll--period' style=\{\{ height: periodSheetScrollHeight \}\} scrollY/u,
  '学期列表必须始终使用可滚动容器，避免小屏裁切',
)
assert.match(
  style,
  /\.selection-sheet\s*\{[\s\S]*?max-height:\s*76vh[\s\S]*?min-height:\s*0/u,
  'Sheet 应限制为可用视口高度，且允许内部滚动',
)
assert.match(
  style,
  /&__scroll\s*\{[\s\S]*?flex:\s*1[\s\S]*?height:\s*calc\(76vh/u,
  '内部 ScrollView 必须拥有稳定的滚动高度',
)

process.stdout.write('selection sheet flicker smoke: ok\n')
