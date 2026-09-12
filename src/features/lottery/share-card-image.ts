import Taro from '@tarojs/taro'
import giftImage from '../../assets/lottery/gift-3750.png'
import tokens from '../../../design-system/campus-miniapp/ousea-design-tokens.json'
import type { lotteryShareCard } from './share-card'

export const LOTTERY_SHARE_CANVAS = 'lottery-share-card'
const colors = tokens.global.color.lottery

/** 绘制完成后才导出；失败由页面保留稳定兜底图，不影响分享路径。 */
export const renderLotteryShareCard = async (card: ReturnType<typeof lotteryShareCard>) => {
  const ctx = Taro.createCanvasContext(LOTTERY_SHARE_CANVAS)
  const text = (value: string, x: number, y: number, size: number, width: number, color = colors.ink.value) => {
    ctx.setFontSize(size)
    ctx.setFillStyle(color)
    let chars = Array.from(value.replace(/\s+/g, ' ').trim())
    while (chars.length && ctx.measureText(chars.join('')).width > width) chars = chars.slice(0, -1)
    const clipped = chars.length < Array.from(value).length
    if (clipped) {
      while (chars.length && ctx.measureText(`${chars.join('')}…`).width > width) chars.pop()
    }
    ctx.fillText(chars.join('') + (clipped ? '…' : ''), x, y)
  }
  ctx.setFillStyle(colors.page.value)
  ctx.fillRect(0, 0, 500, 400)
  const gradient = ctx.createLinearGradient(0, 0, 500, 0)
  gradient.addColorStop(0, colors.orange.value)
  gradient.addColorStop(1, colors.golden.value)
  ctx.setFillStyle(gradient)
  ctx.fillRect(0, 0, 500, 72)
  text('OUSea · 校园抽奖', 26, 45, 24, 260, '#ffffff')
  text(card.status, 330, 44, 19, 145, '#ffffff')
  text(card.heading, 26, 113, 26, 448)
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(24, 139, 452, 178)
  // Canvas 图片 API 不像 <Image> 自动按页面解析打包资源的相对路径。
  const packagedGift = giftImage.replace(/^(?:\.\.\/|\.\/)+/, '/')
  let info = { path: packagedGift, width: 122, height: 133 }
  if (card.image) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      info = await Promise.race([
        Taro.getImageInfo({ src: card.image }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('image timeout')), 6000) }),
      ])
    } catch {
      // 网络图片失败时使用包内礼盒，不依赖临时远程封面。
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  try {
    const ratio = Math.min(144 / info.width, 144 / info.height)
    const width = info.width * ratio
    const height = info.height * ratio
    ctx.drawImage(info.path, 42 + (144 - width) / 2, 155 + (144 - height) / 2, width, height)
  } catch {
    text('校园好礼', 48, 233, 24, 136, colors.accent.value)
  }
  text(card.prize, 202, 199, 23, 252)
  text(card.quantities, 202, 242, 18, 252, colors.secondary.value)
  text('查看活动详情', 202, 282, 20, 252, colors.accent.value)
  text(card.footer, 26, 362, 22, 448, colors.accent.value)
  await new Promise<void>((resolve) => ctx.draw(false, resolve))
  return (await Taro.canvasToTempFilePath({ canvasId: LOTTERY_SHARE_CANVAS, width: 500, height: 400, destWidth: 1000, destHeight: 800, fileType: 'png' })).tempFilePath
}
