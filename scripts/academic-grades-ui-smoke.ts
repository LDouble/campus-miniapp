import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const gradePage = readFileSync(
  resolve(__dirname, '../src/pages/academic/grades/index.tsx'),
  'utf8',
)
const examPage = readFileSync(
  resolve(__dirname, '../src/pages/academic/exams/index.tsx'),
  'utf8',
)
const selectionPage = readFileSync(
  resolve(__dirname, '../src/pages/academic/selection/index.tsx'),
  'utf8',
)
const academicStyle = readFileSync(
  resolve(__dirname, '../src/pages/academic/index.scss'),
  'utf8',
)
const academicUtils = readFileSync(
  resolve(__dirname, '../src/pages/academic/utils.ts'),
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
assert.match(
  gradePage,
  /className='academic-toolbar__reset academic-toolbar__reset--simulate'[\s\S]*?<Text>模拟计算<\/Text>/u,
  '模拟计算胶囊应使用独立文本节点参与垂直对齐',
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
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-toolbar--simple\s*\{[\s\S]*?\.academic-toolbar__period\s*\{[\s\S]*?background:\s*transparent[\s\S]*?border:\s*0/u,
  '学期入口应使用无边框的低强调样式，而不是卡片式底色',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-toolbar__period\s*\{[\s\S]*?flex-direction:\s*row[\s\S]*?height:\s*68rpx/u,
  '学期入口应使用紧凑的单行布局',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-toolbar__period\s*\{[\s\S]*?justify-content:\s*flex-start[\s\S]*?> view\s*\{[\s\S]*?flex:\s*0 1 auto[\s\S]*?justify-content:\s*flex-start/u,
  '学期入口应与页面内容起点对齐，避免在剩余空间中漂浮',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-toolbar__chevron\s*\{[\s\S]*?display:\s*block[\s\S]*?width:\s*28rpx[\s\S]*?height:\s*28rpx/u,
  '学期入口箭头应使用固定图标盒并与文字垂直居中',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-toolbar__hint,[\s\S]*?\.academic-toolbar__reset,[\s\S]*?\.academic-toolbar__mode-actions\s*\{[\s\S]*?min-height:\s*68rpx[\s\S]*?height:\s*68rpx[\s\S]*?line-height:\s*var\(--ousea-line-height-ui/u,
  '学期入口和右侧状态/操作应共用同一行高与文字行高',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?> \.academic-toolbar__reset\s*\{[\s\S]*?font-size:\s*var\(--ousea-font-size-label[\s\S]*?font-weight:\s*var\(--ousea-font-weight-semibold[\s\S]*?line-height:\s*var\(--ousea-line-height-ui[\s\S]*?> text\s*\{[\s\S]*?font-size:\s*inherit[\s\S]*?line-height:\s*inherit/u,
  '模拟计算文字应与学期文字使用同一套 Ousea 字号和行盒',
)
assert.match(
  academicStyle,
  /\.academic-sheet--course-services\s*\{[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*0[\s\S]*?> \.academic-sheet__body:not\(\.academic-sheet__body--form\)\s*\{[\s\S]*?height:\s*auto[\s\S]*?flex:\s*0 0 auto/u,
  '成绩课程服务 sheet 应根据实际内容自适应高度',
)
assert.match(
  academicStyle,
  /\.academic-header\s*\{[\s\S]*?padding:\s*16rpx 24rpx;/u,
  '学期 toolbar 外层应使用上下相同的内边距',
)
assert.match(
  academicStyle,
  /\.academic-toolbar__period[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/u,
  '学期入口空间不足时应截断完整学期文案',
)
assert.match(
  academicUtils,
  /getPeriodLabel[\s\S]*?\.label\s*\|\|\s*'选择学期'/u,
  '考试和选课入口必须展示完整学期名称',
)
assert.match(
  academicUtils,
  /getGradePeriodLabel[\s\S]*?\.label[\s\S]*?formatGradePeriod\(id\)\.label/u,
  '成绩入口必须展示完整学期名称',
)
for (const [pageSource, pageName] of [
  [gradePage, '成绩'],
  [examPage, '考试'],
  [selectionPage, '选课结果'],
] as const) {
  assert.match(
    pageSource,
    /academic-toolbar academic-toolbar--simple/u,
    `${pageName}入口必须使用共用的学期 toolbar`,
  )
  assert.match(
    pageSource,
    /className='academic-toolbar__period'[\s\S]*?className='academic-toolbar__chevron' src=\{ACADEMIC_CHEVRON\}/u,
    `${pageName}入口必须使用共用的 SVG 下拉箭头`,
  )
  assert.doesNotMatch(
    pageSource,
    /academic-toolbar__chevron'>⌄/u,
    `${pageName}入口不应继续使用文字字符箭头`,
  )
  assert.doesNotMatch(
    pageSource,
    /academic-toolbar__label/u,
    `${pageName}入口不应重复展示前置 label`,
  )
}
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.academic-sheet\s*\{[\s\S]*?border-radius:\s*var\(--ousea-radius-card/u,
  '学期选择面板应使用较平的卡片圆角，而不是过度胶囊化',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?&__close\s*\{[\s\S]*?background:\s*transparent[\s\S]*?border:\s*0/u,
  '学期选择面板的关闭按钮不应带矩形外围底板',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.period-options__item\s*\{[\s\S]*?min-height:\s*88rpx[\s\S]*?margin-bottom:\s*8rpx/u,
  '学期选择项应在保留触控高度的同时收紧间距',
)
assert.match(
  academicStyle,
  /成绩、考试、选课结果共用的学期选择器[\s\S]*?\.period-options__item--active[\s\S]*?background:\s*var\(--ousea-ocean-50/u,
  '学期选择器选中项应使用浅蓝选中态',
)

process.stdout.write('academic grades ui smoke: ok\n')
