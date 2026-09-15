## Task: 社区统一列表卡片 Figma 重构

**ID:** community-list-figma-rebuild
**Label:** OUSea小程序：社区统一列表卡片 Figma 重构
**Description:** 依据 Figma 节点 `171:2` 重构社区帖子信息流，并由社区首页、话题页和个人主页共同复用同一套帖子卡片结构、视觉和真实交互。
**Type:** Refactor
**Status:** Done
**Priority:** High
**Created:** 2026-08-20
**Updated:** 2026-08-20
**PRD:** [产品需求文档](../PRDS/community-list-figma-rebuild.md)

---

**分支说明：** 本任务是尚未合并的 `agent/community-tab-refactor` 的后续阶段，继续在原分支完成，不另开替代分支。

**用户补充：** 话题页和个人主页必须复用本次重构后的公共帖子卡片，不做社区首页专属样式分支。

## 完成结果

- 社区首页、话题页和个人主页已统一复用重构后的 `CommunityPostCard`。
- 帖子结构、图片宫格、元信息和互动面板已按 Figma 节点 `171:2` 落地，且只展示接口真实数据。
- 作者、详情、板块、点赞、评论和三处页面的原生分享能力均已保留。
- 自动化回归、微信小程序构建以及开发者工具四场景验收均已通过。
