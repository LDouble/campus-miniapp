import { useCallback, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, useUnload } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import {
  getCurrentAffiliateShortcut,
  isSafeAffiliateShortcutImage,
  type AffiliateShortcutItem,
} from '../../features/affiliate-shortcuts/config'
import {
  createAffiliateShortcutPageSession,
  runAffiliateShortcutCopy,
} from '../../features/affiliate-shortcuts/page-session'
import { acquireCustomTabBarHidden } from '../../utils/tabbar'
import './shortcut-copy.scss'

export default function AffiliateShortcutCopyPage() {
  const [item, setItem] = useState<AffiliateShortcutItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [heroImageFailed, setHeroImageFailed] = useState(false)
  const shortcutIdRef = useRef('')
  const loadingRef = useRef(false)
  const sessionRef = useRef(createAffiliateShortcutPageSession())
  const releaseTabBarRef = useRef<(() => void) | null>(null)

  const loadShortcut = useCallback(async (id: string) => {
    const revision = sessionRef.current.beginLoad()
    if (revision === null) return
    loadingRef.current = true
    setLoading(true)
    setError('')
    setUnavailable(false)
    setItem(null)
    setCopying(false)
    setCopyError('')
    setHeroImageFailed(false)
    try {
      // 深链直接向服务端重读配置，避免使用首页短期快照执行已经停用的入口。
      const current = await getCurrentAffiliateShortcut(id)
      if (!sessionRef.current.isLoadCurrent(revision)) return
      if (!current || current.action.type !== 'copy_token') {
        setUnavailable(true)
        return
      }
      setItem(current)
    } catch (loadError) {
      if (!sessionRef.current.isLoadCurrent(revision)) return
      if (isApiError(loadError) && loadError.statusCode === 404) {
        setUnavailable(true)
      } else {
        setError('入口配置暂时无法读取，请检查网络后重试。')
      }
    } finally {
      if (sessionRef.current.isLoadCurrent(revision)) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [])

  useLoad((options) => {
    const id = typeof options.id === 'string' ? options.id : ''
    shortcutIdRef.current = id
    if (!id) {
      setLoading(false)
      setUnavailable(true)
    }
  })

  useDidShow(() => {
    sessionRef.current.activate()
    if (!releaseTabBarRef.current) {
      releaseTabBarRef.current = acquireCustomTabBarHidden()
    }
    if (!shortcutIdRef.current) {
      setLoading(false)
      setUnavailable(true)
      return
    }
    void loadShortcut(shortcutIdRef.current)
  })

  const releaseTabBar = () => {
    releaseTabBarRef.current?.()
    releaseTabBarRef.current = null
  }

  useDidHide(() => {
    sessionRef.current.deactivate()
    loadingRef.current = false
    setCopying(false)
    releaseTabBar()
  })

  useUnload(() => {
    sessionRef.current.deactivate()
    loadingRef.current = false
    releaseTabBar()
  })

  const copyToken = async () => {
    if (loadingRef.current || !shortcutIdRef.current) return
    const revision = sessionRef.current.beginCopy()
    if (revision === null) return
    const id = shortcutIdRef.current
    setCopying(true)
    setCopyError('')
    // 复制前再次检查服务端状态，并使用最新口令，停用或改型后不沿用旧内容。
    await runAffiliateShortcutCopy({
      session: sessionRef.current,
      revision,
      loadCurrent: () => getCurrentAffiliateShortcut(id),
      writeClipboard: (content) => Taro.setClipboardData({ data: content }),
      onUnavailable: () => {
        setItem(null)
        setUnavailable(true)
      },
      onValidated: (current) => {
        setItem(current)
        setUnavailable(false)
      },
      onCopied: (successText) => Taro.showToast({ title: successText, icon: 'none', duration: 2000 }),
      onError: () => setCopyError('暂时无法核验或复制，请检查网络后重试。'),
      onFinish: () => {
        loadingRef.current = false
        setCopying(false)
      },
    })
  }

  const returnToGoods = async () => {
    const pages = Taro.getCurrentPages()
    if (pages.length <= 1) {
      await Taro.switchTab({ url: '/pages/goods/index' })
      return
    }
    try {
      await Taro.navigateBack()
    } catch {
      await Taro.switchTab({ url: '/pages/goods/index' })
    }
  }

  const retry = () => {
    if (shortcutIdRef.current) void loadShortcut(shortcutIdRef.current)
  }

  const copy = item?.action.type === 'copy_token' ? item.action.copy : null
  const safeHeroUrl = isSafeAffiliateShortcutImage(copy?.hero_image_url) && !heroImageFailed
    ? copy?.hero_image_url || ''
    : ''

  return (
    <View className='affiliate-shortcut-copy'>
      <CustomNavbar title={copy?.page_title || '快捷入口'} showBack />

      {loading && (
        <View className='affiliate-shortcut-copy__state' ariaRole='status'>正在加载入口内容…</View>
      )}

      {!loading && error && (
        <View className='affiliate-shortcut-copy__state affiliate-shortcut-copy__state--error' ariaRole='alert'>
          <Text>{error}</Text>
          <View className='affiliate-shortcut-copy__retry' ariaRole='button' onClick={retry}>重新加载</View>
        </View>
      )}

      {!loading && unavailable && (
        <View className='affiliate-shortcut-copy__state'>
          <Text>这个快捷入口已失效或暂不可用。</Text>
          <View className='affiliate-shortcut-copy__retry' ariaRole='button' onClick={() => void returnToGoods()}>
            返回好物
          </View>
        </View>
      )}

      {!loading && !error && copy && (
        <View className='affiliate-shortcut-copy__content'>
          <View className='affiliate-shortcut-copy__hero'>
            {safeHeroUrl ? (
              <Image
                className='affiliate-shortcut-copy__hero-image'
                src={safeHeroUrl}
                mode='aspectFill'
                onError={() => setHeroImageFailed(true)}
              />
            ) : (
              <View className='affiliate-shortcut-copy__hero-fallback'>
                <View className='affiliate-shortcut-copy__hero-symbol' />
              </View>
            )}
          </View>

          <View className='affiliate-shortcut-copy__card'>
            <Text className='affiliate-shortcut-copy__title'>{copy.title}</Text>
            {copy.description && <Text className='affiliate-shortcut-copy__description'>{copy.description}</Text>}

            <View className='affiliate-shortcut-copy__steps'>
              {copy.steps.map((step, index) => (
                <View key={`${index}-${step}`} className='affiliate-shortcut-copy__step'>
                  <Text className='affiliate-shortcut-copy__step-number'>{index + 1}</Text>
                  <Text className='affiliate-shortcut-copy__step-text'>{step}</Text>
                </View>
              ))}
            </View>

            <View className='affiliate-shortcut-copy__token-box'>
              <Text className='affiliate-shortcut-copy__token-caption'>复制文案 · 打开{copy.target_app}</Text>
              <Text className='affiliate-shortcut-copy__token'>{copy.content}</Text>
            </View>

            {copyError && (
              <View className='affiliate-shortcut-copy__copy-error' ariaRole='alert'>
                <Text>{copyError}</Text>
              </View>
            )}
            <View
              className={`affiliate-shortcut-copy__button ${copying ? 'affiliate-shortcut-copy__button--busy' : ''}`}
              ariaRole='button'
              ariaLabel={copying ? '正在复制口令' : copy.button_text}
              onClick={() => void copyToken()}
            >
              {copying ? '正在复制…' : copy.button_text}
            </View>
          </View>

          <Text className='affiliate-shortcut-copy__footnote'>请在{copy.target_app}中打开并使用此口令</Text>
        </View>
      )}
    </View>
  )
}
