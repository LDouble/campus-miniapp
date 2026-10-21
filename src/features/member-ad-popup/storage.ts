import Taro from '@tarojs/taro'
import { createMemberAdFrequency } from './frequency'

/** memberAdFrequency 只在浮层完成实际展示后写入三天冷却记录。 */
export const memberAdFrequency = createMemberAdFrequency(Taro)
