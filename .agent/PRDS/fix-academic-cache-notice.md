# 小程序: 修复教务缓存提示契约

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## Overview

教务接口以可选的顶层 `cache` 对象描述本次响应是否实际来自 Redis 结果缓存。当前小程序的服务端缓存文案基本建立在该字段上，但对 Fresh 截止时间的措辞可能暗示自动更新；本机快照时间也只校验为有限数字，异常值会显示为 `01/01 08:00`。本修复将严格遵循接口契约，区分服务端结果缓存、本机快照和直接成功结果。

## User Story

**As a** 查询教务信息的学生  
**I want** 页面准确说明当前数据是否来自缓存以及何时允许再次刷新  
**So that** 我不会把直接返回的数据误认为本机旧数据，也不会误解页面会自动刷新

## Description

服务端响应契约如下：

- `cache` 只在本次实际返回 Redis 结果缓存时出现。
- 本次直接从下游成功取得数据时，`cache` 缺省。
- `cache.state` 为 `fresh` 或 `stale`；只有故障降级返回旧缓存时为 `stale`。
- `cached_at` 是服务端最近一次成功从下游取得并形成缓存快照的时间，不是小程序本机写入时间。
- `fresh_until` 是 Fresh 窗口截止时间；超过后仅表示下一次用户请求允许触发刷新，不代表自动请求。
- 滚动发布、旧 Provider 响应或旧缓存无法恢复写入时间时，`cache` 允许缺省，客户端必须兼容。

因此，成功响应中 `cache` 缺省时以响应成功的当前时间作为更新时间，不展示服务端或本机缓存文案；只有请求失败且页面回退到小程序本地快照时，才显示本机缓存时间。

## Context

现有 `resolveAcademicCacheNotice` 能处理 `fresh/stale` 元数据，但 Fresh 文案使用“预计……后可更新”，容易被理解为自动更新。它还会把任何有限的 `localUpdatedAt` 交给日期格式化，导致历史数据中的哨兵值或异常值变成 `01/01 08:00`。

课表、成绩、考试和选课页都复用同一缓存提示组件，因此应在统一决策函数与本地缓存校验层修复，而不是由各页面单独拼文案。

## Implementation Overview

1. 保持 API envelope 与教务查询结果的现有 `cache?: AcademicCacheMetadata | null` 契约，不新增 `source` 字段。
2. 统一按 `cache` 是否存在判断本次响应是否来自服务端结果缓存。
3. Fresh 文案明确表达“到期后可再次下拉刷新”，不暗示页面自动更新。
4. `cache` 缺省且请求成功后，将当前时间记录为本次更新时间并展示“更新时间：MM/DD HH:mm”。
5. 请求失败且页面实际回退到有效本机快照时，展示本机缓存时间与故障兜底提示。
6. 在提示格式化边界校验本机时间，兼容合理的秒级 Unix 时间并拒绝哨兵值、过早值和明显未来值。

## Features / Requirements

1. **严格遵循服务端 cache 元数据**
   - `cache.state=fresh` 展示缓存形成时间及允许再次下拉刷新的时间。
   - `cache.state=stale` 展示故障降级旧缓存提示。
   - 成功响应缺少 `cache` 时不展示服务端缓存文案，展示本次响应成功时的当前时间。
   - 不依据 `cache` 缺省推断一定是直连，以兼容滚动发布和旧 Provider；UI 只表达“本次更新时间”，不声明数据来源。

2. **区分服务端缓存与本机快照**
   - `cached_at` 只用于服务端缓存文案。
   - `localUpdatedAt` 只用于小程序正在展示的本地快照。
   - 请求成功后，无论 `cache` 是否存在，都停止展示“本机保存于……，正在更新”。
   - `cache` 缺省时，成功时刻既用于页面“更新时间”，也作为刚写入本机快照的时间。
   - 请求失败且仍有有效本机快照时，才展示本机兜底与重试提示。

3. **时间防御**
   - 合理的秒级 Unix 时间可规范化为毫秒。
   - `0`、`1`、非有限数字、明显早于产品数据生命周期或明显晚于当前时间的值不渲染。
   - 页面不再出现 `01/01 08:00` 等伪时间。

4. **覆盖全部教务查询页**
   - 课表、成绩、考试、选课页面行为一致。

## Files to Create

- 无业务文件新增。

## Files to Modify

- `src/pages/academic/components/academic-cache-notice.ts` - 按接口契约统一服务端缓存、当前更新时间与本机兜底文案，并增加时间校验。
- `src/pages/academic/components/academic-load-state.tsx` - 显式接收当前成功更新时间与本机兜底状态。
- `src/pages/academic/schedule/index.tsx` - 校正课表加载、成功和失败时的提示状态。
- `src/pages/academic/grades/index.tsx` - 校正成绩加载、成功和失败时的提示状态。
- `src/pages/academic/exams/index.tsx` - 校正考试加载、成功和失败时的提示状态。
- `src/pages/academic/selection/index.tsx` - 校正选课加载、成功和失败时的提示状态。
- `scripts/academic-cache-metadata-smoke.ts` - 增加缺省 cache 的当前更新时间、Fresh 截止语义和异常时间回归测试。

## API Endpoints

不新增、不修改后端接口。兼容以下现有查询：

- `POST /api/v1/academic/courses`
- `POST /api/v1/academic/grades`
- `POST /api/v1/academic/exams`
- `POST /api/v1/academic/course-selections`

## Libraries/Dependencies

- **Taro/React** - 复用现有页面状态和组件渲染机制，不新增依赖。
- 当前环境未提供 Context7 工具；实现以用户提供的接口契约、仓库生成类型及本机 Taro 文档为依据。

## Technical Implementation

### Architecture Approach

- API 层继续无损保留现有 `cache` 元数据，不引入不存在于契约中的 `source`。
- `resolveAcademicCacheNotice` 扩展为教务数据时效文案的唯一决策入口。
- 页面以 `usingCache` 表示当前渲染数据是否来自本机快照，以 `serverCache` 表示本次成功响应是否明确来自 Redis，两者不得混用。
- 本机时间在展示边界统一校验，旧数据无需迁移也不会产生错误文案。

### Technical Considerations

- `fresh_until` 到期只改变文案为“现可下拉刷新”，不得触发定时网络请求。
- `cache` 缺省不能被解释为本机缓存；只展示客户端确认的响应成功时间，不显示猜测性来源文案。
- 秒/毫秒时间兼容只用于读取和显示，不能把错误值回写为新鲜时间。
- 服务端 ISO 8601 时间继续使用项目统一的校园时区格式化工具。

### Design/UX Considerations

- Fresh：`数据缓存于 MM/DD HH:mm，MM/DD HH:mm 后可下拉刷新`。
- Fresh 已到期：`数据缓存于 MM/DD HH:mm，现可下拉刷新`。
- Stale：保留明确的故障降级/兜底语义。
- 成功且 `cache` 缺省：展示 `更新时间：MM/DD HH:mm`，时间取本次请求成功时刻。
- 有效本机快照加载中：只展示加载状态，不把尚未完成的请求描述成新数据。
- 有效本机快照请求失败：显示本机兜底与“下拉重试”。

## Testing Requirements

### Unit Tests

- Fresh 服务端缓存显示 `cached_at` 和“到期后可下拉刷新”。
- Fresh 到期后只更新提示，不自动请求接口。
- Stale 服务端缓存显示故障降级提示。
- 成功响应缺少 `cache` 时显示当前更新时间，不显示服务端或本机缓存来源。
- 有效本机快照在请求失败时显示本机缓存时间与兜底文案。
- 合理秒级时间戳正常格式化。
- `0`、`1`、NaN、无穷值、过早值、明显未来值不产生本机提示。

### Integration Tests

- 四个教务页面收到成功结果后清除本机“正在更新”提示，并记录统一的成功时刻。
- `cache` 缺省时以当前更新时间兼容新直连、滚动发布和旧 Provider 响应。
- `fresh/stale` 元数据仍可从 API 层传递到统一提示组件。

### E2E Tests

- 有本机快照进入页面，成功且 `cache` 缺省后显示本次请求的当前更新时间。
- 有本机快照进入页面，请求失败后显示本机兜底与下拉重试提示。
- 服务端返回 Fresh/Stale 缓存结果时分别展示对应文案。

### Manual Testing Checklist

- 课表、成绩、考试、选课四页表现一致。
- 直连或兼容响应显示当前更新时间，不显示缓存来源。
- Fresh 截止文案不暗示自动更新。
- Stale 文案准确表达故障降级。
- 本机快照失败兜底提示正确。
- 页面不再出现 `01/01 08:00`。
- 下拉刷新与首次进入页面均无错误提示闪烁。

---

**Implementation Notes:**

用户提供的接口说明是本修复的来源判断依据：仅 `cache` 存在时才能确认本次返回 Redis 结果缓存；`cache` 缺省时前端记录并展示本次响应成功的当前时间，不额外猜测来源；服务失败并回退本机快照时，展示该快照真实的本地写入时间。
