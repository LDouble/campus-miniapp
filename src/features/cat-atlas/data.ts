export type CatProfile = {
  id: string
  name: string
  alias: string
  gender: string
  coat: string
  traits: string[]
  area: string
  firstSeen: string
  seenCount: number
  lastSeen: string
  color: string
}

export type Sighting = {
  id: string
  catId: string
  user: string
  area: string
  time: string
  note: string
  activity: string
}

export const cats: CatProfile[] = [
  { id: 'ju-zuo', name: '橘座', alias: '大橘 / 橘老板', gender: '公（推测）', coat: '橘猫', traits: ['亲人', '贪吃', '爱睡觉'], area: '南区宿舍附近', firstSeen: '2025.09', seenCount: 328, lastSeen: '今天 17:32', color: '#EFA95C' },
  { id: 'mei-qiu', name: '煤球', alias: '小黑', gender: '未知', coat: '黑猫', traits: ['高冷', '夜猫子'], area: '图书馆附近', firstSeen: '2025.10', seenCount: 216, lastSeen: '昨天 21:16', color: '#46505D' },
  { id: 'nai-niu', name: '奶牛', alias: '花脸', gender: '母', coat: '黑白猫', traits: ['温柔', '爱蹭人'], area: '南区宿舍', firstSeen: '2025.08', seenCount: 198, lastSeen: '今天 09:40', color: '#708090' },
  { id: 'hua-hua', name: '花花', alias: '小花', gender: '未知', coat: '狸花猫', traits: ['胆小', '可爱'], area: '小树林', firstSeen: '2025.11', seenCount: 163, lastSeen: '3 天前', color: '#A77B58' },
]

export const sightings: Sighting[] = [
  { id: 's1', catId: 'ju-zuo', user: '小陈', area: '一食堂', time: '今天 17:32', note: '睡得像个小皇帝一样～', activity: '睡觉' },
  { id: 's2', catId: 'ju-zuo', user: '海盐芝士', area: '一食堂', time: '今天 15:21', note: '又来蹭饭了，太可爱了！', activity: '营业中' },
  { id: 's3', catId: 'mei-qiu', user: '匿名同学', area: '图书馆侧门', time: '昨天 22:03', note: '今天不怕摸，有点惊喜。', activity: '发呆' },
]

export const getCat = (id?: string) => cats.find((cat) => cat.id === id) || cats[0]
