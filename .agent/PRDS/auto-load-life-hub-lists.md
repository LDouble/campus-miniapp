# Campus Miniapp：社区四类列表自动加载更多

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

社区 Tab 的社区、跑腿、二手和找同行列表目前都需要点击底部“查看更多”。四类内容共享页面级滚动容器，应统一改为接近页面底部时自动请求下一页，保留现有分页、缓存、去重、错误和空状态。

## Requirements

1. 页面使用 Taro `useReachBottom` 监听上拉触底，四个 Tab 共用同一入口。
2. 当前可见列表收到一次性加载信号后，仅在首屏加载完成、无错误、未在加载且仍有更多数据时请求下一页。
3. 每次触底信号最多触发一次分页；加载状态变化不能让同一信号连续加载多页。
4. 快速重复触底不得发起并发重复请求；切换 Tab 时不得消费进入新列表前的旧信号。
5. 删除“查看更多”的点击行为，底部仅展示“继续上滑加载更多”或“正在加载更多…”状态。
6. 搜索、筛选、下拉刷新、缓存恢复、列表去重与业务卡片交互保持不变。
7. 页面配置使用合适的 `onReachBottomDistance`，让请求在用户真正看到列表底部前开始。

## Implementation

- `src/pages/community/index.tsx`：注册页面级 `useReachBottom` 并向当前列表传递递增信号。
- `src/hooks/use-load-more-signal.ts`：提供共享的一次性信号消费 Hook。
- `src/features/community/feed-panel.tsx`：社区帖子列表响应自动分页信号。
- `src/features/life-services/list-panel.tsx`：跑腿、二手、找同行共享响应自动分页信号。
- `src/pages/community/index.config.ts`：配置页面触底提前量。
- `src/features/community/feed-panel.scss`、`src/features/life-services/list-panel.scss`：将加载更多按钮降级为非交互状态提示。
- `scripts/community-tab-scroll-top-smoke.ts`：补充四类列表共享触底入口、并发保护和无点击加载断言。
- `scripts/e2e-community.sh`：分页场景改为滚动触底验证。

## Acceptance Criteria

- 社区、跑腿、二手、找同行均无需点击按钮，持续上滑即可追加下一页。
- 加载中只出现一个分页请求和一个加载提示。
- 无更多数据、错误态、空态不触发分页。
- 切换栏目后首次加载仍从第一页开始，不被旧触底事件误触发。
- 相关 smoke、TypeScript、lint 和 `git diff --check` 通过；按当前开发约定不重复执行 Taro build。

## Result

- 四类列表共用页面级 `useReachBottom`，触底提前量为 `160px`。
- 公共 Hook 在组件挂载时记录当前信号，只消费挂载后的新信号；栏目切换不会误用旧事件。
- 社区和生活服务分页各增加追加请求锁，快速重复触底不会并发请求同一页。
- “查看更多”已改为“继续上滑加载更多 / 正在加载更多…”纯状态提示。
- 模拟器未点击任何加载控件，社区帖子从首屏 20 条自动追加到 23 条。
- 已通过社区 Tab、社区列表、生活服务刷新、暗色模式、设计 Token、排版、TypeScript、lint 和差异检查；未重复执行 watch build。
