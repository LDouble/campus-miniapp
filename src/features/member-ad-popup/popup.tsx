import { useCallback, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { AdCustom, Image, Text, View } from '@tarojs/components'
import mascot from './mascot-v2.png'
import guideArrow from './guide-arrow.svg'
import accentMark from './accent.svg'
import dashMark from './dash.svg'
import { MEMBER_AD_UNIT_ID } from './preload'
import './popup.scss'

type Props = { visible: boolean; onReady: () => void; onPresented: () => void; onClose: () => void }

const MemberAdPopup = ({ visible, onReady, onPresented, onClose }: Props) => {
  const loaded = useRef(false)
  const active = useRef(true)
  const presented = useRef(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const close = useCallback(() => {
    if (!active.current) return
    active.current = false
    onClose()
  }, [onClose])
  useEffect(() => {
    active.current = true
    // 准备阶段不阻断首页；超时或离页后不允许迟到事件重新弹出。
    const timer = setTimeout(() => { if (!loaded.current) close() }, 8000)
    return () => { active.current = false; clearTimeout(timer) }
  }, [close])

  useEffect(() => {
    if (!visible || presented.current) return
    // 等待可见状态提交到原生视图；准备、阻挡和离页都不计入展示。
    Taro.nextTick(() => {
      if (!active.current || !visibleRef.current || !loaded.current || presented.current) return
      presented.current = true
      onPresented()
    })
  }, [visible, onPresented])

  return (
    <View
      className={`member-ad-popup${visible ? '' : ' member-ad-popup--preparing'}`}
      onClick={visible ? close : undefined}
      catchMove={visible}
    >
      <View className='member-ad-popup__body' onClick={(event) => event.stopPropagation()}>
        <View className='member-ad-popup__mascot-wrap'>
          <Image className='member-ad-popup__mascot' src={mascot} mode='widthFix' />
        </View>
        <View className='member-ad-popup__card' ariaRole='dialog' ariaLabel='广告推荐'>
          <View className='member-ad-popup__burst member-ad-popup__burst--left'><Image src={accentMark} /><Image src={accentMark} /></View>
          <View className='member-ad-popup__burst member-ad-popup__burst--right'><Image src={accentMark} /></View>
          <View className='member-ad-popup__title'>
            <View>能帮学长点一下</View>
            <View>这个<Text className='member-ad-popup__highlight'>广告</Text>吗？<Text className='member-ad-popup__smile'>😊</Text></View>
          </View>
          <View className='member-ad-popup__description'>
            <View>OUSea 由虾米学长个人开发维护。</View>
            <View>无需下载、关注或购买，<Text className='member-ad-popup__emphasis'>点一下广告卡片即可。</Text></View>
            <View>广告收入能帮助学长持续提供更多优质内容～</View>
            <View className='member-ad-popup__thanks'>感谢你的支持！<Text>💛</Text></View>
            <View className='member-ad-popup__repeat'>每次出现，都可以点一次。</View>
          </View>
          <View className='member-ad-popup__ad-wrap'>
            <View className='member-ad-popup__guide'>
              <Text className='member-ad-popup__guide-label'>这是广告哦～</Text>
              <Image className='member-ad-popup__guide-arrow' src={guideArrow} mode='aspectFit' />
            </View>
            <View className='member-ad-popup__ad'>
              <AdCustom
                unitId={MEMBER_AD_UNIT_ID}
                onLoad={() => {
                  if (!active.current || loaded.current) return
                  loaded.current = true
                  onReady()
                }}
                onError={close}
                {...{ onClose: close }}
              />
            </View>
          </View>
          <View className='member-ad-popup__bottom-decor member-ad-popup__bottom-decor--left'><Image src={dashMark} /><Image src={dashMark} /></View>
          <View className='member-ad-popup__bottom-decor member-ad-popup__bottom-decor--right'><Image src={dashMark} /><Image src={dashMark} /></View>
        </View>
      </View>
    </View>
  )
}

export default MemberAdPopup
