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

const resolveThemeBackgroundColors = (assets) => {
  const fallback = { light: '#f4f7fb', dark: '#0b1220' }
  const themeAsset = assets['theme.json']
  if (!themeAsset) return fallback

  try {
    const theme = JSON.parse(String(themeAsset.source()))
    const light = theme.light?.backgroundColor
    const dark = theme.dark?.backgroundColor
    if (typeof light !== 'string' || typeof dark !== 'string') return fallback
    return { light, dark }
  } catch {
    return fallback
  }
}

const createThemePageMeta = ({ light, dark }) => {
  const background = `{{__campusTheme==='dark'?'${dark}':'${light}'}}`
  const backgroundTextStyle = "{{__campusTheme==='dark'?'light':'dark'}}"
  return [
    '<page-meta',
    ` page-style="background-color:${background};"`,
    ` background-color="${background}"`,
    ` background-color-top="${background}"`,
    ` background-color-bottom="${background}"`,
    ` root-background-color="${background}"`,
    ` background-text-style="${backgroundTextStyle}"`,
    ' />',
  ].join('')
}

const injectCampusThemeIntoPageRoots = (assets) => {
  const baseTemplate = assets['base.wxml']
  if (!baseTemplate) return
  const themeBackgroundColors = resolveThemeBackgroundColors(assets)

  const baseSource = String(baseTemplate.source())
  const themedClass = "{{c===1&&t?'campus-theme campus-theme--'+t+' ':''}}{{i.cl}}"
  let nextBaseSource = baseSource.replace(
    /class="\{\{i\.cl\}\}"/g,
    `class="${themedClass}"`,
  )

  const templateDataBindings = [
    "data=\"{{i:item,c:1,l:xs.f('',item.nn)}}\"",
    'data="{{i:item,c:c+1,l:xs.f(l,item.nn)}}"',
    'data="{{i:item,c:c,l:l}}"',
    'data="{{i:i,c:c}}"',
  ]
  for (const binding of templateDataBindings) {
    nextBaseSource = nextBaseSource.replaceAll(
      binding,
      binding.replace('}}"', ',t:t}}"'),
    )
  }

  if (nextBaseSource !== baseSource) {
    assets['base.wxml'] = new sources.RawSource(nextBaseSource)
  }

  for (const [assetPath, asset] of Object.entries(assets)) {
    if (!assetPath.endsWith('.wxml') || assetPath === 'base.wxml') continue

    const jsonAsset = assets[assetPath.replace(/\.wxml$/u, '.json')]
    if (!jsonAsset) continue

    try {
      const componentConfig = JSON.parse(String(jsonAsset.source()))
      if (componentConfig.component === true) continue
    } catch {
      continue
    }

    const source = String(asset.source())
    let nextSource = source.replace(
      'data="{{root:root}}"',
      'data="{{root:root,t:__campusTheme}}"',
    )
    if (!nextSource.startsWith('<page-meta')) {
      nextSource = `${createThemePageMeta(themeBackgroundColors)}${nextSource}`
    }
    if (nextSource === source) continue

    assets[assetPath] = new sources.RawSource(nextSource)
  }

  const initialThemeExpression = [
    '(function(){try{',
    "var p=wx.getStorageSync('campus-theme-preference');",
    "if(p==='light'||p==='dark')return p;",
    "var a=wx.getAppBaseInfo&&wx.getAppBaseInfo();",
    "if(a&&(a.theme==='light'||a.theme==='dark'))return a.theme;",
    "var s=wx.getSystemInfoSync&&wx.getSystemInfoSync();",
    "return s&&s.theme==='dark'?'dark':'light'",
    "}catch(e){return 'light'}})()",
  ].join('')

  for (const [assetPath, asset] of Object.entries(assets)) {
    if (!assetPath.endsWith('.js')) continue

    const jsonAsset = assets[assetPath.replace(/\.js$/u, '.json')]
    if (!jsonAsset) continue

    try {
      const componentConfig = JSON.parse(String(jsonAsset.source()))
      if (componentConfig.component === true) continue
    } catch {
      continue
    }

    const source = String(asset.source())
    const nextSource = source.replace(
      /\{root:\{cn:\[\]\}\}/gu,
      `{root:{cn:[]},__campusTheme:${initialThemeExpression}}`,
    )
    if (nextSource === source) continue

    assets[assetPath] = new sources.RawSource(nextSource)
  }
}

module.exports = (ctx) => {
  ctx.modifyBuildAssets(({ assets }) => {
    if (process.env.TARO_ENV !== 'weapp') return
    removeUnsupportedScrollViewPadding(assets)
    injectCampusThemeIntoPageRoots(assets)
  })
}
