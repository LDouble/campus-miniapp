# 海大校园小程序：展示教务缓存时间与刷新提示

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## 概述

课程、成绩、考试和选课页面目前只能记录小程序本机缓存的写入时间。服务端返回 Fresh 或 Stale Redis 缓存时，小程序无法知道该份教务数据实际缓存于何时，也无法告诉用户 Fresh 何时到期、何时下拉才会触发下游刷新。

本任务同步后端 OpenAPI，在四个页面展示服务端权威缓存时间和刷新提示，并保留现有本机离线缓存。服务端缓存与本机兜底必须使用不同文案，避免误导用户。

## 用户故事

**作为** 查看个人教务数据的学生

**我希望** 页面明确告诉我数据的缓存时间和可刷新时机

**从而** 能决定是否主动下拉更新，并理解当前展示的是服务端缓存还是本机离线数据。

## 接口依赖

依赖 Campus Backend 同名功能 PR。四个教务成功响应保持 `data` 数组不变，并可选返回：

```json
{
  "cache": {
    "state": "fresh",
    "cached_at": "2026-08-16T14:27:00+08:00",
    "fresh_until": "2026-08-16T14:32:00+08:00"
  }
}
```

- `cache` 缺省表示本次数据直接来自教务下游，或后端仍处于兼容发布阶段。
- `state=fresh` 表示本次返回服务端 Fresh 缓存。
- `state=stale` 表示下游异常时返回服务端旧缓存。
- `cached_at` 是服务端缓存快照时间，不是本机存储时间。
- `fresh_until` 是下一次用户请求允许触发下游更新的时间，不是后台自动更新时间。

## 交互需求

### 服务端 Fresh

- 显示“数据缓存于 HH:mm，预计 HH:mm 后可更新”。
- Fresh 到期前仍允许用户下拉，但服务端可能继续返回 Fresh；界面不得承诺一定访问下游。
- 时间到达后只更新提示文案，不启动定时网络请求。

### 服务端 Stale

- 显示“数据缓存于 HH:mm，当前为兜底数据，下拉更新”。
- 保留已有下拉刷新手势，由用户主动发起请求。
- 不因 Stale 状态自动重试。

### 下游实时结果与兼容响应

- `cache` 缺省且请求成功时可以显示“刚刚更新”，也可以不显示缓存提示。
- 旧后端没有缓存字段时页面继续正常展示数据。
- 非法或缺失的 RFC 3339 时间不得显示 `Invalid Date`，应隐藏对应时间提示。

### 本机离线缓存

- 网络或服务端请求失败后继续使用现有本机缓存兜底。
- 文案明确为“教务暂不可用，展示本机保存于 HH:mm 的数据，下拉重试”。
- 本机 `updatedAt` 不得填入服务端 `cached_at`，服务端 Stale 也不得被标记为本机离线数据。

### 重试边界

- 课程、成绩、考试和选课请求均不得自动重试。
- HTTP 429、deadline、网络错误、Fresh 到期和 Stale 均只能由用户点击或下拉再次请求。
- 访问令牌失效后的认证刷新仍属于通用会话恢复，不视为教务业务自动重试。

## 技术方案

- 通过后端 `api/openapi.yaml` 执行 `yarn api:sync` 与 `yarn api:generate`，禁止手工修改 `src/api/generated/schema.ts`。
- 为 API Client 增加保留成功 envelope 元数据的兼容调用方法，现有 `apiRequest<T>` 行为保持不变。
- `src/api/academic.ts` 的四个查询返回 `{ records, cache }` 强类型结果；`periods` 和公开校历保持原接口。
- Repository 将服务端元数据传给页面，不给数组对象附加私有属性。
- 抽取纯函数格式化缓存文案，统一处理 Fresh、Stale、时间到期、非法时间和本机兜底。
- 四个页面复用同一个缓存提示组件，并在成功请求、本地初始缓存和失败兜底之间正确切换状态。
- 移除教务业务请求现有的随机延迟自动重试，仅保留用户主动刷新。

## 预计修改文件

- `src/api/client.ts`、`src/api/types.ts`：保留可选成功响应元数据。
- `src/api/academic.ts`：四类教务查询返回记录与缓存元数据，移除业务自动重试。
- `src/pages/academic/repository.ts`：传播强类型查询结果。
- `src/pages/academic/components/academic-load-state.tsx`：统一缓存提示与时间格式化。
- `src/pages/academic/schedule/index.tsx`、`grades/index.tsx`、`exams/index.tsx`、`selection/index.tsx`：接入元数据与下拉交互。
- `src/pages/academic/storage.ts`：如有需要，持久化最近一次服务端缓存元数据，并与本机写入时间分离。
- `src/pages/academic/index.scss`：Fresh、Stale 和本机兜底的提示样式。
- `src/api/generated/schema.ts`：只通过契约生成更新。

## 测试要求

- 验证 Fresh 文案包含缓存时间和 Fresh 截止时间。
- 验证 Fresh 截止时间到达后只更新提示，不发起请求。
- 验证 Stale 文案提示下拉刷新且不自动重试。
- 验证缺少 `cache`、非法时间和旧后端响应可兼容。
- 验证本机缓存文案与服务端 Stale 明确区分。
- 验证四个页面的成功、失败、下拉刷新和切换学期不会串用元数据。
- 运行 `yarn api:sync`、`yarn api:generate`、目标测试、`yarn typecheck`、`yarn lint` 和 `git diff --check`。

## 非目标

- 不实现后台定时刷新、轮询或自动重试。
- 不改变服务端缓存 TTL。
- 不展示服务端 Stale 最终过期时间。
- 不改变凭据绑定、学期选择、成绩模拟和课程编辑功能。

---

**实施说明：** 本 PRD 获得批准后再开始修改运行代码。前后端 PR 使用相同分支标识并互相链接。
