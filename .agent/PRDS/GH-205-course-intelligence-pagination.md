# Miniapp: 选课情报评价分页与考试观点入口

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-09-08
**Last Updated:** 2026-09-08

## Overview

选课情报原始观点目前固定请求第一页 20 条，接口返回的总数和后续页没有被消费；考试摘要虽然包含观点数量及原始数据，但页面只展示计数，用户无法从该区域查看具体内容。

## User Story

**As a** 查看课程选课情报的学生
**I want** 查看全部评价并从考试摘要直达考试观点
**So that** 不会误以为数据缺失，也不会遗漏第 20 条之后的经验

## Implementation Overview

- 保存评价分页元数据，筛选条件变化时重置为第一页。
- 使用显式“加载更多”按钮按页追加评价，并提供加载中、失败重试和全部加载完成状态。
- 将考试摘要变成“查看考试观点”入口，点击后切换到考试维度并定位原始观点区域。
- 不直接渲染 `overview.exam.claims`，统一通过分页评价接口作为原文列表数据源，避免重复列表和分页口径不一致。

## Requirements

1. 首次加载继续请求 20 条，展示已加载数量与接口总数。
2. 还有后续页时可加载下一页，结果去重追加；请求期间禁止重复触发。
3. 教师或维度筛选改变时清空旧列表并重新加载第一页。
4. 考试摘要点击后切换到 `exam` 维度，并将原始观点区滚动到可见位置。
5. 分页失败不清空已加载内容，允许用户重试。

## Files to Modify

- `src/features/course-intelligence/reader.tsx` - 分页状态、追加加载和考试观点入口。
- `src/features/course-intelligence/reader.scss` - 分页与入口状态样式。
- `scripts/academic-statistics-smoke.ts` - 增加分页及考试入口静态回归断言。

## Libraries/Dependencies

- Taro React 与微信小程序页面滚动能力；不新增依赖。

## Testing Requirements

- 统计页 smoke 覆盖页码递增、追加去重、考试筛选入口。
- TypeScript 类型检查和定向 ESLint。
- 微信小程序完整构建。
- 开发者工具验证首次 20 条、加载更多及考试观点入口。

## Risks

- 页面使用整页滚动且底部存在固定 CTA，因此不采用嵌套 `ScrollView` 自动触底，避免双滚动容器和误触发。
- 后端生产环境需存在超过 20 条的筛选结果，才能完成真实第二页联调；否则通过接口 mock 或已有大样本课程验证。
