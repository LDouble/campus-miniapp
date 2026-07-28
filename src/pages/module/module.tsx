import { useMemo, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import './module.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  academic: require('../../assets/icons/academic.svg'),
  community: require('../../assets/icons/community.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
  lost: require('../../assets/icons/lost.svg'),
  calendar: require('../../assets/icons/calendar.svg'),
  location: require('../../assets/icons/location.svg'),
  arrow: require('../../assets/icons/arrow.svg'),
  plus: require('../../assets/icons/plus.svg'),
}

type ModuleType = 'academic' | 'community' | 'market' | 'errands' | 'lost'

const moduleData = {
  academic: {
    name: '教务服务',
    slogan: '把学习安排得明明白白',
    icon: icons.academic,
    tone: 'mint',
    stats: [['本周课程', '18 节'], ['待办事项', '3 项'], ['平均绩点', '3.76']],
    filters: ['今日课表', '考试安排', '成绩查询'],
    items: [
      { title: '用户体验设计基础', tag: '进行中', detail: '14:00 - 15:35 · 行远楼 A305', meta: '王老师 · 第 3-16 周' },
      { title: '交互原型与实践', tag: '明天', detail: '09:50 - 11:25 · 教学楼 B201', meta: '刘老师 · 第 2-15 周' },
      { title: '大学英语（四）', tag: '周五', detail: '10:00 - 11:35 · 行知楼 412', meta: '陈老师 · 第 1-16 周' },
    ],
    button: '添加课程提醒',
  },
  community: {
    name: '校园社区',
    slogan: '分享此刻，遇见同频的朋友',
    icon: icons.community,
    tone: 'purple',
    stats: [['今日动态', '268'], ['热门话题', '12'], ['同校在线', '1.8k']],
    filters: ['推荐', '关注', '校园热榜'],
    items: [
      { title: '春天的海大图书馆真的太适合学习了', tag: '校园随拍', detail: '一杯咖啡、一整面的阳光，期中周也没那么难熬。', meta: '小海同学 · 12分钟前 · 26赞' },
      { title: '有没有人一起参加校园夜跑？', tag: '找搭子', detail: '今晚 8 点东操场，配速 6 分左右，新手友好。', meta: '北辰 · 35分钟前 · 18评论' },
      { title: '崂山校区食堂隐藏菜单测评', tag: '校园美食', detail: '二楼窗口的番茄牛腩面值得冲，记得加溏心蛋。', meta: '吃遍海大 · 1小时前 · 42赞' },
    ],
    button: '发布新动态',
  },
  market: {
    name: '校园二手',
    slogan: '让闲置流转，让好物继续发光',
    icon: icons.market,
    tone: 'orange',
    stats: [['今日上新', '86'], ['校内卖家', '2.3k'], ['完成交易', '5.8k']],
    filters: ['最新上架', '数码', '书籍资料'],
    items: [
      { title: '九成新拍立得 mini 11', tag: '¥ 328', detail: '奶白色，配件齐全，可崂山校区当面验货。', meta: '崂山校区 · 2小时前 · 8人想要' },
      { title: '高等数学同济第七版', tag: '¥ 18', detail: '少量笔记，整体很新，送配套习题答案。', meta: '北海苑 · 5小时前 · 3人想要' },
      { title: '宿舍小型投影仪', tag: '¥ 260', detail: '支持 1080P，毕业清闲置，功能完好。', meta: '研究生公寓 · 昨天 · 12人想要' },
    ],
    button: '发布闲置',
  },
  errands: {
    name: '校园跑腿',
    slogan: '有事搭把手，校园生活更轻松',
    icon: icons.errands,
    tone: 'blue',
    stats: [['附近订单', '23'], ['平均响应', '2分钟'], ['准时送达', '98%']],
    filters: ['帮我送', '帮我取', '帮我买'],
    items: [
      { title: '北海苑驿站取快递到南海苑', tag: '¥ 6', detail: '中通小件，18:00 前送到即可。', meta: '1.2km · 约 18 分钟 · 信用极好' },
      { title: '崂山校区食堂带一份鸡腿饭', tag: '¥ 5', detail: '不要辣，多加一份青菜，饭钱另付。', meta: '650m · 约 12 分钟 · 立即取单' },
      { title: '帮送文件到行政楼 302', tag: '¥ 8', detail: '文件已打包，需要在 16:30 前送达。', meta: '900m · 约 15 分钟 · 加急单' },
    ],
    button: '发布跑腿需求',
  },
  lost: {
    name: '失物招领',
    slogan: '每一件失物，都值得被送回身边',
    icon: icons.lost,
    tone: 'pink',
    stats: [['今日发布', '16'], ['成功找回', '326'], ['热心同学', '1.2k']],
    filters: ['全部', '我丢失的', '我捡到的'],
    items: [
      { title: '在博雅楼捡到蓝色校园卡', tag: '已拾取', detail: '卡面姓名为“周＊宇”，已交一楼值班室。', meta: '博雅楼 · 30分钟前 · 卡证' },
      { title: '寻找黑色索尼无线耳机', tag: '寻找中', detail: '可能遗落在图书馆三楼西侧，十分感谢。', meta: '图书馆 · 2小时前 · 数码' },
      { title: '东操场看台发现一串钥匙', tag: '已拾取', detail: '三个钥匙和一个小熊挂件，请描述细节认领。', meta: '东操场 · 昨天 · 日用品' },
    ],
    button: '发布失物信息',
  },
} as const

function ModulePage() {
  const [type, setType] = useState<ModuleType>('academic')
  const [activeFilter, setActiveFilter] = useState(0)
  const [keyword, setKeyword] = useState('')
  const headerCollapsed = useCollapsingHeader()
  const data = useMemo(() => moduleData[type], [type])

  useLoad((options) => {
    const nextType = options.type as ModuleType
    if (nextType && moduleData[nextType]) {
      setType(nextType)
      Taro.setNavigationBarTitle({ title: moduleData[nextType].name })
    }
  })

  const showTip = (title: string) => Taro.showToast({ title, icon: 'none' })

  return (
    <View className={`module module--${data.tone}`}>
      <View className='module__orb' />
      <CustomNavbar
        title={data.name}
        showBack
        immersive
        collapsed={headerCollapsed}
      />
      <View className='module-hero'>
        <View className='module-hero__icon'>
          <Image src={data.icon} mode='aspectFit' />
        </View>
        <View className='module-hero__copy'>
          <Text className='module-hero__title'>{data.slogan}</Text>
          <Text className='module-hero__slogan'>海大校园服务</Text>
        </View>
        <View className='module-hero__deco'>
          <View /><View /><View />
        </View>
      </View>

      <View className='module-stats'>
        {data.stats.map((stat, index) => (
          <View key={stat[0]} className='module-stats__item'>
            <Text className='module-stats__value'>{stat[1]}</Text>
            <Text className='module-stats__label'>{stat[0]}</Text>
            {index < data.stats.length - 1 && <View className='module-stats__divider' />}
          </View>
        ))}
      </View>

      <View className='module-search'>
        <Image src={icons.search} mode='aspectFit' />
        <Input
          value={keyword}
          onInput={(event) => setKeyword(event.detail.value)}
          onConfirm={() => showTip(keyword.trim() ? `搜索“${keyword.trim()}”` : '请输入搜索内容')}
          confirmType='search'
          placeholder={`在${data.name}中搜索`}
          placeholderClass='module-search__placeholder'
        />
      </View>

      <ScrollView className='module-filter' scrollX showScrollbar={false}>
        <View className='module-filter__inner'>
          {data.filters.map((filter, index) => (
            <View
              key={filter}
              className={`module-filter__item ${activeFilter === index ? 'module-filter__item--active' : ''}`}
              onClick={() => setActiveFilter(index)}
            >
              {filter}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='module-heading'>
        <View>
          <Text className='module-heading__title'>{data.filters[activeFilter]}</Text>
          <Text className='module-heading__sub'>已为你智能整理校园信息</Text>
        </View>
        <Text className='module-heading__count'>{data.items.length} 条</Text>
      </View>

      <View className='module-list'>
        {data.items.map((item, index) => (
          <View key={item.title} className='module-card' onClick={() => showTip(item.title)}>
            <View className='module-card__top'>
              <View className='module-card__number'>{String(index + 1).padStart(2, '0')}</View>
              <View className='module-card__main'>
                <Text className='module-card__title'>{item.title}</Text>
                <Text className='module-card__detail'>{item.detail}</Text>
              </View>
              <View className='module-card__tag'>{item.tag}</View>
            </View>
            <View className='module-card__bottom'>
              <View className='module-card__meta'>
                <Image src={type === 'academic' ? icons.calendar : icons.location} mode='aspectFit' />
                <Text>{item.meta}</Text>
              </View>
              <Image className='module-card__arrow' src={icons.arrow} mode='aspectFit' />
            </View>
          </View>
        ))}
      </View>

      <View className='module-action' onClick={() => showTip(`${data.button}功能已就绪`)}>
        <Image src={icons.plus} mode='aspectFit' />
        <Text>{data.button}</Text>
      </View>
    </View>
  )
}

export default ModulePage
