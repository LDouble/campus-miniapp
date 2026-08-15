import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
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
import { useCampusShare } from '../../features/share'
import './detail.scss'

type DocumentFileType = 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'pdf'

const documentFileTypes: DocumentFileType[] = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf']

const getDocumentFileType = (name: string, url: string): DocumentFileType | undefined => {
  const extension = [name, url].map((value) => (
    value.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  )).find((candidate): candidate is DocumentFileType => (
    documentFileTypes.includes(candidate as DocumentFileType)
  ))
  return extension
}

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

  useCampusShare(() => ({
    title: notice?.title || '全校通知',
    path: notice ? '/pages/official-notices/detail' : '/pages/official-notices/index',
    query: notice ? { id: notice.id } : undefined,
  }))

  const copyAttachmentUrl = async (target: string, title: string) => {
    try {
      await Taro.setClipboardData({ data: target })
      await Taro.showToast({ title, icon: 'none' })
    } catch {
      await Taro.showToast({ title: '附件打开失败，请稍后重试', icon: 'none' })
    }
  }

  const openAttachment = async (attachment: OfficialNotice['attachments'][number]) => {
    const target = normalizeWebViewUrl(attachment.url)
    if (!target) {
      await Taro.showToast({ title: '附件地址无效', icon: 'none' })
      return
    }

    const fileType = getDocumentFileType(attachment.name, target)
    if (!fileType) {
      await copyAttachmentUrl(target, '暂不支持预览，附件地址已复制')
      return
    }

    await Taro.showLoading({ title: '正在下载附件', mask: true })
    try {
      const result = await Taro.downloadFile({ url: target })
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(`附件下载失败：HTTP ${result.statusCode}`)
      }
      await Taro.openDocument({
        filePath: result.tempFilePath,
        fileType,
        showMenu: true,
      })
    } catch {
      await copyAttachmentUrl(target, '打开失败，附件地址已复制')
    } finally {
      await Taro.hideLoading()
    }
  }

  const copyOriginalUrl = async (url: string) => {
    const target = normalizeWebViewUrl(url)
    if (!target) {
      await Taro.showToast({ title: '原文地址无效', icon: 'none' })
      return
    }
    try {
      await Taro.setClipboardData({ data: target })
    } catch {
      await Taro.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
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
          {!!noticeId && <View className='official-notice-detail-state__retry' hoverClass='official-notice-detail-state__retry--pressed' ariaRole='button' ariaLabel='重新加载通知' onClick={() => void load(noticeId)}>重新加载</View>}
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
                <View
                  key={`${attachment.url}-${index}`}
                  hoverClass='official-notice-attachments__item--pressed'
                  ariaRole='button'
                  ariaLabel={`预览附件：${attachment.name}`}
                  onClick={() => void openAttachment(attachment)}
                >
                  <View>附</View>
                  <Text>{attachment.name}</Text>
                  <Text>预览 ›</Text>
                </View>
              ))}
              <Text className='official-notice-attachments__hint'>附件将下载后使用微信原生文档预览打开</Text>
            </View>
          )}

          <View className='official-notice-detail__actions'>
            {!!notice.original_url && (
              <View
                hoverClass='official-notice-detail__action--pressed'
                ariaRole='button'
                ariaLabel='复制原文地址'
                onClick={() => void copyOriginalUrl(notice.original_url || '')}
              >复制原文地址</View>
            )}
            <Button openType='share'>分享给同学</Button>
          </View>
          <Text className='official-notice-detail__disclaimer'>内容由管理端人工整理，具体安排以学校原文为准</Text>
        </View>
      )}
    </View>
  )
}
