# OUSea 小程序：收藏功能

**Priority:** High
**Status:** Implemented
**Type:** Feature
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## 一、确认结论

本需求改为“后端协议先行、前端随后接入”。在产品和协议方案获得确认前，不修改后端收藏实现，不新增小程序页面、组件或请求代码。

用户已确认以下核心结论，并据此完成后端协议与小程序接入：

1. `GET /api/v1/favorites` 在现有收藏引用之外返回安全的资源摘要 `preview`，收藏列表直接渲染摘要，不再为列表中的每条记录调用四类详情接口。
2. 摘要采用按 `resource_type` 区分的联合结构，不复用完整详情 DTO；详情中的联系方式、可执行操作和用户关系字段不进入摘要。
3. 已删除、撤回或暂时不可见的资源保留收藏记录，但列表返回 `preview: null` 和不可用状态，客户端显示“内容已不可用”，用户仍可取消收藏。
4. 后端使用独立工作树和新分支开发，不修改正在并行开发的后端工作树；协议完成后再接入小程序。

## 二、背景与现状

当前小程序生成类型对应的收藏列表只有：

```text
resource_id、resource_type、favorited_at
```

现有后端收藏实现也明确返回轻量引用，并且后端测试将该行为约束为 lightweight page。若客户端继续调用校园圈、二手、跑腿、找同行详情接口补齐卡片，会形成收藏列表的 N+1 请求；刷新、分页和重复渲染还会引入重复请求和页面闪烁。这不满足“不能重复请求”的要求。

当前后端实现仅作为协议基线参考：

- 工作树：`/Users/liangluo/.codex/worktrees/0e50/campus_backend`
- 分支：`agent/add-favorites-backend`
- 参考源协议：`schemas/favorite.yaml`
- 参考生成协议：`api/modules/favorite.yaml`、`api/openapi.yaml`

上述工作树不属于本次小程序分支，且可能承载其他并行开发；本任务不直接修改、切换或覆盖它。后端协议改动需从最新 `origin/master` 创建独立的 `agent/...` 分支，并按后端仓库的生成、迁移和测试规范提交。

## 三、目标

- 在个人中心提供“我的收藏”入口。
- 在校园圈动态、二手、跑腿、找同行详情页提供收藏/取消收藏入口。
- 收藏列表一次请求拿到可渲染卡片所需的摘要，不对列表项逐条请求详情接口。
- 收藏列表支持分页、下拉刷新、空状态、错误重试和失效资源降级。
- 打开详情时继续按现有详情页流程获取最新完整详情；详情请求只在用户主动进入该条内容时发生。

## 四、后端协议方案（已确认并实施）

### 4.1 保持不变的接口

以下接口路径、资源类型和状态语义保持现有协议：

- `GET /api/v1/favorites/{id}?resource_type=...`：查询当前用户的收藏状态。
- `PUT /api/v1/favorites/{id}?resource_type=...`：收藏资源，幂等返回已收藏状态。
- `DELETE /api/v1/favorites/{id}?resource_type=...`：取消收藏，幂等返回未收藏状态。
- 资源类型：`campus_circle_post`、`marketplace`、`errand`、`carpool`。

### 4.2 收藏列表响应调整

保留 `GET /api/v1/favorites` 的分页、资源类型过滤和收藏时间排序，在 `FavoriteItem` 增加摘要字段：

```yaml
FavoriteItem:
  required:
    - resource_type
    - resource_id
    - favorited_at
    - availability
  properties:
    resource_type: FavoriteResourceType
    resource_id: uint64
    favorited_at: date-time
    availability:
      type: string
      enum: [available, unavailable]
    preview:
      nullable: true
      $ref: '#/components/schemas/FavoriteResourcePreview'
```

`FavoriteResourcePreview` 使用 `resource_type` 作为 discriminator，建议拆成以下四种公开摘要：

#### `campus_circle_post`

- `resource_type`、`resource_id`
- `title`（可为空，优先使用主题/分区名称）
- `summary`（动态正文摘要）
- `cover_url` 或公开图片 URL 列表
- `author_id`、`author_nickname`、`author_avatar_url`
- `published_at`、`created_at`、`status`

#### `marketplace`

- `resource_type`、`resource_id`
- `title`（没有独立标题时允许为空）
- `summary`（商品描述摘要）
- `cover_url` 或公开图片 URL 列表
- `intent`、`price_cents`、`currency`、`category`
- `campus`、`author_id`、`author_nickname`、`author_avatar_url`
- `created_at`、`status`

#### `errand`

- `resource_type`、`resource_id`
- `title`（可为空）
- `summary`（任务描述摘要）
- `pickup_location`、`dropoff_location`
- `reward_cents`、`currency`、`deadline`
- `campus`、`author_id`、`author_nickname`、`author_avatar_url`
- `created_at`、`status`、`review_status`

#### `carpool`

- `resource_type`、`resource_id`
- `title`（可为空）
- `summary`（行程描述摘要）
- `origin`、`destination`、`departure_at`
- `total_seats`、`occupied_seats`
- `campus`、`author_id`、`author_nickname`、`author_avatar_url`
- `created_at`、`status`、`review_status`

摘要字段应以当前四类详情和列表卡片已有字段为准，字段名最终以 `schemas/favorite.yaml` 为单一事实来源。`title` 允许为空是因为动态、跑腿和找同行现有资源未必有独立标题；客户端使用 `summary`、路线、价格或时间等类型字段组成卡片主信息，不伪造标题。

### 4.3 安全边界

摘要不是完整详情 DTO，只返回列表卡片所需的公开数据。以下字段明确禁止进入 `preview`：

- `contact`、`contact_type` 以及任何联系方式明文或密文。
- `available_actions`、`viewer_relation` 等依赖当前用户关系的操作字段。
- 管理端审核原因、审核人、运营排序和其他内部字段。
- 评论、点赞明细等与收藏卡片无关且会放大响应的字段。

### 4.4 列表查询与失效策略

- 排序保持 `favorited_at DESC, favorite_id DESC`，分页参数和上限保持现有协议。
- 后端先查询当前用户收藏记录，再按资源类型批量加载摘要；禁止对每条收藏记录逐条调用详情查询。
- 批量加载应使用各模块的轻量公开查询/批量查询能力，避免把完整详情、联系方式和用户关系逻辑带入收藏模块。
- 资源不可见时不删除收藏关系；对应列表项返回 `availability: unavailable`，`preview` 为空（当前 JSON 实现省略该可选字段），`total` 仍反映用户收藏关系总数。
- 列表响应继续使用 `Cache-Control: no-store, private`，不得进入公共缓存。

本期选择“列表内嵌安全摘要”，不新增客户端批量详情接口。这样收藏页首屏只需一次收藏列表请求，不产生四类详情接口的 N+1 请求；用户点击某条可用收藏进入详情时，才允许详情页按现有流程获取最新数据。

## 五、产品范围

- 个人中心“我的服务”增加“收藏”入口，进入 `/pages/favorites/index`。
- 四类详情页提供统一书签入口，支持未收藏、已收藏、加载中和提交中状态。
- “我的收藏”按收藏时间展示摘要卡片，支持首次加载、下拉刷新、触底分页、空状态、错误重试和不可用资源降级。
- 可用摘要卡片点击后打开对应已有详情页；不可用卡片支持取消收藏，不阻塞其他条目。
- 遵循现有登录、认证刷新、深色模式、安全区、减少动效和无障碍约定。

## 六、非目标

- 不复用完整四类详情 DTO 作为收藏列表 DTO。
- 不为收藏列表增加逐条详情请求、客户端 N+1 补齐逻辑或仅依赖内存缓存掩盖协议问题。
- 不新增收藏夹、标签、排序筛选、批量取消、浏览历史或公开收藏数。
- 不修改四类详情接口的既有公开协议；进入详情后按现有流程获取最新完整详情，不把列表摘要作为详情快照传递。
- 不在本次 PRD 确认前修改后端或小程序代码。

## 七、实施拆分

### 阶段 A：后端协议

1. 在后端 `schemas/favorite.yaml` 增加摘要联合结构及 `FavoriteItem.preview`、`availability`。
2. 实现四类资源按类型批量加载公开摘要，明确不可见资源的返回策略。
3. 重新生成模块 OpenAPI、全局 OpenAPI、类型、权限和相关适配代码，禁止手工编辑生成文件。
4. 更新收藏 Handler、应用层和目标解析/批量查询边界，确保私有响应和联系方式隔离。
5. 增加协议、权限、分页、排序、批量查询、防 N+1、字段泄漏和不可用资源测试。

### 阶段 B：小程序接入

后端协议合并并可联调后，重新生成小程序 API 类型，再实现：

- `src/api/favorites.ts`：收藏列表、状态、添加和取消接口。
- `src/features/favorites/`：资源类型映射、摘要卡片、收藏按钮和列表状态逻辑。
- `src/pages/favorites/index.tsx` 及页面样式/配置：分页、刷新、错误和失效状态。
- `src/pages/profile/index.tsx`：收藏入口。
- 四类详情页：接入收藏按钮并复用已有书签 SVG 资源。
- 路由、smoke 测试和设计系统断言。

小程序收藏列表只消费后端 `preview`，不再调用四类详情接口补齐卡片。详情页只在用户主动打开该条内容后按既有流程发起详情请求。

## 八、测试要求

### 后端

- OpenAPI 生成无漂移，`FavoriteItem` 的联合摘要结构可被客户端生成类型正确解析。
- 四类资源均能返回对应摘要，摘要中的 `resource_type` 与外层收藏项一致。
- 列表使用批量查询，不产生按收藏条数线性增长的详情 SQL/服务调用。
- 响应不包含联系方式、密文、审核内部字段或用户关系操作字段。
- 分页、收藏时间排序、资源类型过滤、空列表、不可用资源和私有缓存头正确。
- 现有收藏状态、添加、取消接口行为不回归。

### 小程序（阶段 B）

- 校验收藏入口、四类资源映射、列表摘要渲染和详情跳转路由。
- 校验分页去重、刷新/触底请求版本保护、空/错误/不可用状态。
- 校验列表加载过程中不会调用四类详情接口；详情接口只在用户主动打开内容时调用。
- 执行项目约定的 `yarn lint`、`yarn typecheck`、设计令牌/排版/深色模式测试和 `yarn build:weapp`。

## 九、确认记录

用户已确认：

- 同意在收藏列表中增加安全的 `preview` 摘要，客户端不逐条请求详情。
- 同意 `preview` 按四类资源提供公共联合结构，允许 `title` 为空。
- 同意不可用资源保留收藏记录并允许取消收藏。
- 同意后端使用独立工作树/新分支，现有 `/Users/liangluo/.codex/worktrees/0e50/campus_backend` 仅作参考，不直接修改。

---

**Implementation Notes：** 用户确认后，从最新 `origin/master` 创建了前端 `agent/favorite-feature` 与后端 `agent/favorite-preview-protocol` 两个分支。后端列表按资源类型批量生成安全摘要，小程序列表直接渲染 `preview`，不调用四类详情接口补齐卡片。不可用资源保留关系并支持取消收藏。
