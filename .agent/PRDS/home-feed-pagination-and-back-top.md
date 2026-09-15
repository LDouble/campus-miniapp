# Campus Miniapp：首页 Feed 自动分页与返回顶部

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

首页“校园动态”已经接入 `/api/v1/home/feed` 混排接口，但当前只请求第一页，用户无法继续浏览更多内容。首页内容较长时也缺少快速回到顶部的操作。本任务沿用社区 Tab 的页面触底分页机制，保持首页首屏密度和四类内容的真实路由。

## Requirements

1. 首页首次请求继续使用 `page=1, page_size=8`，保持现有首屏展示数量。
2. 首页页面使用 Taro `useReachBottom` 发送分页信号，复用共享 `useLoadMoreSignal` 消费信号。
3. 只有首屏请求完成、没有错误、没有分页请求进行中且 `items.length < total` 时才加载下一页。
4. 分页追加按 `source_type + source_id` 去重，不能影响已有点赞、评论和评论预览的本地状态。
5. 首页下拉刷新、页面重新显示或首屏请求开始时，使旧分页响应失效，避免旧数据覆盖刷新结果。
6. Feed 列表底部展示非交互式“继续上滑加载更多 / 正在加载更多…”状态，不再依赖点击。
7. 到达末页且列表非空时，底部展示非交互式“没有更多了”提示；空列表不展示该提示。
8. 页面滚动超过约 `480rpx` 后显示右下角返回顶部按钮，按钮避开自定义 TabBar 和安全区，点击通过 `Taro.pageScrollTo` 平滑回到 `scrollTop: 0`。
9. 返回顶部按钮使用真实 SVG 图标，支持暗色模式，不影响帖子操作菜单和评论输入框的滚动收起逻辑。

## Implementation

- `src/pages/index/index.tsx`：接入首页 Feed 分页状态、请求锁、触底信号、页面滚动状态和返回顶部操作。
- `src/pages/index/index.config.ts`：配置首页触底提前量。
- `src/features/home/feed-post-adapter.ts`：集中维护首页 Feed 来源过滤与追加去重辅助逻辑（如需要）。
- `src/pages/index/index.scss`：增加首页 Feed 非交互分页状态和返回顶部浮动按钮。
- `src/styles/_dark-mode.scss`：校准返回顶部及 Feed 分页提示的暗色颜色层级。
- `src/assets/icons/arrow-up.svg`：新增功能性返回顶部图标。
- `scripts/home-guest-smoke.ts`：补充首页分页、返回顶部和分页去重结构断言。

## Result

- 首页 Feed 已通过页面级触底信号自动追加下一页，不依赖点击加载控件。
- 首页、社区、闲置、跑腿、找同行列表在非空且到达末页时统一显示“没有更多了”。
- 首页已提供滚动后的返回顶部按钮，并保留安全区与自定义 TabBar 避让。
- 已通过首页、社区触底分页、暗色模式 smoke、TypeScript、lint 与 `git diff --check`；按约定未重复执行 Taro watch build。

## Acceptance Criteria

- 首页不点击加载控件，持续上滑可自动追加下一页混排内容。
- 首页帖子和三类业务内容仍使用 `CommunityPostCard`，既有点赞、评论、详情跳转不回归。
- 快速重复触底不并发加载同一页；刷新后旧请求不能覆盖最新第一页。
- 返回顶部按钮只在下滚后出现，点击后回到页面顶部，并且不遮挡底部 TabBar。
- 相关 smoke、TypeScript、lint、暗色模式和 `git diff --check` 通过；按开发约定不重复执行 Taro build。
