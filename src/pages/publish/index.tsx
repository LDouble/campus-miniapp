import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { DesignIcon } from '../../components/DesignIcon'
import { useNavigationMetrics } from '../../hooks/useNavigationMetrics'
import './index.scss'

export default function Publish () {
  const [type, setType] = useState('动态'); const [title, setTitle] = useState(''); const [content, setContent] = useState('')
  const { topInset } = useNavigationMetrics()
  useLoad(params => { if (params.type) setType(params.type) })
  return <View className='publish-page'><View className='publish-header' style={{ paddingTop: `${topInset + 8}px` }}><Text onClick={() => Taro.navigateBack()}>取消</Text><Text className='publish-header-title'>发布{type}</Text><View /></View><View className='publish-body'><View className='publish-editor'><Input value={title} onInput={e => setTitle(e.detail.value)} placeholder={type === '动态' ? '分享你的校园新鲜事...' : `一句话概括${type}内容`} /><Textarea value={content} onInput={e => setContent(e.detail.value)} placeholder='详细描述一下吧，让同学更容易了解...' maxlength={1000} /></View><View className='publish-tip'><DesignIcon name='check' /><View><Text>发布后将进入审核</Text><Text>审核通过后所有同学可见</Text></View></View><Button type='primary' onClick={() => Taro.showToast({ title: '请先完成教务认证', icon: 'none' })}>提交审核</Button></View></View>
}
