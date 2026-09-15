# 校园鲨表情包

本目录包含 32 张 `96×96` 的透明 PNG 表情。素材针对评论与信息流中约 20–26 物理像素的展示场景重新构图，在不改变组件尺寸的前提下增强辨识度。

## 微缩素材规范

- 主体占画布约 90%–92%，四周保留约 4%–6% 安全留白。
- 脸部和核心表情是第一视觉层级，每张只保留一个主要手势或道具。
- 使用连续的深蓝外轮廓、大色块和简化内部线条，避免依赖微小装饰表达含义。
- 输出为带透明通道的调色板 PNG，单套资源控制在 200KB 以内。
- 文件名、表情 ID 和中文标签保持稳定；新正文直接存储可读的 `[标签]`，客户端继续兼容历史带 ID 标记。

## Taro 用法

```tsx
import { Image, View } from '@tarojs/components'
import { campusStickers } from '../../assets/stickers'

export default function StickerGrid() {
  return (
    <View className='sticker-grid'>
      {campusStickers.map((sticker) => (
        <Image
          key={sticker.id}
          src={sticker.src}
          mode='aspectFit'
          ariaLabel={sticker.label}
        />
      ))}
    </View>
  )
}
```

若只需一张，可直接引用：

```tsx
<Image src={require('../../assets/stickers/sticker-01.png')} mode='aspectFit' />
```
