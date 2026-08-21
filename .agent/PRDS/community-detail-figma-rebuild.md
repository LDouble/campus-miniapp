# OUSea小程序：社区帖子详情 Figma 重构

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-20
**Last Updated:** 2026-08-20

## 概述

依据 Figma 文件 `tQIWc49y8TRDwAVYSdllBU` 的节点 `163:587`，在现有社区列表重构基础上重新实现帖子详情页。目标是在不改变后端接口、不伪造数据、不破坏评论与审核流程的前提下，复刻设计中的作者信息、正文、互动区、评论树和固定底部评论栏。

本任务继续使用尚未合并的 `agent/community-tab-refactor` 分支，属于当前社区视觉重构的后续阶段，不新建替代分支。

## 用户故事

**作为** 浏览校园社区帖子的学生

**我希望** 详情页与社区列表保持一致，并能清晰查看正文、图片、点赞和评论回复

**从而** 可以连续阅读帖子、参与讨论并使用真实的分享、举报和作者权限操作

## 设计依据

- Figma 文件：`tQIWc49y8TRDwAVYSdllBU`
- 目标节点：`163:587`
- 参考画布：`402 × 1166px`
- 页面底色：白色，不使用旧版玻璃卡片、渐变背景和大圆角阴影
- 主体左右留白：`16px`
- 作者头像：统一使用圆形公共头像；详情尺寸保持 `40 × 40px`
- 作者名：`15px`；结合当前已确认规范，字重统一使用 `400`
- 发布时间：`12px`、`#6A7282`
- 正文：`16px / 26px`、字重 `400`
- 评论正文：`15px / 24.375px`，回复正文 `14px / 21px`
- 评论头像：根评论 `32px`，回复 `24px`，均使用同一圆形公共组件
- 底部评论栏：白底顶部分隔线、`32px` 头像、圆角输入框、绿色圆形发送按钮

## 范围

### 包含

1. 重构帖子详情主体为全宽白色信息流布局，移除旧玻璃卡片、渐变和阴影。
2. 主体顶部展示真实作者头像、昵称和发布时间；作者点击仍进入公开主页。
3. 保留完整正文、贴纸内容、单图自适应、多图宫格、图片预览和图片审核遮罩。
4. 使用产品真实身份展示“中国海洋大学”胶囊标签；保留真实话题标签与审核说明。
5. 重构评论标题和帖子操作区，使用真实评论数、点赞数、原生分享及举报能力。
6. 顶部更多按钮连接真实操作菜单：作者按 `available_actions` 编辑或删除，普通用户可进入举报。
7. 直接重构共享 `DetailComments` 的统一结构与样式；社区、跑腿、二手和找同行详情继续复用同一组件，不增加视觉变体。
8. 根评论按设计呈现头像、昵称、时间、正文和真实点赞；回复使用嵌套浅灰卡片，并保留完整回复树能力。
9. 固定底部评论栏展示当前用户真实头像、圆角输入区和绿色发送按钮；展开输入后继续支持回复目标、贴纸、键盘避让和 300 字限制。
10. 保留详情快照、下拉刷新、指定评论定位、加载/错误/空态、评论分页和暗色模式。
11. 补充社区详情 Figma smoke，并修正现有 E2E 与真实 DOM 脱节的稳定选择器。
12. 将社区列表、帖子详情、评论、首页、公开主页、个人资料页及生活服务卡片/详情中的真实用户头像迁移到统一 `UserAvatar` 公共组件，形态统一为圆形；缺少真实头像图片时，按用户 ID 稳定复用社区列表的蓝色、暖红和琥珀色回退配色，各场景原尺寸、点击区域、上传遮罩与在线状态保持不变。
13. 清理各页面头像宿主遗留的边框、阴影和业务旧配色，由 `UserAvatar` 独占头像形态与回退配色；在线点、上传审核遮罩等真实业务状态继续保留。

### 不包含

- 不修改后端 API、OpenAPI 或数据库。
- 不写死 Figma 示例作者、头像、正文、评论、点赞数或互动数字。
- 不伪造后端未返回的浏览量、作者地区或评论地区。
- 不渲染无真实接口支撑的“关注”按钮；后端增加关注关系与关注接口后再接入。
- 不移除现有图片、审核、编辑、删除、评论回复和权限能力以迁就静态设计稿。
- 不为社区复制或分叉评论组件；所有业务详情使用同一套评论结构、样式与行为。
- 不把帖子图片、商品图片、功能图标或纯业务标识误改为用户头像。

## 设计与真实数据映射

| Figma 元素 | 真实实现 |
| --- | --- |
| 作者头像、昵称 | `author_avatar_url`、`author_nickname`，沿用注销用户降级逻辑 |
| 时间 | `published_at`，为空时使用 `created_at` |
| 地区 | API 无字段，不展示 |
| 关注按钮 | API 无关注关系与动作，不展示 |
| 正文 | `content` 与现有 `StickerContent` |
| 帖子图片 | `images`，保留 `widthFix`、`aspectFill` 和 `Taro.previewImage` |
| 浏览量 | API 无字段，不展示 |
| 学校胶囊 | 产品真实身份“中国海洋大学” |
| 评论标题 | `comment_count` |
| 点赞按钮 | `liked`、`like_count` 与真实点赞/取消点赞接口 |
| 分享按钮 | `openType='share'` 与页面 `useCampusShare` |
| 举报按钮 | 现有 `openContentReport`，仅按真实权限展示 |
| 评论与回复 | `CommentView`、`reply_preview`、评论线程接口和真实评论点赞 |
| 底部头像 | `/api/v1/auth/me` 的当前用户头像，读取失败时使用现有降级样式 |

## 实现方案

1. 保留 `CustomNavbar showBack` 作为小程序导航边界，移除导航栏内重复的作者信息；Figma 节点作为导航栏下方内容区的复刻基线。
2. 在详情主体恢复独立作者行，使用统一的作者工具方法和全站 `UserAvatar` 公共组件。
3. 使用 Figma 节点导出的原始 SVG 作为更多、点赞、分享、举报、评论点赞和发送图标；动态头像与媒体继续来自 API。
4. 将帖子级动作收敛到评论标题同行的胶囊按钮；顶部更多菜单继续由服务端权限决定。
5. 继续复用现有 `DetailComments`，直接统一其评论标题、评论树、嵌套回复和底部输入栏结构；不增加 `community` 视觉变体，也不新建第二套评论组件。
6. 当前用户头像由公共评论组件通过现有 `/api/v1/auth/me` 共享资源读取，使所有详情页保持一致；请求失败时使用现有降级样式。
7. 保留 `#detail-comment-${id}` 和现有评论输入框 ID，同时补充 E2E 需要的稳定语义 ID，避免依赖纯视觉类名。
8. 暗色模式只调整颜色与表面，不改变详情结构和间距。
9. `UserAvatar` 统一承载头像框、圆形裁切、按用户 ID 计算的列表同款回退色、图片错误回退与回退文字；页面仅保留尺寸和交互布局，底层 `UserAvatarImage` 不再被业务页面直接调用。

## 需要创建的文件

- `src/components/user-avatar/index.tsx` - 全站真实用户头像公共容器
- `src/components/user-avatar/index.scss` - 统一圆形裁切与回退样式
- `src/assets/community/detail-more.svg` - Figma 更多图标
- `src/assets/community/detail-like.svg` - Figma 帖子点赞图标
- `src/assets/community/detail-share.svg` - Figma 分享图标
- `src/assets/community/detail-report.svg` - Figma 举报图标
- `src/assets/community/detail-comment-heart.svg` - Figma 评论点赞图标
- `src/assets/community/detail-send.svg` - Figma 发送图标
- `scripts/community-detail-figma-smoke.ts` - 详情结构与视觉语义回归

如已有资源字节与 Figma 导出完全一致，则复用现有文件，不重复创建。

## 需要修改的文件

- `src/packages/social/community/detail.tsx` - 重构帖子内容、作者信息、动作区和真实操作菜单
- `src/packages/social/community/detail.scss` - 按 Figma 重建社区详情视觉
- `src/features/life-services/components/detail-comments.tsx` - 统一公共评论结构与底部当前用户头像，不改共享业务逻辑
- `src/features/life-services/components/detail-comments.scss` - 按 Figma 统一全部详情页的评论和输入栏样式
- `src/styles/_dark-mode.scss` - 补齐新详情结构的暗色规则
- `src/styles/_typography.scss` - 对齐详情正文与评论字号
- `src/components/user-avatar-image/index.tsx` - 为公共头像补充统一回退文字类名
- `src/features/community/post-card.tsx`、`src/features/community/fresh-barrage.tsx` - 接入公共头像，话题页和公开主页社区动态自动继承
- `src/features/life-services/components/detail-author-navbar.tsx`、`errand-card.tsx`、`carpool-card.tsx`、`marketplace-card.tsx` - 接入公共头像
- `src/pages/index/index.tsx`、`src/pages/profile/index.tsx`、`src/pages/public-profile/index.tsx` - 接入公共头像并保留在线状态、上传遮罩和主页布局
- `scripts/community-avatar-smoke.ts` - 更新详情头像结构断言
- `scripts/comment-reply-smoke.ts` - 保留回复树、输入框和键盘行为断言
- `scripts/dark-mode-smoke.ts` - 断言真实详情 DOM 的暗色覆盖
- `scripts/e2e-community.sh` - 对齐详情编辑和评论流程的稳定选择器
- `package.json` - 接入新增 smoke 命令和 `ci:check`

## API 与依赖

### 现有接口

- `GET /api/v1/campus-circle/posts/:id` - 加载帖子详情
- `PUT/DELETE /api/v1/campus-circle/posts/:id/like` - 点赞与取消点赞
- `GET/POST /api/v1/comments` - 评论列表与创建评论
- `GET /api/v1/comments/:id/thread` - 加载完整回复线程
- `PUT/DELETE /api/v1/likes/:id?resource_type=comment` - 评论点赞
- `POST /api/v1/content-reports` - 帖子与评论举报
- `GET /api/v1/auth/me` - 当前用户头像

### 依赖与规范

- 不新增 npm 依赖，继续使用 Taro `4.1.11`、React、SCSS 和现有公共组件。
- Context7 已核对 Taro Image：`widthFix`、`aspectFill` 和 `lazyLoad` 均支持微信小程序；`Taro.previewImage` 接收 `current` 与完整 `urls`。
- 页面图片继续使用 `lazyLoad`；首屏头像不依赖懒加载才能显示。
- Figma 输出仅作为布局和资源参考，不直接复制 Tailwind 代码，也不安装 Tailwind。

## 验收标准

1. 导航栏下方的详情内容与 Figma `163:587` 的白色信息流结构、字号、留白、操作胶囊和评论层级一致。
2. 作者字重为 `400`，帖子点赞操作文字保持当前已确认的轻量层级。
3. 不出现虚假的关注状态、浏览量、地区、示例头像或示例评论。
4. 正文、贴纸、无图、单图、多图和图片预览均正常，审核中图片提示继续可见。
5. 帖子点赞、评论定位、评论/回复创建、评论点赞、分享、举报、编辑和删除均使用真实接口或权限。
6. 社区、跑腿、二手和找同行详情页继续使用同一个 `DetailComments`，不存在视觉分支或重复实现。
7. 评论输入栏不会被安全区或键盘遮挡，关闭输入框、回复目标和贴纸选择行为无回归。
8. 加载、错误、空评论、未审核不可评论和审核说明状态均可用。
9. 暗色模式下正文、评论、回复卡片、操作按钮和输入栏可读。
10. 相关 smoke、Lint、TypeScript、微信小程序构建与 `git diff --check` 通过。
11. 全站业务代码不再直接渲染 `UserAvatarImage`；所有真实用户头像均经 `UserAvatar` 展示并统一为圆形。无图片时同一用户在社区列表、话题页、公开主页帖子、详情作者、根评论、回复和输入栏中保持相同的列表同款回退配色。
12. 所有 `UserAvatar` 场景均不叠加页面级头像边框或阴影，也不覆盖公共回退配色；首页 Feed、首页顶部、弹幕、详情、评论、生活服务卡片、公开主页和个人资料页表现一致。

## 测试要求

### 自动验证

- `yarn test:community-detail-figma`
- `yarn test:community-detail-navigation`
- `yarn test:media-images`
- `yarn test:community-avatar`
- `yarn test:comment-reply`
- `yarn test:comment-like`
- `yarn test:detail-actions`
- `yarn test:share`
- `yarn test:dark-mode`
- `yarn test:typography`
- `yarn lint`
- `yarn typecheck`
- `yarn build:weapp`
- `git diff --check`

### 微信开发者工具验收

- 从社区列表打开真实帖子详情，检查首屏作者、正文、图片、校园标签和操作区。
- 点赞后确认状态与数量更新，刷新后保持服务端结果。
- 点击分享、举报和作者更多菜单，确认权限与目标资源正确。
- 创建根评论、回复评论、展开回复树并对根评论和回复点赞。
- 检查无图、单图、多图、待审核和审核未通过帖子。
- 键盘弹出、回复状态、贴纸面板和安全区下的固定输入栏均不遮挡内容。
- 暗色模式检查文字、图标、嵌套回复和输入栏对比度。

## 风险与约束

- Figma 展示的数据字段多于当前 API；前端不伪造缺失字段，因此关注、浏览量和地区不会出现，视觉宽度会做真实数据下的等价适配。
- `DetailComments` 被四类业务详情共用，本次统一样式会同时作用于四类详情，所有现有业务交互必须保持兼容。
- 公共头像迁移覆盖多个既有页面；公共组件只统一形态与回退，不修改各页面尺寸和业务状态，避免不必要的布局回归。
- Figma 节点没有小程序返回栏；实现保留最小导航能力，并将复刻范围限定在导航栏下方。
- 现有 E2E 的部分详情选择器已与真实 DOM 脱节，本次会统一为稳定语义 ID 后再用于验收。

---

**Implementation Notes:**

用户已确认评论组件必须复用且样式完全一致，不需要社区视觉变体；头像继续复用全站公共组件，统一为圆形，并按用户稳定复用社区列表的变化配色。实现不新增后端接口，不伪造关注、浏览量和地区，并使用真实学校产品身份标签。

`UserAvatar` 公共组件和全站真实用户头像迁移保持不变；公共头像现统一为圆形，并按用户 ID 稳定生成社区列表同款蓝色、暖红和琥珀色回退配色。社区详情模拟器已验证不同用户呈现不同颜色、同一用户在根评论与回复中保持同色，控制台无错误；头像、列表、详情、评论、暗色 smoke，Lint、TypeScript、微信小程序整包构建与 `git diff --check` 均通过。

补充审计了全部 15 个 `UserAvatar` 调用点，已移除首页顶部与 Feed、弹幕、社区详情、共享评论、生活服务列表/详情、公开主页和个人资料页宿主遗留的头像外框、阴影与旧业务配色。公共组件统一接管圆形、无边框、无阴影和稳定回退色；评论骨架、在线点及头像上传/审核遮罩继续保留。模拟器计算样式确认首页 Feed、社区详情作者和公开主页头像均无边框、无阴影，并保持同一用户的列表同款颜色。
