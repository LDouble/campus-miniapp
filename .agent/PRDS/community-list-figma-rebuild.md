# 海大校园小程序：社区统一列表卡片 Figma 重构

**Priority:** High
**Status:** Completed
**Type:** Refactor
**Created:** 2026-08-20
**Last Updated:** 2026-08-20

## 概述

依据 Figma 文件 `tQIWc49y8TRDwAVYSdllBU` 的节点 `171:2`，在已完成的校园生活顶部 Bar 基础上重构社区帖子信息流。公共帖子卡片由社区首页、话题页和个人主页共同复用；三个页面保留各自真实的数据请求、分页和页面级头部，只统一帖子卡片本身的结构、视觉与操作。

## 用户故事

**作为** 浏览校园社区的学生
**我希望** 在社区首页、话题页和个人主页看到一致、紧凑且接近微信信息流的帖子卡片
**从而** 能快速辨认作者、正文、图片、发布时间、板块以及真实互动状态

## 设计依据

- Figma 文件：`tQIWc49y8TRDwAVYSdllBU`
- 目标节点：`171:2`
- 参考画布：`403 × 2039px`
- 帖子左右留白：约 `16px`
- 头像：约 `40 × 40px`，`6px` 圆角
- 头像与正文列间距：约 `12px`
- 作者名：约 `17px`，颜色 `#576B95`
- 正文：约 `17px / 27.2px`，颜色 `#111111`
- 元信息：约 `13px`，时间 `#B2B2B2`、板块 `#576B95`
- 图片宫格：三列等宽、约 `6px` 间距；单图采用横向封面比例
- 互动区：`#F7F7F7` 背景、`4px` 圆角，点赞与评论文字使用 `#576B95`
- 帖子之间使用 `#F3F4F6` 细分隔，不使用圆角大卡片、阴影或玻璃效果

## 范围

### 包含

1. 重构公共 `CommunityPostCard`，由社区首页、话题页和个人主页直接复用。
2. 将头像改为圆角方形，并把作者名、正文、图片、元信息和互动区统一放入右侧内容列。
3. 正文最多展示六行；超长内容显示与设计一致的“全文”入口，点击仍进入真实详情页。
4. 图片使用真实接口资源与 `aspectFill`，单图使用横向比例，两图使用双列，三至九图使用三列宫格；超过九图时在第九张显示剩余数量。
5. 保留作者主页跳转、帖子详情、板块筛选、点赞、评论入口、原生分享、审核状态和图片审核遮罩。
6. 将原有底部点赞/评论/分享三按钮改造成设计稿中的浅灰互动面板；点赞与评论只展示接口返回的真实数量。
7. 将元信息右侧的小型省略按钮连接到现有原生分享能力，不实现无接口支撑的装饰菜单。
8. 社区首页移除不在目标稿中的旧运营聚合块和“最新动态/条数”视觉标题，使真实帖子列表紧接顶部筛选区域；加载、错误、空态、搜索和分页继续可用。
9. 话题页与个人主页保留各自页面头部和分页容器，但帖子使用同一公共组件和同一套样式。
10. 补充稳定结构 smoke 测试，并回归三个页面现有的性能、头像、分页与导航约束。

### 不包含

- 不修改后端 API、OpenAPI、数据库或评论数据模型。
- 不硬编码 Figma 中的示例头像、帖子图片、作者、点赞人名或评论内容。
- 不伪造列表接口未返回的点赞用户列表和评论预览。
- 不新增编辑、删除或举报菜单；这些权限操作仍在帖子详情页完成。
- 不修改顶部 Bar 与底部自定义 TabBar 已确认的结构和交互。

## 数据与交互映射

| Figma 元素 | 真实实现 |
| --- | --- |
| 头像、作者名 | `author_avatar_url`、`author_nickname`；注销用户沿用现有回退逻辑 |
| 正文与全文 | `content`；超长摘要点击进入详情 |
| 单图/宫格 | `images`，首页列表最多呈现九张 |
| 时间 | `published_at`，为空时使用 `created_at` |
| 板块 | `section_id` 对应服务端板块名；有筛选回调时可点击 |
| 爱心行 | `liked`、`like_count` 与真实点赞接口 |
| 评论行 | `comment_count`，点击进入详情查看真实评论 |
| 右侧省略按钮 | 原生 `openType='share'` 与现有分享数据属性 |
| 审核提示 | `viewer_relation`、`status` 与现有图片审核覆盖层 |

Figma 中展示了点赞用户名和评论正文，但当前列表接口只返回计数。实现使用同样的互动面板层级展示真实计数及“查看全部 N 条评论”，不创建演示数据。

## 实现方案

1. 保留 `CommunityPostCard` 的 `memo`、稳定帖子 ID、`.api-post` 与 `.api-post__body`，避免性能与 E2E 选择器回归。
2. 公共组件改为头像列与内容列布局，不新增首页专属 variant。
3. 保留前三页调用方现有的 `useCallback`、快照、订阅消息、分页去重和点赞接口。
4. 使用 Figma 原始导出的爱心 SVG；用户上传图片仍从 API 动态加载。
5. 使用 Taro `Image mode='aspectFill'` 与 `lazyLoad`，通过公共 SCSS 实现响应式图片布局。
6. 暗色模式只替换颜色与背景，不改变 Figma 的结构和空间关系。
7. 社区首页移除旧热门话题/精选/推荐聚合块与信息流标题；其他页面的 Hero、Tab 和列表标题属于页面级信息，继续保留。

## 修改文件

- `src/features/community/post-card.tsx`
- `src/features/community/feed-panel.tsx`
- `src/features/community/feed-panel.scss`
- `src/pages/community/index.tsx`
- `src/styles/_dark-mode.scss`
- `src/styles/_typography.scss`
- `src/pages/community/index.scss`
- `src/packages/social/community/topic/index.tsx`
- `src/pages/public-profile/index.tsx`
- `src/pages/public-profile/index.scss`
- `src/pages/public-profile/index.config.ts`
- `src/assets/community/feed-heart.svg`
- `scripts/community-list-figma-smoke.ts`
- `scripts/community-avatar-smoke.ts`
- `scripts/dark-mode-smoke.ts`
- `scripts/typography-smoke.ts`
- `scripts/share-smoke.ts`
- `package.json`

如模拟器验收发现话题页或个人主页的父容器间距影响卡片展示，再最小调整对应页面 SCSS，不复制卡片样式。

## 依赖与规范

- Taro 版本保持 `4.1.11`，不新增 npm 依赖。
- Taro 本地文档确认 `Image` 支持微信小程序的 `aspectFill` 与 `lazyLoad`。
- Taro 页面引入样式会进入全局作用域，因此公共卡片使用独立 BEM 类名，页面级规则只调父容器。
- Figma 设计转代码上下文、原始截图和导出资源均来自节点 `171:2`。

## 验收标准

1. 社区首页的首条帖子紧接顶部筛选，不再出现旧“最新动态”标题和玻璃卡片间距。
2. 三个页面的帖子均为相同的头像列/正文列布局，头像、字号、行距、颜色、分隔线和互动面板接近 Figma。
3. 无图、单图、双图、三图和九宫格均不溢出；超过九图能显示真实剩余数量。
4. 长正文最多六行并显示“全文”，短正文不出现无效入口。
5. 作者跳转、详情跳转、板块筛选、点赞、查看评论和原生分享均保持真实可用。
6. 审核中、未通过和图片审核中状态继续可见。
7. 不出现写死的示例用户、图片、点赞人名、评论或互动数字。
8. 社区首页、话题页和个人主页分页、去重、缓存与加载状态无回归。
9. 暗色模式下正文、元信息、图标和互动面板可读。
10. Lint、TypeScript、相关 smoke 测试、微信小程序构建及 `git diff --check` 通过。

## 测试要求

### 自动验证

- `yarn test:community-list-figma`
- `yarn test:community-performance`
- `yarn test:community-avatar`
- `yarn test:community-topic`
- `yarn test:public-profile-campus`
- `yarn test:life-hub-refresh`
- `yarn test:community-tab-scroll-top`
- `yarn test:dark-mode`
- `yarn test:typography`
- `yarn test:tabbar-layout`
- `yarn lint`
- `yarn typecheck`
- `yarn build:weapp`
- `git diff --check`

### 微信开发者工具验收

- 社区首页：核对无图、有图、九宫格、点赞、详情、作者、板块、搜索和滑动触底自动分页。
- 话题页：核对 Hero 下的公共卡片、点赞、作者和分页。
- 个人主页：核对社区 Tab 的公共卡片、点赞、详情和其他业务 Tab 不受影响。
- 滚动后确认内容不会穿透系统状态栏，最后一张卡片不会被底部 TabBar 遮挡。
- 暗色模式下检查文本、互动面板、审核状态和图片占位。

## 风险与约束

- 列表接口没有点赞用户和评论预览，无法逐字复现 Figma 的社交内容；以真实计数做结构等价适配。
- 公共组件被三个页面复用，任何样式改动都必须同时在三处验收。
- Figma 为固定宽度画布，图片宫格需在实际设备宽度下响应式收缩，不能写死为只适配 `403px`。

---

**Implementation Notes:**

本任务承接尚未合并的顶部 Bar 重构，继续使用 `agent/community-tab-refactor`。用户已明确要求直接实现，并补充确认话题页和个人主页也复用相同帖子卡片。

- 公共帖子卡片已采用头像列/正文列结构，支持六行正文、“全文”、单图、双图、九宫格及第九张剩余数量提示。
- 社区首页已移除旧运营聚合块与信息流标题，列表紧接顶部筛选；话题页和个人主页保留各自页面头部。
- 三处页面均能从卡片右侧省略按钮触发当前帖子的原生分享；个人主页已补齐分享页面配置。
- 自动验证已通过：Lint、TypeScript、分享及社区相关 smoke、暗色模式、排版、底部安全区和微信小程序构建。
- 微信开发者工具已验收社区首屏、滚动态、话题页与个人主页；滚动内容未穿透系统状态栏，控制台无错误。
