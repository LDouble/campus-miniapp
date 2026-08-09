import { useState } from 'react'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { parseOfficialNoticeMarkdown } from '../../features/official-notices/markdown'
import { officialNoticesRepository } from '../../features/official-notices/repository'
import {
  formatOfficialNoticeDate,
  officialNoticeCategoryLabels,
  officialNoticeSourceLabels,
} from '../../features/official-notices/types'
import type { OfficialNotice } from '../../features/official-notices/types'
import { normalizeWebViewUrl } from '../../features/webview/url'
import './detail.scss'

const validNoticeId = (value?: string) => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

export default function OfficialNoticeDetailPage() {
  const [noticeId, setNoticeId] = useState(0)
  const [notice, setNotice] = useState<OfficialNotice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (id: number) => {
    setLoading(true)
    setError('')
    try {
      setNotice(await officialNoticesRepository.get(id))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '通知加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = validNoticeId(options.id)
    setNoticeId(id)
    if (!id) {
      setLoading(false)
      setError('通知参数无效')
      return
    }
    void load(id)
  })

  useShareAppMessage(() => ({
    title: notice?.title || '全校通知',
    path: notice ? `/pages/official-notices/detail?id=${notice.id}` : '/pages/official-notices/index',
  }))

  const openExternal = async (url: string) => {
    const target = normalizeWebViewUrl(url)
    if (!target) {
      await Taro.showToast({ title: '链接地址无效', icon: 'none' })
      return
    }
    try {
      await Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(target)}` })
    } catch {
      await Taro.setClipboardData({ data: target })
      await Taro.showToast({ title: '链接已复制，请在校园网环境打开', icon: 'none' })
    }
  }

  const blocks = notice ? parseOfficialNoticeMarkdown(notice.body) : []

  return (
    <View className='official-notice-detail-page'>
      <CustomNavbar title='通知详情' showBack />
      {loading && <View className='official-notice-detail-state'>正在加载通知…</View>}
      {!loading && error && (
        <View className='official-notice-detail-state'>
          <Text>{error}</Text>
          {!!noticeId && <View onClick={() => void load(noticeId)}>重新加载</View>}
        </View>
      )}
      {!loading && notice && (
        <View className='official-notice-detail'>
          <View className='official-notice-detail__eyebrow'>
            <Text>{officialNoticeSourceLabels[notice.source]}</Text>
            <Text>{officialNoticeCategoryLabels[notice.category]}</Text>
            {notice.priority === 'important' && <Text className='is-important'>重要</Text>}
          </View>
          <Text className='official-notice-detail__title'>{notice.title}</Text>
          <View className='official-notice-detail__meta'>
            <Text>{notice.publisher}</Text>
            <Text>{formatOfficialNoticeDate(notice.source_published_at)}</Text>
          </View>
          <View className='official-notice-detail__summary'>{notice.summary}</View>
          <View className='official-notice-markdown'>
            {blocks.map((block) => block.kind === 'separator'
              ? <View key={block.id} className='official-notice-markdown__separator' />
              : (
                <Text
                  key={block.id}
                  className={`official-notice-markdown__${block.kind} ${block.level ? `is-level-${block.level}` : ''}`}
                >
                  {block.kind === 'list' ? '• ' : block.kind === 'ordered-list' ? '◦ ' : ''}{block.text}
                </Text>
              ))}
          </View>

          {notice.attachments.length > 0 && (
            <View className='official-notice-attachments'>
              <Text className='official-notice-attachments__title'>附件下载</Text>
              {notice.attachments.map((attachment, index) => (
                <View key={`${attachment.url}-${index}`} onClick={() => void openExternal(attachment.url)}>
                  <View>附</View>
                  <Text>{attachment.name}</Text>
                  <Text>打开 ›</Text>
                </View>
              ))}
              <Text className='official-notice-attachments__hint'>部分文件可能需要连接校园网或 VPN 后打开</Text>
            </View>
          )}

          <View className='official-notice-detail__actions'>
            {!!notice.original_url && (
              <View onClick={() => void openExternal(notice.original_url || '')}>查看学校原文</View>
            )}
            <Button openType='share'>分享给同学</Button>
          </View>
          <Text className='official-notice-detail__disclaimer'>内容由管理端人工整理，具体安排以学校原文为准</Text>
        </View>
      )}
    </View>
  )
}
