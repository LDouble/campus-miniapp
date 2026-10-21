const fs = require('node:fs')
const path = require('node:path')

// inspectMainPackage 统计实际产物，排除分包；按未经过 IDE 二次压缩的大小保守校验。
const inspectMainPackage = (outputRoot) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, 'app.json'), 'utf8'))
  const roots = (manifest.subPackages || manifest.subpackages || [])
    .map(({ root }) => `${root.replace(/\/$/, '')}/`)
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(outputRoot, absolute).split(path.sep).join('/')
      if (roots.some((root) => `${relative}/`.startsWith(root))) continue
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile()) files.push({ path: relative, bytes: fs.statSync(absolute).size })
    }
  }
  visit(outputRoot)
  return { bytes: files.reduce((sum, file) => sum + file.bytes, 0), files }
}

if (require.main === module) {
  const outputRoot = path.resolve(process.argv[2] || 'dist/full')
  const { bytes, files } = inspectMainPackage(outputRoot)
  const limit = 2048 * 1024
  console.log(`微信主包原始体积：${bytes} bytes / ${limit} bytes（${(bytes / 1024).toFixed(1)} KiB）`)
  for (const file of files.sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
    console.log(`  ${(file.bytes / 1024).toFixed(1)} KiB  ${file.path}`)
  }
  if (bytes > limit) {
    console.error('主包超过 2 MiB，请先减包再上传；此检查不依赖 IDE 的二次压缩。')
    process.exitCode = 1
  }
}

module.exports = { inspectMainPackage }
