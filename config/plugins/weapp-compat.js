const { sources } = require('webpack')

const removeUnsupportedScrollViewPadding = (assets) => {
  const baseTemplate = assets['base.wxml']
  if (!baseTemplate) return

  const source = String(baseTemplate.source())
  const nextSource = source.replace(
    /(<scroll-view\b[^>]*?)\s+padding="\{\{i\.[^"|]+\|\|\[0,0,0,0\]\}\}"/g,
    '$1',
  )
  if (nextSource === source) return

  assets['base.wxml'] = new sources.RawSource(nextSource)
}

const injectCampusPageRootClass = (assets) => {
  const baseTemplate = assets['base.wxml']
  if (!baseTemplate) return
  const source = String(baseTemplate.source())
  assets['base.wxml'] = new sources.RawSource(source.replace(
    /class="\{\{i\.cl\}\}"/g,
    `class="{{c===1?'campus-theme ':''}}{{i.cl}}"`,
  ))
}

// bindCustomAdClose 补齐当前 Taro 模板未声明的广告关闭事件。
const bindCustomAdClose = (assets) => {
  const template = assets['base.wxml']
  if (!template) return
  assets['base.wxml'] = new sources.RawSource(String(template.source()).replace(
    /<ad-custom\b[^>]*>/g,
    (tag) => /\bbindclose=/.test(tag) ? tag : tag.replace('>', ' bindclose="eh">'),
  ))
}

module.exports = (ctx) => {
  ctx.modifyBuildAssets(({ assets }) => {
    if (process.env.TARO_ENV !== 'weapp') return
    removeUnsupportedScrollViewPadding(assets)
    injectCampusPageRootClass(assets)
    bindCustomAdClose(assets)
  })
}
