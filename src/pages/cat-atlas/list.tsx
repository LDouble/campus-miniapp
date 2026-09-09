import { Image, Text, View } from '@tarojs/components'
import { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { listCats, type CatView } from '../../api/cat-atlas'
import { CatCover, RequestState } from '../../features/cat-atlas/ui'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { navigateToWithGuard } from '../../utils/navigation'
import './home-list.scss'

const searchIcon = require('../../assets/icons/search.svg')
const locationIcon = require('../../assets/icons/location.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const heartIcon = require('../../assets/community/heart.svg')
const heroImage = require('../../assets/cat-atlas/stitch/list-1.jpg')

const areas = ['全部', '崂山校区', '鱼山校区', '西海岸校区']
const sortOptions = ['按热度排序', '最新遇见', '遇见人数最多']
const tagClass = (index: number) => ['cat-list-v2__tag--blue', 'cat-list-v2__tag--mint', 'cat-list-v2__tag--orange'][index % 3]

export default function CatAtlasListPage() {
  const [items, setItems] = useState<CatView[]>([])
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [area, setArea] = useState('全部')
  const [sort, setSort] = useState(sortOptions[0])
  const [sortOpen, setSortOpen] = useState(false)
  const [liked, setLiked] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await listCats({ keyword: keyword.trim(), area: area === '全部' ? undefined : area, pageSize: 50 })
      const sorted = [...page.items].sort((left, right) => sort === '最新遇见' ? String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || '')) : right.sighting_count - left.sighting_count)
      setItems(sorted)
      setTotal(page.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '网络连接不稳定，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [area, keyword, sort])
  useDidShow(() => { void load() })
  usePullDownRefresh(() => load())
  const areaCounts = useMemo(() => areas.map((item) => item === '全部' ? total : items.filter((cat) => cat.resident_area.includes(item)).length), [items, total])
  const changeSort = (value: string) => { setSort(value); setSortOpen(false) }

  return <View className='cat-list-page'>
    <CustomNavbar title='全部图鉴' showBack />
    <View className='cat-list-page__scroll'>
      <View className='cat-list-v2__hero'><Image src={heroImage} className='cat-list-v2__hero-image' mode='aspectFill' /><View className='cat-list-v2__hero-veil' /><View className='cat-list-v2__hero-badge'><Text>OUC 海大萌宠档案库</Text><View /><Text>共 3 个校区</Text></View><View className='cat-list-v2__hero-copy'><Text>记录海大的每一次偶遇</Text><Text>遇见身边毛绒绒的温暖与心动</Text></View></View>
      <View className='cat-list-v2__search'><Image src={searchIcon} mode='aspectFit' /><KeyboardSafeInput value={keyword} placeholder='搜索猫咪名字 / 地点 / 毛色特征…' confirmType='search' onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load()} /><Text onClick={() => void load()}>搜索</Text></View>
      <View className='cat-list-v2__filters'>{areas.map((item, index) => <Text key={item} className={area === item ? 'is-active' : ''} onClick={() => setArea(item)}>{item}<Text>{areaCounts[index]}</Text></Text>)}</View>
      <View className='cat-list-v2__toolbar'><Text>已收录 {total} 只猫猫</Text><View className='cat-list-v2__toolbar-actions'><View className='cat-list-v2__sort'><Text onClick={() => setSortOpen((value) => !value)}>{sort}</Text>{sortOpen && <View className='cat-list-v2__sort-menu'>{sortOptions.map((item) => <Text key={item} className={sort === item ? 'is-current' : ''} onClick={() => changeSort(item)}>{item}</Text>)}</View>}</View><Text className='cat-list-v2__submit' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}>投稿新猫</Text></View></View>
      <RequestState loading={loading} error={error} onRetry={() => void load()} />
      {!loading && !error && <RequestState empty={!items.length ? '还没有符合条件的猫咪' : undefined} />}
      {!loading && !error && <View className='cat-list-v2__items'>{items.map((cat, index) => {
        const isLiked = liked.includes(cat.id)
        return <View className='cat-list-v2__card' style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }} key={cat.id} onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><View className='cat-list-v2__cover'><CatCover cat={cat} />{index === 0 && <Text className='cat-list-v2__rank'>TOP 1</Text>}</View><View className='cat-list-v2__body'><View className='cat-list-v2__title'><Text>{cat.name}</Text>{index === 0 && <Text>✦</Text>}</View><View className='cat-list-v2__tags'>{cat.traits.slice(0, 3).map((trait, traitIndex) => <Text className={tagClass(traitIndex)} key={trait}>{trait}</Text>)}</View><View className='cat-list-v2__meta'><View><Image src={locationIcon} mode='aspectFit' /><Text>{cat.resident_area}</Text></View><Text>{cat.sighting_count} 人遇见</Text></View></View><View className={`cat-list-v2__heart ${isLiked ? 'is-liked' : ''}`} ariaRole='button' ariaLabel={isLiked ? '取消收藏猫咪' : '收藏猫咪'} onClick={(event) => { event.stopPropagation(); setLiked((current) => isLiked ? current.filter((id) => id !== cat.id) : [...current, cat.id]) }}><Image src={heartIcon} mode='aspectFit' /></View></View>
      })}</View>}
      {!loading && !error && items.length > 0 && <Text className='cat-list-v2__end'>已加载全部 {total} 只在录猫咪 · 持续补充中</Text>}
    </View>
    <View className='cat-list-v2__fab' ariaRole='button' ariaLabel='投稿新猫' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}><Image src={plusIcon} mode='aspectFit' /><Text>投稿猫咪</Text></View>
  </View>
}
