## Task: 修复蹭课页深色模式

**ID:** GH-192-course-audit-dark-mode
**Label:** Miniapp: 修复蹭课页深色模式
**Description:** 补齐蹭课课程发现页在深色主题下的页面、筛选、课程卡片和提示信息颜色适配。
**Type:** Bug
**Status:** Done
**Priority:** High
**Created:** 2026-09-05
**Updated:** 2026-09-05
**Issue:** https://github.com/LDouble/campus-miniapp/issues/192
**PRD:** [修复方案](../PRDS/GH-192-course-audit-dark-mode.md)

## 验收标准

- 蹭课检索页的页面背景、搜索输入、学期/筛选区域、课程卡片、说明卡和加载/空状态在深色模式下均可读。
- 深色模式不再出现白色卡片、浅色边框或浅色占位文字刺眼的问题，保留课程状态和主操作的语义层级。
- 搜索结果与“我的蹭课”复用同一套深色语义，交互和浅色模式保持一致。
- 不新增页面私有基础色；所有新增颜色使用现有 Ousea / Global 语义令牌。
