# 海大校园小程序：收紧帖子双点操作菜单

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

公共帖子卡片的操作浮层固定为双按钮宽度，导致跑腿、找同行、二手等只有“评论”操作时出现过大的深色面板；右侧双点入口的浅色底板和点字符也偏大。改造后浮层根据操作数量自适应，入口只缩小视觉元素，继续保留移动端所需的 `44px × 44px` 触控区域。

## Current Findings

- `.community-post__action-menu` 当前固定宽度为 `376rpx`，单操作场景不会收缩。
- 评论项使用 `flex: 1`，因此单独出现时会填满整块固定面板。
- 双点按钮触控区域为 `88rpx × 88rpx`，符合移动端触控规范，但内部浅色底板为 `72rpx × 56rpx`，视觉重量偏大。
- `ui-ux-pro-max` 建议移动端触控目标至少 `44px`，相邻目标至少保留 `8px` 间距；因此不应直接缩小真实点击热区。
- 项目 Ousea / Global 要求操作按钮热区不小于 `88rpx`，并禁止依赖 hover 作为移动端反馈。

## Implementation Overview

1. `CommunityPostCard` 根据是否存在点赞操作，为浮层增加单操作修饰类。
2. 使用“透明触控盒 + 深色可见盒”双层盒子模型：触控盒保持 `44px` 高，可见盒收紧到 `36px` 高。
3. 单评论浮层约 `68px`；未点赞双操作约 `133px`；已点赞时为容纳“取消点赞”扩展到约 `161px`。
4. 菜单图标收紧到 `16px`，图标与文字间距为 `4px`，操作项水平内边距为 `8px`。
5. 双点按钮真实点击区域继续保持 `44px × 44px`；内部浅色底板保持约 `28px × 22px`。
6. 不引入 hover 态，不改变点击阻止冒泡、单面板展开、滚动收起、点赞和评论行为。

## Files to Modify

- `src/features/community/post-card.tsx` - 为单操作浮层增加修饰类。
- `src/features/community/feed-panel.scss` - 调整菜单自适应宽度、操作项间距和双点视觉尺寸。
- `scripts/community-list-figma-smoke.ts` - 覆盖单操作宽度、双操作宽度和触控热区断言。
- `.agent/PRDS/refine-community-post-card-density.md` - 在完成结果中关联本次后续交互修正。

## Libraries/Dependencies

- 使用现有 Taro 组件与 SCSS，不新增依赖。
- 设计依据为 `ui-ux-pro-max` 的移动端触控建议和项目 Ousea / Global Token。

## Testing Requirements

- 只有评论时浮层宽度与单按钮内容匹配，不再显示双按钮尺寸的大面板。
- 同时有点赞和评论时两项保持等宽、分隔清楚且不换行。
- 双点视觉尺寸缩小，但 `88rpx × 88rpx` 点击区域不变。
- 首页、社区列表、话题页和个人主页复用表现一致。
- 不新增 hover，点击双点、评论、点赞均不穿透帖子详情。
- 通过社区列表 smoke、首页 smoke、暗色模式、typecheck、lint 和 diff 检查；按约定不重新执行 watch build。

---

**Implementation Notes:** 本次只调整 `CommunityPostCard` 的操作浮层密度和触发器视觉，不修改业务能力判断或操作回调。

## Result

- 操作浮层改为“`88rpx` 透明触控盒 + `72rpx` 深色可见盒”，视觉高度降低但点击高度不变。
- 无点赞能力、只有评论时宽度为 `136rpx`；未点赞双操作为 `266rpx`；已点赞时为容纳“取消点赞”扩展到 `322rpx`。
- 双点按钮真实热区保持 `88rpx × 88rpx`，可见浅色底板收紧为 `56rpx × 44rpx`，点字符字号与字距同步降低。
- 操作项取消 `flex: 1`，普通项宽 `128rpx`、已点赞项宽 `184rpx`；水平内边距为 `16rpx`，图标与文字间距为 `8rpx`。
- 菜单操作图标收紧为 `32rpx`，分隔线高度收紧为 `40rpx`。
- 点赞、评论、阻止冒泡、单面板展开和滚动收起逻辑均未改变。
- 已通过社区列表、首页、暗色模式、typecheck、lint 和 diff 检查；按约定未重新执行 watch build。
