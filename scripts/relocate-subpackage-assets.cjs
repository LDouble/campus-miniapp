const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// isStaticAssetModule 仅接受 webpack 资源模块导出的完整字符串，排除拼接和运行期表达式。
const isStaticAssetModule = (file, text, asset) => {
  if (!file.endsWith('.js')) return false
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const literals = []
  let unsafe = source.parseDiagnostics.length > 0
  const visit = (node) => {
    if (ts.isStringLiteral(node) && node.text.includes(asset)) {
      const parent = node.parent
      const literal = node.getText(source)
      if (![JSON.stringify(`/${asset}`), `'/${asset}'`].includes(literal)
        || node.text !== `/${asset}` || !ts.isBinaryExpression(parent)
        || parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken || parent.right !== node
        || !ts.isPropertyAccessExpression(parent.left) || parent.left.name.text !== 'exports'
        || !ts.isIdentifier(parent.left.expression)) unsafe = true
      else literals.push(node.getText(source))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  let remaining = text
  for (const literal of literals) remaining = remaining.split(literal).join('')
  return !unsafe && literals.length > 0 && !remaining.includes(asset)
}

// relocateSubpackageAssets 将仅供分包使用的静态资源随分包打包，不改变资源内容。
const relocateSubpackageAssets = (outputRoot) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, 'app.json'), 'utf8'))
  const roots = (manifest.subPackages || manifest.subpackages || [])
    .map(({ root }) => root.replace(/\/$/, ''))
    .sort((a, b) => b.length - a.length)
  const files = []
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) files.push(path.relative(outputRoot, absolute).split(path.sep).join('/'))
    }
  }
  walk(outputRoot)
  const texts = new Map(files.filter((file) => /\.(js|json|wxml|wxss|wxs|svg)$/i.test(file))
    .map((file) => [file, fs.readFileSync(path.join(outputRoot, file), 'utf8')]))
  let saved = 0
  let count = 0
  for (const asset of files.filter((file) => /^assets\/.+\.(png|jpe?g|gif|svg|webp)$/i.test(file))) {
    const references = [...texts].filter(([, text]) => text.includes(asset))
    if (!references.length) continue
    const destinations = new Map()
    let safe = true
    for (const [file, text] of references) {
      const root = roots.find((candidate) => file.startsWith(`${candidate}/`))
      // 主包仍引用、动态拼接或相对路径引用时保持原位置，避免改变解析语义。
      if (!root || !isStaticAssetModule(file, text, asset)) { safe = false; break }
      destinations.set(file, `${root}/_resources/${asset.slice('assets/'.length)}`)
    }
    if (!safe) continue
    const content = fs.readFileSync(path.join(outputRoot, asset))
    // SVG 若含外部依赖，移动目录会改变其相对路径语义，保守保留在原位置。
    if (asset.toLowerCase().endsWith('.svg')) {
      const links = [...content.toString('utf8').matchAll(/(?:href\s*=\s*["']([^"']+)|url\(\s*["']?([^)'";]+))/gi)]
      if (/@import|<\?xml-stylesheet/i.test(content.toString('utf8'))) continue
      if (links.some((match) => !/^(#|data:)/.test((match[1] || match[2]).trim()))) continue
    }
    const targets = new Set(destinations.values())
    // 先检查所有目标，防止覆盖构建本来已有的同名文件。
    for (const target of targets) {
      const destination = path.join(outputRoot, target)
      if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(content)) {
        throw new Error(`分包资源目标冲突：${target}`)
      }
    }
    for (const target of targets) {
      const destination = path.join(outputRoot, target)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, content)
    }
    for (const [file, target] of destinations) {
      const text = texts.get(file).split(`"/${asset}"`).join(`"/${target}"`)
        .split(`'/${asset}'`).join(`'/${target}'`)
      texts.set(file, text)
      fs.writeFileSync(path.join(outputRoot, file), text)
    }
    fs.unlinkSync(path.join(outputRoot, asset))
    saved += content.length
    count++
  }
  return { saved, count }
}

if (require.main === module) {
  const { saved, count } = relocateSubpackageAssets(path.resolve(process.argv[2] || 'dist/full'))
  console.log(`分包资源归位：${count} 个，主包减少 ${saved} bytes；资源内容保持不变。`)
}

module.exports = { relocateSubpackageAssets }
