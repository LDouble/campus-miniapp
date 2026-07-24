import { View, Text } from '@tarojs/components'
import { DesignIcon } from './DesignIcon'

const features = [['我的课表', 'calendar'], ['二手市场', 'market'], ['校园跑腿', 'errand'], ['失物招领', 'lost'], ['校园卡', 'card'], ['查成绩', 'grade'], ['通过率', 'chart'], ['考试安排', 'exam'], ['查食堂', 'canteen'], ['更多', 'more']]

export function FeatureGrid ({ onClick }: { onClick: (name: string) => void }) {
  return <View className='feature-grid'>{features.map(([name, icon]) => <View className='feature-item' key={name} onClick={() => onClick(name)}><View className='feature-icon'><DesignIcon name={icon} /></View><Text>{name}</Text></View>)}</View>
}
