import { useCallback, useEffect, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Input, Map, Text, Textarea, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import {
  campusCrowdRepository,
  type BlueBikeFault,
  type BlueBikeFaultType,
} from '../../features/campus-crowd/repository'
import './index.scss'

const faultOptions: Array<[BlueBikeFaultType, string]> = [
  ['brake', '刹车'],
  ['throttle', '油门'],
  ['steering', '转向'],
  ['light', '灯'],
  ['other', '其他'],
]

const faultLabel = (type: BlueBikeFaultType) => faultOptions.find(([value]) => value === type)?.[1] || type

export default function BlueBikeFaultsPage() {
  const [items, setItems] = useState<BlueBikeFault[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [bikeNumber, setBikeNumber] = useState('')
  const [faultTypes, setFaultTypes] = useState<BlueBikeFaultType[]>([])
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await campusCrowdRepository.listBikeFaults()
      setItems(Array.isArray(result.items) ? result.items : [])
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  usePullDownRefresh(async () => {
    try { await refresh() } finally { Taro.stopPullDownRefresh() }
  })

  const locate = async () => {
    if (locating) return
    setLocating(true)
    try {
      const result = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true })
      setLocation({ latitude: result.latitude, longitude: result.longitude })
      Taro.showToast({ title: '定位成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '无法获取定位，请检查微信定位权限', icon: 'none' })
    } finally {
      setLocating(false)
    }
  }

  const toggleFault = (type: BlueBikeFaultType) => {
    setFaultTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type])
  }

  const submit = async () => {
    if (submitting) return
    if (!bikeNumber.trim() || faultTypes.length === 0 || !location) {
      Taro.showToast({ title: '请填写编号、选择故障并获取定位', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const created = await campusCrowdRepository.createBikeFault({
        bikeNumber: bikeNumber.trim(),
        faultTypes,
        description: description.trim() || undefined,
        ...location,
      })
      setItems((current) => [created, ...current.filter((item) => item.bike_number !== created.bike_number)])
      setBikeNumber('')
      setFaultTypes([])
      setDescription('')
      setLocation(null)
      setFormOpen(false)
      Taro.showToast({ title: '已共享故障', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '提交失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const resolve = async (item: BlueBikeFault) => {
    if (resolvingId !== null) return
    const result = await Taro.showModal({ title: `小蓝 ${item.bike_number}`, content: '确认这辆车已经可以正常使用？', confirmText: '确认恢复' })
    if (!result.confirm) return
    setResolvingId(item.id)
    try {
      await campusCrowdRepository.resolveBikeFault(item.id)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      Taro.showToast({ title: '已取消故障', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '操作失败，请稍后重试', icon: 'none' })
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <View className='bike-faults'>
      <CustomNavbar title='小蓝故障共享' subtitle='实时上报 · 共同维护' showBack />
      <View className='bike-faults__content'>
        {loading && <View className='bike-state'>加载中</View>}
        {!loading && items.length === 0 && <View className='bike-state'>暂无故障车辆</View>}
        {items.map((item) => (
          <View key={item.id} className='bike-card'>
            <View className='bike-card__head'>
              <View><Text>小蓝</Text><Text>{item.bike_number}</Text></View>
              <Text className='bike-card__status'>故障中</Text>
            </View>
            <View className='bike-card__tags'>
              {item.fault_types.map((type) => <Text key={type}>{faultLabel(type)}</Text>)}
            </View>
            {item.description && <Text className='bike-card__description'>{item.description}</Text>}
            <View className='bike-card__location'>
              <Text>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
              <View
                role='button'
                ariaLabel={`查看小蓝${item.bike_number}的位置`}
                onClick={() => Taro.openLocation({ latitude: item.latitude, longitude: item.longitude, scale: 18 })}
              >查看位置</View>
            </View>
            <View
              className={`bike-card__resolve ${resolvingId === item.id ? 'bike-card__resolve--disabled' : ''}`}
              role='button'
              ariaLabel={`确认小蓝${item.bike_number}已恢复`}
              onClick={() => void resolve(item)}
            >{resolvingId === item.id ? '处理中' : '车辆已恢复'}</View>
          </View>
        ))}
      </View>

      <View className='bike-report' role='button' ariaLabel='上报小蓝故障' onClick={() => setFormOpen(true)}>上报故障</View>
      {formOpen && (
        <View className='bike-sheet' onClick={() => !submitting && setFormOpen(false)}>
          <View className='bike-sheet__panel' onClick={(event) => event.stopPropagation()}>
            <Text className='bike-sheet__title'>上报故障</Text>
            <Input
              className='bike-sheet__input'
              value={bikeNumber}
              maxlength={30}
              placeholder='小蓝编号'
              placeholderClass='bike-sheet__input-placeholder'
              onInput={(event) => setBikeNumber(event.detail.value)}
            />
            <View className='bike-sheet__types'>
              {faultOptions.map(([type, label]) => (
                <View
                  key={type}
                  className={faultTypes.includes(type) ? 'bike-sheet__type bike-sheet__type--active' : 'bike-sheet__type'}
                  role='button'
                  ariaLabel={`${faultTypes.includes(type) ? '取消' : '选择'}${label}故障`}
                  onClick={() => toggleFault(type)}
                >{label}</View>
              ))}
            </View>
            <Textarea value={description} maxlength={200} placeholder='补充描述（选填）' autoHeight onInput={(event) => setDescription(event.detail.value)} />
            <View className='bike-sheet__locate' role='button' ariaLabel='获取当前位置' onClick={() => void locate()}>
              {locating ? '定位中' : location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : '获取当前位置'}
            </View>
            {location && (
              <Map
                className='bike-sheet__map'
                latitude={location.latitude}
                longitude={location.longitude}
                scale={18}
                showLocation
                onError={() => Taro.showToast({ title: '地图加载失败', icon: 'none' })}
              />
            )}
            <View className={`bike-sheet__submit ${submitting ? 'bike-sheet__submit--disabled' : ''}`} onClick={() => void submit()}>
              {submitting ? '提交中' : '提交故障'}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
