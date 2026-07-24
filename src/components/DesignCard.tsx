import { PropsWithChildren } from 'react'
import { View } from '@tarojs/components'

export function DesignCard ({ children, className = '', onClick }: PropsWithChildren<{ className?: string; onClick?: () => void }>) {
  return <View className={`design-card ${className}`} onClick={onClick}>{children}</View>
}
