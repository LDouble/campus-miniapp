import CatalogList from './catalog-list'

// 保留旧列表路由的兼容入口，但由当前页面模块独立注册一次 Page。
export default function CatAtlasListPage() {
  return <CatalogList />
}
