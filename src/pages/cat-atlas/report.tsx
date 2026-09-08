import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { getCat } from '../../features/cat-atlas/data'
import './shared.scss'

const areas = ['一食堂', '图书馆', '宿舍区', '小树林', '教学楼', '其他']
const actions = ['睡觉', '干饭', '散步', '发呆', '营业中']

export default function CatReportPage() {
  const { params } = useRouter()
  const isNew = params.mode === 'new'
  const cat = getCat(params.id)
  const [area, setArea] = useState(areas[0])
  const [action, setAction] = useState(actions[0])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (isNew && !name.trim()) {
      await Taro.showToast({ title: '请给它起个暂定名字', icon: 'none' })
      return
    }
    setSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 350))
    setSubmitting(false)
    await Taro.showToast({ title: isNew ? '已提交审核' : '打卡成功', icon: 'success' })
    Taro.navigateBack()
  }
  return <View className='cat-page'><CustomNavbar title={isNew ? '发现了一只新猫？' : `我遇到${cat.name}了`} showBack /><View className='cat-page__content'>
    <View className='cat-hero'><Text className='cat-hero__eyebrow'>{isNew ? '让更多同学认识它' : '留下这次温柔的相遇'}</Text><Text className='cat-hero__copy'>{isNew ? '投稿审核通过后，猫咪才会出现在公开图鉴。' : '公开展示只会使用区域级位置，不会暴露精确坐标。'}</Text></View>
    {isNew && <><Text className='cat-form-label'>大家怎么叫它？</Text><KeyboardSafeInput className='cat-input' value={name} maxlength={32} placeholder='可填写暂定名字' onInput={(event) => setName(event.detail.value)} /></>}
    <Text className='cat-form-label'>在哪里遇到？</Text><View className='cat-options'>{areas.map((item) => <Text key={item} className={`cat-option ${area === item ? 'cat-option--active' : ''}`} onClick={() => setArea(item)}>{item}</Text>)}</View>
    {!isNew && <><Text className='cat-form-label'>它在做什么？</Text><View className='cat-options'>{actions.map((item) => <Text key={item} className={`cat-option ${action === item ? 'cat-option--active' : ''}`} onClick={() => setAction(item)}>{item}</Text>)}</View></>}
    <Text className='cat-form-label'>{isNew ? '它有什么特点？' : '想说点什么？'} <Text className='cat-muted'>（可选）</Text></Text><KeyboardSafeTextarea className='cat-input' value={note} maxlength={200} placeholder={isNew ? '比如毛色、性格、常出没的地方…' : '分享一下你看到它吧～'} onInput={(event) => setNote(event.detail.value)} />
    <Button className='cat-primary-button' loading={submitting} onClick={() => void submit()}>{isNew ? '提交申请' : '发布目击记录'}</Button>
  </View></View>
}
