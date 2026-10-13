import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as ts from 'typescript'

const verify = async (savedLevel: string) => {
  const effects: Array<() => void> = []
  const requests: Array<{ level: string; force?: boolean }> = []
  let refresh: () => Promise<void> = async () => {}
  const state: unknown[] = []
  let stateIndex = 0
  const source = readFileSync('src/pages/empty-classroom/index.tsx', 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports: { default?: () => void } = {}
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === 'react') return {
        useState: (value: unknown) => {
          const index = stateIndex++
          if (!(index in state)) state[index] = value
          return [state[index], (next: unknown) => { state[index] = next }]
        },
        useRef: (value: unknown) => ({ current: value }),
        useMemo: (factory: () => unknown) => factory(),
        useCallback: (callback: unknown) => callback,
        useEffect: (effect: () => void) => effects.push(effect),
      }
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null }
      if (name === '@tarojs/taro') return {
        default: { stopPullDownRefresh: () => {} },
        useLoad: () => {},
        usePullDownRefresh: (callback: () => Promise<void>) => { refresh = callback },
      }
      if (name.endsWith('/runtime-config')) return {
        getMiniappRuntimeConfig: () => ({}),
        getSelectedCampus: () => '崂山校区',
        enabledCampuses: () => ['崂山校区'],
        loadMiniappRuntimeConfig: async () => ({}),
      }
      if (name.endsWith('/calendar/repository')) return {
        getCalendarEducationLevel: () => savedLevel,
        loadAcademicCalendar: async (level: string, options: { force?: boolean } = {}) => {
          requests.push({ level, force: options.force })
          return { calendar: null }
        },
      }
      if (name.endsWith('/calendar/utils')) return {
        resolveAcademicWeekday: () => null,
        resolveAcademicCalendarState: () => ({ kind: 'unavailable' }),
      }
      if (name.endsWith('/day-view')) return { filterDayViewBuilding: () => [] }
      if (name.endsWith('/keyboard-safe-input')) return { useKeyboardInset: () => ({}) }
      if (name.endsWith('/share')) return { useCampusShare: () => {} }
      if (name.endsWith('/api/client')) return { isApiError: () => false }
      return {}
    },
  })
  exports.default!()
  effects[0]()
  await new Promise((resolve) => setImmediate(resolve))
  stateIndex = 0
  exports.default!()
  await refresh()
  assert.equal(requests.length, 2, '首次加载和下拉刷新都应请求校历')
  assert.equal(requests[0].level, 'undergraduate', `${savedLevel} 用户首次加载应使用本科校历`)
  assert.equal(requests[1].level, 'undergraduate', `${savedLevel} 用户刷新应使用本科校历`)
  assert.equal(requests[1].force, true, '下拉刷新应强制更新校历')
}

void (async () => {
  await verify('graduate')
  await verify('undergraduate')
  console.log('空教室校历加载回归验证通过')
})()
