## Task: 社区四类列表自动加载更多

**ID:** auto-load-life-hub-lists
**Label:** Campus Miniapp: 社区四类列表自动加载更多
**Description:** 将社区、跑腿、二手和找同行列表的手动“查看更多”改为页面滑动触底自动分页。
**Type:** Enhancement
**Status:** Done
**Priority:** High
**Created:** 2026-08-21
**Updated:** 2026-08-21
**PRD:** [Link](../PRDS/auto-load-life-hub-lists.md)

---

**Branch:** 这是尚未合并的社区 Tab 改造的交互补充，继续在 `agent/community-tab-refactor` 完成。

**Implemented:** 社区 Tab 已通过页面级 `useReachBottom` 向当前列表发送一次性分页信号；社区帖子与三类生活服务列表复用同一信号消费 Hook，并以追加请求锁避免并发。底部手动按钮已改为非交互状态提示，模拟器验证社区列表由 20 条自动追加至 23 条。
