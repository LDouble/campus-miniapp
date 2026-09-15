import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ThemeDefinition = {
  light: Record<string, string>
  dark: Record<string, string>
}

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const theme = JSON.parse(read('src/theme.json')) as ThemeDefinition
const appConfig = read('src/app.config.ts')
const appSource = read('src/app.ts')
const appStyle = read('src/app.scss')
const darkModeStyle = read('src/styles/_dark-mode.scss')
const themePreference = read('src/features/theme-preference.ts')
const weappCompatPlugin = read('config/plugins/weapp-compat.js')
const profileSource = read('src/pages/profile/index.tsx')
const shuttleDetailStyle = read('src/pages/shuttle/detail.scss')
const academicStyle = read('src/pages/academic/index.scss')
const courseCatalogStyle = read('src/pages/academic/course-catalog/index.scss')
const homeSource = read('src/pages/index/index.tsx')
const tokens = read('src/styles/_tokens.scss')
const tabBarSource = read('src/custom-tab-bar/index.js')
const tabBarTemplate = read('src/custom-tab-bar/index.wxml')
const tabBarStyle = read('src/custom-tab-bar/index.wxss')
const aiThemeSource = read('src/ai-mode/skills/campus-info/utils/theme.js')
const aiThemeFiles = [
  'empty-classroom-list',
  'official-notice-list',
  'shuttle-route-list',
].map((name) => ({
  script: read(`src/ai-mode/skills/campus-info/components/${name}/index.js`),
  template: read(`src/ai-mode/skills/campus-info/components/${name}/index.wxml`),
  style: read(`src/ai-mode/skills/campus-info/components/${name}/index.wxss`),
}))

const requiredThemeKeys = [
  'navigationBarBackgroundColor',
  'navigationBarTextStyle',
  'backgroundColor',
  'backgroundTextStyle',
  'tabBarColor',
  'tabBarSelectedColor',
  'tabBarBackgroundColor',
  'tabBarBorderStyle',
]

assert.match(appConfig, /darkmode:\s*true/u)
assert.match(appConfig, /themeLocation:\s*'theme\.json'/u)
assert.match(appConfig, /navigationBarBackgroundColor:\s*'@navigationBarBackgroundColor'/u)
assert.match(appConfig, /backgroundColor:\s*'@backgroundColor'/u)
assert.match(appConfig, /backgroundTextStyle:\s*'@backgroundTextStyle'/u)

for (const key of requiredThemeKeys) {
  assert.ok(theme.light[key], `浅色主题缺少 ${key}`)
  assert.ok(theme.dark[key], `暗色主题缺少 ${key}`)
}

assert.notEqual(theme.light.backgroundColor, theme.dark.backgroundColor)
assert.notEqual(theme.light.navigationBarTextStyle, theme.dark.navigationBarTextStyle)
assert.match(appStyle, /\.campus-theme--dark\s*\{/u)
assert.match(appStyle, /--campus-surface:\s*#111827/u)
assert.match(appStyle, /--campus-icon-surface-orange:\s*#3a291a/u)
assert.match(tokens, /\$color-on-accent:\s*#fff/u)
assert.doesNotMatch(tokens, /\$color-on-accent:\s*var\(--campus-surface/u)
assert.doesNotMatch(appStyle, /@media \(prefers-color-scheme: dark\)/u)
assert.match(appSource, /const initialCampusTheme = initializeCampusTheme\(\)/u)
assert.match(appSource, /preloadCampusWebview\(\)/u)
assert.match(appSource, /useState<CampusTheme>\(initialCampusTheme\)/u)
assert.ok(
  appSource.indexOf('const initialCampusTheme = initializeCampusTheme()') < appSource.indexOf('function App('),
  '主题初始化必须早于 App 生命周期和页面创建',
)
assert.ok(
  appSource.indexOf('useLaunch(() => {') < appSource.indexOf('preloadCampusWebview()'),
  'WebView 预热必须在 App onLaunch 注册后执行',
)
assert.match(appSource, /campus-app-root campus-theme campus-theme--\$\{campusTheme\}/u)
assert.match(appSource, /useState<CampusTheme>/u)
assert.match(themePreference, /CAMPUS_THEME_STORAGE_KEY/u)
assert.match(themePreference, /CampusThemePreference = 'system' \| CampusTheme/u)
assert.match(themePreference, /Taro\.getCurrentPages\(\)/u)
assert.match(themePreference, /page\.setData\?\.\(\{ __campusTheme: theme \}\)/u)
assert.doesNotMatch(themePreference, /document\.body/u)
assert.match(weappCompatPlugin, /injectCampusThemeIntoPageRoots/u)
assert.match(weappCompatPlugin, /resolveThemeBackgroundColors/u)
assert.match(weappCompatPlugin, /assets\['theme\.json'\]/u)
assert.match(weappCompatPlugin, /createThemePageMeta/u)
assert.match(weappCompatPlugin, /<page-meta/u)
assert.match(weappCompatPlugin, /page-style/u)
assert.match(weappCompatPlugin, /background-color-top/u)
assert.match(weappCompatPlugin, /background-color-bottom/u)
assert.match(weappCompatPlugin, /root-background-color/u)
assert.match(weappCompatPlugin, /background-text-style/u)
assert.match(weappCompatPlugin, /nextSource\.startsWith\('<page-meta'\)/u)
assert.match(weappCompatPlugin, /campus-theme campus-theme--/u)
assert.match(weappCompatPlugin, /root:root,t:__campusTheme/u)
assert.match(weappCompatPlugin, /componentConfig\.component === true/u)
assert.match(weappCompatPlugin, /__campusTheme:\$\{initialThemeExpression\}/u)
assert.match(weappCompatPlugin, /wx\.getStorageSync\('campus-theme-preference'\)/u)
assert.match(weappCompatPlugin, /wx\.getAppBaseInfo\(\)/u)
assert.match(weappCompatPlugin, /wx\.getSystemInfoSync\(\)/u)
assert.match(themePreference, /Taro\.getSystemInfoSync\(\)/u)
assert.match(themePreference, /Taro\.setStorageSync/u)
assert.match(themePreference, /Taro\.onThemeChange/u)
assert.match(themePreference, /setNavigationBarColor/u)
assert.match(themePreference, /setBackgroundColor/u)
assert.match(themePreference, /setTabBarStyle/u)
assert.match(themePreference, /Taro\.preloadWebview\(\{\}\)/u)
assert.match(themePreference, /webviewPreloadStarted/u)
assert.match(profileSource, /<Text>深色模式<\/Text>/u)
assert.match(profileSource, /\{ label: '跟随系统', value: 'system' \}/u)
assert.match(profileSource, /\{ label: '打开', value: 'dark' \}/u)
assert.match(profileSource, /const profileMenuIcons = \{/u)
assert.match(profileSource, /home-service-schedule-dark\.svg/u)
assert.match(profileSource, /profileMenuIcons\[campusTheme\]\[item\.iconKey\]/u)
assert.doesNotMatch(
  read('src/pages/profile/index.scss'),
  /profile-menu__icon[\s\S]{0,360}filter:/u,
  '我的服务入口不得依赖 CSS 图像滤镜完成重着色',
)
assert.match(profileSource, /\{ label: '关闭', value: 'light' \}/u)
assert.match(profileSource, /showActionSheetSelection/u)
assert.match(profileSource, /restartWithCampusThemePreference\(nextPreference\)/u)
assert.match(profileSource, /profile-theme-entry__value/u)
assert.doesNotMatch(profileSource, /<Switch/u)
assert.match(themePreference, /wx\.restartMiniProgram\(\{/u)
assert.match(themePreference, /path: '\/pages\/index\/index'/u)
assert.match(themePreference, /Taro\.reLaunch\(\{ url: '\/pages\/index\/index' \}\)/u)
assert.match(tabBarTemplate, /tab-bar--dark/u)
assert.match(tabBarSource, /getCampusTheme\(\) === 'dark'/u)
assert.match(tabBarStyle, /\.tab-bar--dark \.tab-bar__dock/u)
assert.doesNotMatch(tabBarStyle, /@media \(prefers-color-scheme: dark\)/u)
assert.match(aiThemeSource, /campus-theme-preference/u)
assert.match(aiThemeSource, /wx\.getAppBaseInfo\(\)/u)
assert.match(aiThemeSource, /wx\.getSystemInfoSync\(\)/u)
for (const source of aiThemeFiles) {
  assert.match(source.script, /getCampusTheme\(\) === 'dark'/u)
  assert.match(source.template, /darkMode \?/u)
  assert.match(source.style, /--dark/u)
  assert.doesNotMatch(source.style, /prefers-color-scheme/u)
}
assert.match(darkModeStyle, /\.campus-theme--dark\s*\{/u)
assert.doesNotMatch(darkModeStyle, /icon-button/u)
assert.match(darkModeStyle, /& \.service-panel__grid-icon/u)
assert.match(darkModeStyle, /&\.campus \.custom-navbar__fixed/u)
assert.match(darkModeStyle, /& \.schedule-card,/u)
assert.match(darkModeStyle, /& \.today-task,/u)
assert.match(darkModeStyle, /& \.official-notices-home,/u)
assert.match(darkModeStyle, /& \.community-panel,/u)
assert.match(darkModeStyle, /& \.market-panel/u)
assert.match(darkModeStyle, /& \.service-panel \{/u)
assert.doesNotMatch(
  darkModeStyle,
  /&\.campus\.campus \.service-panel__grid-item--key-[\w-]+ \.service-panel__grid-icon/u,
  '首页常用服务暗色样式应以 tone 为准，不能由业务 key 覆盖配色',
)
assert.match(darkModeStyle, /& \.today-card__event-row--important/u)
assert.match(darkModeStyle, /& \.official-notices-home__source/u)
assert.match(darkModeStyle, /& \.home-section-state/u)
assert.match(darkModeStyle, /& \.moments-feed__load-more/u)
assert.match(darkModeStyle, /& \.home-back-top \{/u)
assert.match(darkModeStyle, /& \.home-migrated/u)
assert.match(darkModeStyle, /&\.campus\.campus \.schedule-card/u)
assert.match(darkModeStyle, /&\.campus\.campus \.schedule-card__courses/u)
assert.match(darkModeStyle, /&\.campus\.campus \.schedule-card__meta/u)
assert.match(darkModeStyle, /&\.campus\.campus \.hero-card/u)
assert.match(darkModeStyle, /&\.campus\.campus \.hero-card\.hero-card--image \.hero-card__banner-image/u)
assert.match(darkModeStyle, /brightness\(0\.72\) saturate\(0\.88\)/u)
assert.match(darkModeStyle, /&\.clubs-page \.clubs-hero/u)
assert.match(darkModeStyle, /&\.clubs-page \.clubs-search,/u)
assert.match(darkModeStyle, /&\.clubs-page \.clubs-category--active/u)
assert.match(darkModeStyle, /&\.clubs-page \.clubs-viewbar__modes/u)
assert.match(darkModeStyle, /&\.clubs-page \.club-card__logo-placeholder/u)
assert.match(darkModeStyle, /&\.clubs-page \.club-directory-row/u)
assert.match(darkModeStyle, /&\.clubs-page \.clubs-inline-error/u)
assert.match(darkModeStyle, /& \.errand-card,/u)
assert.match(darkModeStyle, /& \.errand-route,/u)
assert.match(darkModeStyle, /& \.marketplace-card__placeholder/u)
assert.match(darkModeStyle, /& \.life-primary-tabs__inner/u)
assert.match(darkModeStyle, /& \.life-primary-tabs__item--active/u)
assert.match(
  darkModeStyle,
  /& \.life-primary-tabs__item--active\s*\{[^}]*background:\s*transparent/u,
  '社区业务主 Tab 的暗色选中态不应使用整块纯蓝背景',
)
assert.match(darkModeStyle, /& \.life-primary-tabs__item--active::after/u)
assert.match(darkModeStyle, /& \.community-root-tabs__item--active/u)
assert.match(darkModeStyle, /& \.community-page__search-action/u)
assert.match(darkModeStyle, /& \.community-post__social/u)
assert.match(
  darkModeStyle,
  /& \.community-post__engagement\s*\{[^}]*background:\s*var\(--campus-surface-subtle,\s*#172033\);[^}]*box-shadow:\s*inset 0 0 0 1rpx var\(--campus-border,\s*#243244\);/u,
  '列表评论摘要应使用中性次级表面和暗色细边界',
)
assert.doesNotMatch(
  darkModeStyle,
  /& \.community-post__comment-previews\s*\{[^}]*border-top(?:-color)?:/u,
  '暗色评论摘要区域不应恢复二级评论上方的横线',
)
assert.match(
  darkModeStyle,
  /& \.community-post__comment-preview-author\s*\{[^}]*color:\s*var\(--campus-text-secondary,\s*#aab8ca\);/u,
  '暗色列表评论昵称应回落到次级文字层，而不是高饱和蓝色',
)
assert.match(
  darkModeStyle,
  /& \.community-post__comments-all\s*\{[^}]*color:\s*var\(--campus-primary-strong,\s*#93c5fd\);/u,
)
assert.match(darkModeStyle, /& \.community-feed-skeleton__line/u)
assert.match(darkModeStyle, /& \.fresh-barrage__item/u)
assert.match(darkModeStyle, /& \.community-level-badge--gold/u)
assert.match(darkModeStyle, /& \.community-topic-page,/u)
assert.match(darkModeStyle, /& \.community-topic-page__participate/u)
assert.match(darkModeStyle, /& \.community-detail__main/u)
assert.match(darkModeStyle, /& \.community-detail__action image/u)
assert.match(darkModeStyle, /& \.community-detail__action--liked/u)
assert.doesNotMatch(darkModeStyle, /& \.community-detail__toolbar-action/u)
assert.match(darkModeStyle, /& \.community-detail-card__review/u)
assert.match(darkModeStyle, /& \.business-detail-comments/u)
assert.match(darkModeStyle, /& \.business-detail-composer/u)
assert.match(darkModeStyle, /& \.business-detail-composer__persistent-contact-icon/u)
assert.match(darkModeStyle, /& \.business-detail-composer__publish--marketplace::before/u)
assert.match(darkModeStyle, /& \.detail-state/u)
assert.match(darkModeStyle, /& \.detail-review-alert/u)
assert.match(darkModeStyle, /&\.life-detail--market \.market-detail-badges/u)
assert.match(darkModeStyle, /&\.life-detail--carpool \.detail-inline-action/u)
assert.match(darkModeStyle, /& \.verification-method--active/u)
assert.match(darkModeStyle, /& \.verification-education-option--active/u)
assert.match(darkModeStyle, /& \.verification-password-control/u)
assert.match(darkModeStyle, /& \.verification-password-coach-mark/u)
assert.match(
  darkModeStyle,
  /& \.verification-field input\.verification-field__input/u,
  '教务账号输入框缺少暗色文字色',
)
assert.match(
  darkModeStyle,
  /& \.verification-password-control input\.verification-password-control__input\s*\{/u,
  '密码输入框缺少暗色文字色',
)
assert.match(darkModeStyle, /& \.verification-upload/u)
assert.match(darkModeStyle, /& \.bottom-sheet-layer/u)
assert.match(darkModeStyle, /& \.academic-sheet,/u)
assert.match(darkModeStyle, /& \.period-options__item--active/u)
assert.match(darkModeStyle, /& \.grade-summary,/u)
assert.match(darkModeStyle, /& \.shuttle-detail-panel/u)
assert.match(darkModeStyle, /& \.shuttle-detail-actions/u)
assert.match(
  shuttleDetailStyle,
  /&__bus\s*\{[^}]*background:\s*rgba\(18,\s*73,\s*142,\s*0\.26\)/u,
  '校车详情顶部图标不得使用白色底板',
)
assert.match(
  shuttleDetailStyle,
  /&__direction\s*\{[^}]*background:\s*rgba\(18,\s*73,\s*142,\s*0\.22\)/u,
  '校车详情起终点长条不得使用白色背景',
)
assert.match(darkModeStyle, /& \.calendar-hero,/u)
assert.doesNotMatch(darkModeStyle, /page\s+image\s*\{/u, '不能全局反色用户上传的图片')

const pageConfigPaths = require('node:child_process')
  .execFileSync('rg', ['--files', 'src/pages', '-g', '*.config.ts'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

for (const path of pageConfigPaths) {
  const source = read(path)
  if (/backgroundColor:/u.test(source)) {
    assert.match(source, /backgroundColor:\s*'@backgroundColor'/u, `${path} 未使用主题背景变量`)
  }
  if (/backgroundTextStyle:/u.test(source)) {
    assert.match(
      source,
      /backgroundTextStyle:\s*'@backgroundTextStyle'/u,
      `${path} 未使用主题下拉刷新变量`,
    )
  }
}

const parseHex = (value: string): [number, number, number] => {
  const normalized = value.replace('#', '')
  assert.equal(normalized.length, 6, `无法解析颜色：${value}`)
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number]
}

const luminance = (value: string) => {
  const channels = parseHex(value).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const contrast = (foreground: string, background: string) => {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

assert.ok(contrast('#f8fafc', '#111827') >= 4.5, '暗色标题与卡片背景对比度不足')
assert.ok(contrast('#d7e0ec', '#111827') >= 4.5, '暗色正文与卡片背景对比度不足')
assert.ok(contrast('#8494aa', '#0b1220') >= 4.5, '暗色辅助文字与页面背景对比度不足')
assert.ok(contrast('#aab8ca', '#172033') >= 4.5, '暗色社区未选中标签对比度不足')
assert.ok(contrast('#ffffff', '#0e7490') >= 4.5, '暗色社区选中标签对比度不足')
assert.ok(contrast('#ffffff', '#2563eb') >= 4.5, '暗色社区主操作文字对比度不足')
assert.ok(contrast('#ffffff', '#7e22ce') >= 4.5, '暗色闲置主操作文字对比度不足')
assert.ok(contrast('#ffffff', '#c2410c') >= 4.5, '暗色跑腿主操作文字对比度不足')
assert.ok(contrast('#ffffff', '#0f766e') >= 4.5, '暗色找同行主操作文字对比度不足')
assert.ok(contrast('#fde68a', '#38331a') >= 4.5, '暗色社区等级徽章对比度不足')
assert.ok(contrast('#ffffff', '#1d4ed8') >= 4.5, '暗色学业与校车头图文字对比度不足')
assert.ok(contrast('#93c5fd', '#172554') >= 4.5, '暗色浮层选项文字对比度不足')
assert.match(
  academicStyle,
  /\.campus-theme--dark\s*\{[\s\S]*\.academic-toolbar--schedule \.academic-toolbar__period image\s*\{[\s\S]*filter:/u,
  '课表学期图标缺少页面最终样式层的暗色适配',
)
assert.match(
  academicStyle,
  /\.campus-theme--dark\s*\{[\s\S]*\.course-float-card\s*\{[\s\S]*background:\s*var\(--campus-surface,\s*#111827\)/u,
  '课程详情浮层缺少页面最终样式层的暗色表面',
)
assert.match(
  academicStyle,
  /\.campus-theme--dark\s*\{[\s\S]*\.course-conflict-card\s*\{[\s\S]*&__name\s*\{\s*color:\s*var\(--campus-text-heading,\s*#f8fafc\)/u,
  '课程详情卡片缺少页面最终样式层的暗色文字',
)
assert.match(
  courseCatalogStyle,
  /\.campus-theme--dark\s*\{[\s\S]*&\.course-catalog-page\s*\{[\s\S]*--course-accent:\s*var\(--campus-primary,/u,
  '蹭课页缺少页面最终样式层的暗色主题变量',
)
assert.match(
  courseCatalogStyle,
  /&\.course-catalog-page \.course-catalog-search__card,[\s\S]*&\.course-catalog-page \.course-catalog-card\s*\{[\s\S]*background:\s*var\(--campus-surface,/u,
  '蹭课页搜索卡片和课程卡片缺少暗色表面',
)
assert.match(
  courseCatalogStyle,
  /&\.course-catalog-page \.course-catalog-search__field,[\s\S]*&\.course-catalog-page \.course-catalog-search__advanced-category\s*\{[\s\S]*background:\s*var\(--campus-surface-subtle,/u,
  '蹭课页筛选输入区域缺少暗色次级表面',
)
assert.match(
  courseCatalogStyle,
  /&\.course-catalog-page \.course-catalog-slots\s*\{[\s\S]*background:\s*var\(--campus-surface-subtle,[\s\S]*&\.course-catalog-page \.course-catalog-slot\s*\{[\s\S]*background:\s*var\(--campus-surface,/u,
  '蹭课页排课槽位缺少暗色层级',
)
assert.match(
  courseCatalogStyle,
  /&\.course-catalog-page \.course-catalog-empty__action\s*\{[\s\S]*border-color:\s*var\(--campus-border-strong,/u,
  '蹭课页空状态操作按钮缺少暗色边框',
)
assert.match(
  courseCatalogStyle,
  /\.campus-theme--dark \.course-catalog-page\s*\{[\s\S]*--course-accent:\s*var\(--campus-primary,/u,
  '蹭课页缺少主题类作为外层容器时的暗色主题变量兼容路径',
)
assert.match(
  courseCatalogStyle,
  /\.campus-theme--dark \.course-catalog-page \.course-catalog-search__field,[\s\S]*\.campus-theme--dark \.course-catalog-page \.course-catalog-search__advanced-category\s*\{[\s\S]*background:\s*var\(--campus-surface-subtle,/u,
  '蹭课页缺少主题类作为外层容器时的暗色筛选区域',
)
assert.doesNotMatch(
  darkModeStyle,
  /service-panel__grid-icon image\s*\{[\s\S]{0,240}filter:/u,
  '首页服务入口不得在暗色模式下使用 CSS 图像滤镜',
)
assert.doesNotMatch(
  read('src/pages/index/index.scss'),
  /&__grid-icon image\s*\{[\s\S]{0,240}filter:/u,
  '首页服务入口不得在浅色模式下使用 CSS 图像滤镜',
)
assert.match(homeSource, /const homeServiceIcons = \{/u)
assert.match(homeSource, /home-service-schedule\.svg/u)
assert.match(homeSource, /home-service-calendar-dark\.svg/u)
assert.match(homeSource, /homeServiceIcons\[campusTheme\]\[item\.iconKey\]/u)
assert.match(read('src/pages/index/index.scss'), /--campus-icon-surface-blue/u)
assert.match(read('src/pages/index/index.scss'), /--campus-icon-surface-cyan/u)
assert.match(read('src/pages/index/index.scss'), /--campus-icon-surface-orange/u)
assert.match(read('src/pages/index/index.scss'), /--campus-icon-surface-pink/u)

console.log('dark mode smoke: ok')
