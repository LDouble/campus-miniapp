const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('src/pages/goods/index.tsx', 'utf8')
const ast = ts.createSourceFile('home.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let hook
function visit(node) {
 if(ts.isCallExpression(node) && node.expression.getText(ast)==='useDidShow') hook=node.arguments[0].getText(ast)
 node.forEachChild(visit)
}
visit(ast)
const code=ts.transpileModule(`return (${hook})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
async function check(mode, revision, enabled, expected) {
 let loads=0, clears=0
 const env={catalogMode:mode,pageActiveRef:{current:false},handledCapabilityRevision:{current:1},requestRevision:{current:0},loadingRef:{current:false},loadedRef:{current:true},taxonomyRequested:{current:true},catalogLoadMoreRef:{current:null},
 setPageActive(){},syncCustomTabBar(){},loadShortcuts:async()=>{},refreshAffiliateCapabilities:async()=>({revision,capabilities:{enabled}}),loadCatalog:async()=>{loads++},
 setProducts(){clears++},setCategories(){},setTopics(){},setLoaded(){},setPurchaseProduct(){},setLoading(){},setLoadingMore(){},setError(){},setLoadMoreError(){}}
 new Function(...Object.keys(env),code)(...Object.values(env))()
 await Promise.resolve();await Promise.resolve()
 assert.equal(loads,expected)
 if(mode==='enabled' && revision===1)assert.equal(clears,0,'详情返回不得清空列表')
}
;(async()=>{
 await check('enabled',1,true,0)
 await check('disabled',1,true,0)
 await check('checking',1,true,1)
 await check('error',1,true,1)
 await check('enabled',2,true,1)
 await check('enabled',2,false,0)
 for(const kind of ['catalog/catalog-section.tsx','rankings/ranking-section.tsx']) {
  const s=fs.readFileSync('src/features/affiliate/'+kind,'utf8')
  assert.ok(!s.includes('if (!active || !capabilityEnabled) return null'))
 }
 assert.match(fs.readFileSync('src/custom-tab-bar/index.js','utf8'),/text: '优惠中心'/)
 console.log('affiliate return state: ok')
})().catch(e=>{console.error(e);process.exitCode=1})
