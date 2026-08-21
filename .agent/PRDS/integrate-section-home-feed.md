# 海大校园小程序：接入首页校园动态混排流

**Priority:** High
**Status:** Done
**Type:** Feature
**Created:** 2026-08-20
**Last Updated:** 2026-08-21

## Overview

接入服务端 `agent/section-home-feed` 提供的首页公开内容聚合能力，以 Figma `5:3186` 的“校园动态”区块为视觉参考，在首页列表中混排校园圈帖子、二手、跑腿和找同行内容。校园圈帖子展示真实点赞人昵称和评论预览，其他业务类型展示有助于决策的紧凑摘要。

## User Story

**As a** 校园小程序用户
**I want** 在首页连续浏览不同校园业务的最新公开内容
**So that** 无需逐个进入社区、二手、跑腿和找同行页面即可发现近期动态并快速查看详情

## Context

- 服务端新增 `GET /api/v1/home/feed`，按公开时间聚合四类内容。
- 聚合条目统一返回 `comment_count`、最多三条包含根/父级关系的 `comment_previews`、当前用户 `liked`、`like_count` 和最多五个 `liked_by_nicknames`。
- 校园圈帖子列表模型同步增加点赞人昵称与评论预览字段。
- 当前首页分别请求二手与校园圈预览，尚未消费统一混排流。
- Figma `5:3186` 使用连续白色内容区、细分隔线和按业务语义变化的摘要卡，不使用四套互不相关的大卡片。

## Implementation Overview

1. 从服务端 OpenAPI 契约补齐首页混排类型与 repository 方法。
2. 将首页下半区的数据源切换为 `GET /api/v1/home/feed`，保留现有加载、错误、刷新和访客行为。
3. 四类条目统一复用 `CommunityPostCard`；通过首页适配层映射公共帖子字段，按 `source_type` 生成业务摘要。
4. 校园圈条目展示真实点赞人昵称及评论预览，并复用现有帖子详情快照/导航能力。
5. 其他类型沿用现有业务详情路由与语义格式化，不在首页复制完整详情卡。
6. 使用 Ousea / Global Token 保持 `CommunityPostCard` 的白色连续信息流；仅为二手、跑腿、找同行增加设计稿对应的业务浅色摘要变体。
7. 评论预览消费 `parent_id`、`root_id`、`reply_to_comment_id` 与 `reply_to_nickname`；新建二级回复后插入对应根评论的二级预览，而不是伪装成一级评论。
8. 服务端首屏预览仍为最多三条；当前用户刚提交的本地评论和回复不受三条限制。总评论数超过三条时，在预览下方展示“查看全部 x 条评论”。

## Features / Requirements

1. **统一数据源**
   - 请求 `GET /api/v1/home/feed?page=1&page_size=<n>`。
   - 首页刷新时重新请求；失败时保留已有模块级错误与重试能力。
   - 不再并行请求重复的校园圈和二手首页预览数据。

2. **四类条目渲染**
   - `campus_circle_post`：正文、图片、当前用户点赞状态、点赞人昵称、一级评论与二级回复预览。
   - `marketplace_listing`：意图、分类、价格与图片摘要。
   - `errand`：取件地、送达地、截止时间与报酬摘要。
   - `carpool`：起点、终点、出发时间与余座摘要；用户文案统一为“找同行”。

3. **导航和交互**
   - 点击条目进入对应详情页。
   - 校园圈条目评论预览可携带评论 ID 定位详情评论。
   - 保留现有审核、认证、分享和详情页局部交互，不在首页伪造服务端未返回的状态。

4. **视觉与可访问性**
   - 使用 Ousea / Global 颜色、字号、间距、圆角与分隔线 Token。
   - 用户生成正文允许换行；弱元信息单行省略。
   - 触控区域不小于 `88rpx`，320–375px 宽度无横向溢出。
   - 暗色模式继续使用语义 Token。

## Files to Create

- 预计在 `src/features/home/` 下新增首页混排模型或条目组件，具体以现有首页边界为准。
- 新增首页混排专项 smoke，锁定接口、四类路由与点赞/评论预览。

## Files to Modify

- `src/api/types.ts` 或生成类型入口：补充首页混排与新增公开互动字段。
- `src/features/life-services/repository.ts` 或首页 repository：增加首页混排请求。
- `src/pages/index/index.tsx`：切换数据源并渲染混排列表。
- `src/pages/index/index.scss`：实现 Figma 对应的紧凑连续信息流。
- `scripts/home-guest-smoke.ts` 及相关 smoke：更新首页数据请求和语义断言。

## API Endpoints

- `GET /api/v1/home/feed?page=<page>&page_size=<1-50>`：返回按公开时间倒序聚合的四类首页内容。

响应核心字段：

- `source_type`：`campus_circle_post | marketplace_listing | errand | carpool`
- `source_id`、`author_id`、`author_nickname`、`feed_time`、`version`
- `content`、`images` 及各业务可空摘要字段
- `comment_count`、`comment_previews`；预览包含 `parent_id`、`root_id`、`reply_to_comment_id`、`reply_to_nickname`
- `like_count`、`liked`、`liked_by_nicknames`

## Libraries/Dependencies

- **Taro**（Context7：`/nervjs/taro-docs`）：沿用函数组件页面生命周期、下拉刷新与现有小程序列表模式。
- 不新增运行时依赖。

## Technical Considerations

- `source_type` 必须使用穷尽分支，未知类型安全忽略并可观测，避免后端扩展导致首页崩溃。
- 聚合接口可能包含已删除作者和空内容，头像、昵称、图片及可空业务字段必须有稳定降级。
- 首页只展示摘要，不复制完整业务卡，控制首屏节点数和包体积。
- 点赞与评论数据以服务端公开投影为准，不根据计数反推昵称或评论内容。

## Design/UX Considerations

- 参考 Figma `5:3186` 的“校园动态”连续列表和浅色社会互动区。
- 校园圈条目以正文和图片为第一视觉焦点；其他业务以价格、路线、时间或余座为第一视觉焦点。
- 点赞人昵称使用社区主色，评论昵称与正文通过字重和颜色区分。
- 列表之间使用细分隔线，不叠加重阴影或多层卡片。

## Testing Requirements

### Unit / Smoke Tests

- 首页混排 API 路径、分页参数和响应映射。
- 四种 `source_type` 的摘要与详情路由。
- 点赞人数、点赞人昵称、评论数量和评论预览展示。
- 二级回复按 `root_id` 插入对应根评论下，并展示“谁回复谁”；本地提交后立即可见。
- 可空字段、作者已删除、空图片和未知类型降级。

### Integration Tests

- 首页加载、下拉刷新和接口失败重试。
- 校园圈评论预览进入详情并定位评论。
- 其他三类条目进入正确详情页。

### Manual Testing Checklist

- review 环境返回真实混排数据。
- 320px、360px、375px 宽度没有横向溢出。
- 浅色、深色模式视觉层级清晰。
- 首页滚动和 Tab 切换无明显节点抖动。

---

**Implementation Notes:**

用户已明确要求在当前 `agent/community-tab-refactor` 分支继续实现，并在开始本任务前提交了既有本地修改；该指令视为本 PRD 范围的实施授权。当前 watch 构建已由用户运行，验证阶段不重复执行 `yarn build:weapp`。
