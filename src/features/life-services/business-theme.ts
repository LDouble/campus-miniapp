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
    label: '全部',
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
    label: '闲置',
    title: '校园二手',
    subtitle: '校内好物，放心流转',
    eyebrow: '校内流转',
    searchHint: '搜索商品、教材或品牌',
    publishLabel: '卖闲置',
  },
  carpool: {
    key: 'carpool',
    label: '找同行',
    title: '校园找同行',
    subtitle: '找同时间、同方向的同学一起出发',
    eyebrow: '同路同行',
    searchHint: '搜索出发地、目的地或同行计划',
    publishLabel: '发布计划',
  },
}

export const lifeBusinessThemeList = (
  ['community', 'market', 'errands', 'carpool'] as LifeHubSection[]
).map((key) => lifeBusinessThemes[key])

export const isLifeHubSection = (value: string): value is LifeHubSection => (
  Object.prototype.hasOwnProperty.call(lifeBusinessThemes, value)
)
