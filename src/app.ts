import { useEffect } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import {
  loadMiniappRuntimeConfig,
  resolveMiniappModule,
  type MiniappModuleKey,
} from './features/runtime-config'
// 全局样式
import './app.scss'

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {})

  // 对应 onShow
  useDidShow(() => {
    void guardCurrentPage()
  })

  // 对应 onHide
  useDidHide(() => {})

  return props.children
}

type CurrentPage = {
  route?: string
  options?: Record<string, string>
}

const pageModule = (page: CurrentPage): MiniappModuleKey | null => {
  const route = page.route || ''
  if (route === 'pages/community/detail') return 'community'
  if (route.startsWith('pages/errands/')) return 'errand'
  if (route.startsWith('pages/marketplace/')) return 'marketplace'
  if (route.startsWith('pages/carpool/')) return 'carpool'
  if (route.startsWith('pages/academic/schedule/')) return 'academic_schedule'
  if (route.startsWith('pages/academic/grades/')) return 'academic_grades'
  if (route.startsWith('pages/academic/exams/')) return 'academic_exams'
  if (route.startsWith('pages/academic/selection/')) return 'academic_selection'
  if (route.startsWith('pages/academic/statistics/')) return 'academic_statistics'
  if (route.startsWith('pages/calendar/')) return 'calendar'
  if (route.startsWith('pages/materials/')) return 'course_materials'
  if (route.startsWith('pages/empty-classroom/')) return 'empty_classroom'
  if (route.startsWith('pages/shuttle/')) return 'shuttle'
  if (route === 'pages/publish/index') {
    const sections: Record<string, MiniappModuleKey> = {
      community: 'community',
      errands: 'errand',
      market: 'marketplace',
      carpool: 'carpool',
    }
    return sections[page.options?.section || ''] || null
  }
  return null
}

const guardCurrentPage = async () => {
  const pages = Taro.getCurrentPages() as CurrentPage[]
  const page = pages[pages.length - 1]
  if (!page || page.route === 'pages/feature-unavailable/index') return
  const moduleKey = pageModule(page)
  if (!moduleKey) return
  const config = await loadMiniappRuntimeConfig()
  const module = resolveMiniappModule(config, moduleKey)
  if (module.state === 'enabled') return
  if (module.state === 'maintenance') {
    await Taro.redirectTo({
      url: `/pages/feature-unavailable/index?module=${moduleKey}&message=${encodeURIComponent(
        module.message || '功能维护中，请稍后再试',
      )}`,
    }).catch(() => undefined)
    return
  }
  await Taro.reLaunch({ url: '/pages/index/index' }).catch(() => undefined)
  await Taro.showToast({ title: '该功能暂未开放', icon: 'none' })
}

export default App
