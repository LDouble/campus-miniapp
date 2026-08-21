# Campus Miniapp：统一详情页图片与审核态

**Priority:** High
**Status:** In Progress
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

社区帖子详情与二手详情目前分别使用自适应大图网格和整宽轮播，图片尺寸、间距、圆角及“图片审核中”提示与帖子列表不一致。目标是抽出共享媒体网格，以帖子列表为视觉基准，让所有真实返回图片的详情场景保持同一展示语言。

## Requirements

1. 图片网格沿用帖子列表：单图 `424rpx × 212rpx`，双图 `220rpx` 方图，两张并排，三至九图 `152rpx` 方图三列排列，间距 `8rpx`。
2. 图片使用 `aspectFill` 和稳定容器，统一 `10rpx` 圆角、语义占位底色，不因加载改变布局。
3. 图片审核态沿用列表：有图时使用覆盖整图的 `45%` 深色遮罩并居中显示“图片审核中”；遮罩不阻断发布者预览自己的原图；无有效 URL 时显示稳定占位提示。
4. 社区详情和二手详情复用同一媒体网格组件；帖子列表也改为复用该组件，避免后续视觉再次分叉。
5. 详情页在图片出现后通过 `Taro.getImageInfo` 预取本地临时路径，点击时优先使用本地路径调用 `Taro.previewImage`；预取失败回退远端 URL。列表维持原整卡进入详情的交互。
6. 纯文字二手详情不渲染图片区域；不为跑腿、找同行伪造服务端未返回的图片。
7. 深色模式只调整占位底板，真实图片保持原色；审核遮罩保持明确文字提示。

## Files to Modify

- `src/features/community/components/content-image-grid.tsx` - 新增共享图片网格组件。
- `src/features/community/components/content-image-grid.scss` - 对齐帖子列表图片与审核态样式。
- `src/features/community/content-image-preview.ts` - 缓存详情预览所需的本地临时图片路径。
- `src/features/community/post-card.tsx` - 复用共享图片网格。
- `src/features/community/feed-panel.scss` - 移除重复图片样式。
- `src/packages/social/community/detail.tsx` / `detail.scss` - 复用共享图片网格并保留预览。
- `src/packages/social/marketplace/detail.tsx` / `detail.scss` - 用共享图片网格替换详情轮播并增加预览。
- `src/styles/_dark-mode.scss` - 更新共享网格暗色规则。
- 对应 smoke test - 校验共享组件、尺寸、遮罩、无图和预览行为。

## API Endpoints

不修改接口。社区继续消费 `post.images`，二手继续消费 `item.image_urls`。

## Testing Requirements

- `yarn test:community-list-figma`
- `yarn test:community-detail-figma`
- `yarn test:media-images`
- `yarn test:business-detail-navigation`
- `yarn test:community-avatar`
- `yarn test:dark-mode`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Acceptance Criteria

- 帖子列表、帖子详情和二手详情的单图、多图及审核遮罩视觉一致。
- 详情图片可从当前图片进入微信原生预览，并优先使用提前获取的本地路径；纯文字二手不出现图片占位卡。
- 审核状态覆盖整张图、文字居中，浅色和深色模式都清晰。
- 共享组件没有改变帖子列表卡片点击、图片数量上限和详情业务逻辑。

---

**Implementation Notes:** UI/UX 技能检索结果仅用于图片优先级和稳定布局检查；配色、尺寸与交互以 Ousea / Global 和现有帖子列表为准。
