export type LifeHubSection = 'community' | 'errands' | 'market' | 'carpool'

export type LifeBusinessTheme = {
  key: LifeHubSection
  label: string
  title: string
  subtitle: string
  eyebrow: string
  searchHint: string
  publishLabel: string
}

export const lifeBusinessThemes: Record<LifeHubSection, LifeBusinessTheme> = {
  community: {
    key: 'community',
    label: '社区',
    title: '校园社区',
    subtitle: '发现校园里的新鲜事',
    eyebrow: '此刻校园',
    searchHint: '搜索动态、话题或校园关键词',
    publishLabel: '发动态',
  },
  errands: {
    key: 'errands',
    label: '跑腿',
    title: '校园跑腿',
    subtitle: '任务、报酬和时效一眼看清',
    eyebrow: '校园互助',
    searchHint: '搜索地点、物品或任务',
    publishLabel: '发任务',
  },
  market: {
    key: 'market',
    label: '二手',
    title: '校园二手',
    subtitle: '校内好物，放心流转',
    eyebrow: '校内流转',
    searchHint: '搜索商品、教材或品牌',
    publishLabel: '卖闲置',
  },
  carpool: {
    key: 'carpool',
    label: '拼车',
    title: '同路拼车',
    subtitle: '先看时间路线，再决定同行',
    eyebrow: '同路同行',
    searchHint: '搜索起点、终点或行程',
    publishLabel: '发拼车',
  },
}

export const lifeBusinessThemeList = (
  Object.keys(lifeBusinessThemes) as LifeHubSection[]
).map((key) => lifeBusinessThemes[key])

export const isLifeHubSection = (value: string): value is LifeHubSection => (
  Object.prototype.hasOwnProperty.call(lifeBusinessThemes, value)
)
