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

module.exports = (ctx) => {
  ctx.modifyBuildAssets(({ assets }) => {
    if (process.env.TARO_ENV !== 'weapp') return
    removeUnsupportedScrollViewPadding(assets)
  })
}
