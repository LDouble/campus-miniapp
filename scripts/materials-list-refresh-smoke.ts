import { strict as assert } from 'node:assert'
import fs = require('node:fs')
import path = require('node:path')
import Module = require('node:module')

const loader = Module as unknown as { _load: (name: string, parent?: unknown, isMain?: boolean) => unknown }
const originalLoad = loader._load
const miniappRoot = process.env.MATERIALS_MINIAPP_ROOT || path.resolve(__dirname, '..')
const sourceRoot = path.join(miniappRoot, 'src')
const jsx = (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props || {} })
const components = { View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', Picker: 'Picker' }
loader._load = function (request, parent, isMain) {
  if (request === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
  if (request === '@tarojs/components') return components
  if (request === '../../components/keyboard-safe-input') return { KeyboardSafeInput: 'KeyboardSafeInput' }
  if (request === './upload-drawer') return { MaterialsPlazaUploadDrawer: 'MaterialsPlazaUploadDrawer' }
  if (/\.(svg|scss)$/.test(request)) return request
  return originalLoad.call(this, request, parent, isMain)
}

const { default: MaterialsPlazaView } = originalLoad.call(loader, path.join(sourceRoot, 'features/materials-plaza/view.tsx'), module, false) as { default: (props: unknown) => unknown }
loader._load = originalLoad

const findNodes = (node: unknown, predicate: (node: any) => boolean): any[] => {
  if (Array.isArray(node)) return node.flatMap((child) => findNodes(child, predicate))
  if (!node || typeof node !== 'object') return []
  const current = node as any
  if (typeof current.type === 'function') return findNodes(current.type(current.props), predicate)
  const result = predicate(current) ? [current] : []
  return result.concat(findNodes(current.props?.children, predicate))
}

const material = {
  id: '1',
  title: '课程资料',
  typeLabel: '试卷',
}
const baseProps = {
  searchValue: '',
  onSearchChange: () => {},
  onSearch: () => {},
  items: [material],
  upload: {
    visible: false,
    source: 'file' as const,
    files: [],
    cloudLink: '',
    title: '',
    typeOptions: [],
    selectedCourses: [],
    suggestedCourses: [],
    canSubmit: false,
    onClose: () => {},
    onSourceChange: () => {},
    onChooseFiles: () => {},
    onRemoveFile: () => {},
    onCloudLinkChange: () => {},
    onParseCloudLink: () => {},
    onTitleChange: () => {},
    onTypeSelect: () => {},
    onCourseToggle: () => {},
    onOpenCourseSearch: () => {},
    onSubmit: () => {},
  },
  onOpenUpload: () => {},
}
const configSource = fs.readFileSync(path.join(sourceRoot, 'pages/materials/index.config.ts'), 'utf8')

assert.match(configSource, /enablePullDownRefresh:\s*true/u, '资料页允许下拉刷新')

const tree = MaterialsPlazaView({ ...baseProps, loadingMore: true })
assert.equal(findNodes(tree, (node) => String(node.props?.className || '').split(' ').includes('materials-plaza-card')).length, 1, '加载下一页期间保留已渲染资料卡')
assert.equal(findNodes(tree, (node) => node.props?.className === 'materials-loading-more').length, 1, '分页状态显示在列表尾部')

console.log('materials list refresh smoke: ok')
