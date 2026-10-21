const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { inspectMainPackage } = require('./check-weapp-package-size.cjs')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-package-size-'))
try {
  const manifest = JSON.stringify({ subPackages: [{ root: 'packages/social' }] })
  fs.writeFileSync(path.join(root, 'app.json'), manifest)
  fs.writeFileSync(path.join(root, 'app.js'), '中文')
  for (const directory of ['packages/social', 'packages/social-extra']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true })
    fs.writeFileSync(path.join(root, directory, 'page.js'), '12345')
  }
  const result = inspectMainPackage(root)
  assert.equal(result.bytes, Buffer.byteLength(manifest) + Buffer.byteLength('中文') + 5)
  assert.deepEqual(result.files.map((file) => file.path).sort(), ['app.js', 'app.json', 'packages/social-extra/page.js'])
  fs.writeFileSync(path.join(root, 'large.js'), Buffer.alloc(2048 * 1024))
  const rejected = spawnSync(process.execPath, [path.join(__dirname, 'check-weapp-package-size.cjs'), root], { encoding: 'utf8' })
  assert.equal(rejected.status, 1, '超限必须阻断构建')
  assert.match(rejected.stderr, /主包超过 2 MiB/)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
console.log('主包统计：UTF-8 字节数、分包排除和路径边界检查通过')

const { relocateSubpackageAssets } = require('./relocate-subpackage-assets.cjs')
const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-package-assets-'))
try {
  fs.mkdirSync(path.join(packageRoot, 'assets'))
  for (const directory of ['pages/first', 'pages/second']) fs.mkdirSync(path.join(packageRoot, directory), { recursive: true })
  fs.writeFileSync(path.join(packageRoot, 'app.json'), JSON.stringify({ subPackages: [{ root: 'pages/first' }, { root: 'pages/second' }] }))
  const content = Buffer.from([137, 80, 78, 71, 0, 1, 2, 3])
  for (const name of ['only', 'shared', 'dynamic', 'dynamic-absolute', 'escaped', 'relative', 'unused']) fs.writeFileSync(path.join(packageRoot, `assets/${name}.png`), content)
  fs.writeFileSync(path.join(packageRoot, 'assets/external.svg'), '<svg><image href="shared.png" /></svg>')
  fs.writeFileSync(path.join(packageRoot, 'pages/first/icon.js'), 'module.exports="/assets/external.svg"')
  fs.writeFileSync(path.join(packageRoot, 'assets/external.SVG'), '<svg><image href="shared.png" /></svg>')
  fs.writeFileSync(path.join(packageRoot, 'pages/first/icon-upper.js'), 'module.exports="/assets/external.SVG"')
  fs.writeFileSync(path.join(packageRoot, 'pages/first/escaped.js'), String.raw`module.exports="\u002fassets/escaped.png"`)
  const main = 'module.exports="/assets/shared.png"'
  fs.writeFileSync(path.join(packageRoot, 'app.js'), main)
  fs.writeFileSync(path.join(packageRoot, 'pages/first/index.js'), 'module.exports="/assets/only.png";module.exports="/assets/shared.png";prefix+"assets/dynamic.png";module.exports=prefix+"/assets/dynamic-absolute.png";read("../../assets/relative.png")')
  fs.writeFileSync(path.join(packageRoot, 'pages/second/index.js'), "module.exports='/assets/only.png'")
  assert.deepEqual(relocateSubpackageAssets(packageRoot), { saved: content.length, count: 1 })
  assert.equal(fs.readFileSync(path.join(packageRoot, 'app.js'), 'utf8'), main)
  assert.equal(fs.existsSync(path.join(packageRoot, 'assets/only.png')), false)
  assert.equal(fs.existsSync(path.join(packageRoot, 'assets/external.svg')), true, '外部依赖 SVG 不得迁移')
  assert.equal(fs.existsSync(path.join(packageRoot, 'assets/external.SVG')), true, '大写扩展名也必须检查外部依赖')
  for (const directory of ['pages/first', 'pages/second']) {
    assert.deepEqual(fs.readFileSync(path.join(packageRoot, directory, '_resources/only.png')), content)
    assert.ok(fs.readFileSync(path.join(packageRoot, directory, 'index.js'), 'utf8').includes(`/${directory}/_resources/only.png`))
  }
  for (const name of ['shared', 'dynamic', 'dynamic-absolute', 'escaped', 'relative', 'unused']) assert.equal(fs.existsSync(path.join(packageRoot, `assets/${name}.png`)), true)
  assert.deepEqual(relocateSubpackageAssets(packageRoot), { saved: 0, count: 0 }, '重复执行不得再次改路径或资源')
  fs.writeFileSync(path.join(packageRoot, 'assets/only.png'), content)
  fs.writeFileSync(path.join(packageRoot, 'pages/first/index.js'), 'module.exports="/assets/only.png"')
  fs.writeFileSync(path.join(packageRoot, 'pages/first/_resources/only.png'), 'conflict')
  assert.throws(() => relocateSubpackageAssets(packageRoot), /目标冲突/)
  assert.equal(fs.existsSync(path.join(packageRoot, 'assets/only.png')), true)
} finally {
  fs.rmSync(packageRoot, { recursive: true, force: true })
}
console.log('分包资源归位：内容保真、跨包复制、主包共享保留、动态和相对路径保留、重复执行及冲突保护检查通过')
