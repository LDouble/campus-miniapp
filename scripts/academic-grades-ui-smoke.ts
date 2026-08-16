import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const gradePage = readFileSync(
  resolve(__dirname, '../src/pages/academic/grades/index.tsx'),
  'utf8',
)
const academicStyle = readFileSync(
  resolve(__dirname, '../src/pages/academic/index.scss'),
  'utf8',
)

assert.match(
  gradePage,
  /className='grade-card__converted'>折算 \{score\} 分参与加权平均/u,
  '等级制成绩必须保留折算说明',
)
assert.match(
  gradePage,
  /className='grade-card__converted'>文字成绩仅展示，不参与加权平均/u,
  '无法折算的文字成绩必须保留说明',
)
assert.doesNotMatch(
  academicStyle,
  /&__changed,\s*&__converted\s*\{[^}]*background:/u,
  '折算说明不得与“已模拟”标签共用背景样式',
)
assert.match(
  academicStyle,
  /&__converted\s*\{\s*padding:\s*0;\s*color:[^;]+;\s*background:\s*transparent;\s*\}/u,
  '折算说明必须显式保持透明背景',
)

process.stdout.write('academic grades ui smoke: ok\n')
