# OUSea小程序：首页常用服务对齐实际启用模块

**Priority:** High
**Status:** Complete
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

首页“常用服务”目前由固定十项白名单驱动，其中包含未接入真实能力的静态校园卡演示页，同时遗漏多个运行时已启用模块；过滤逻辑还会展示维护态模块。改造后，首页使用现有服务入口注册表与服务端运行时配置，只展示当前校区真正处于 `enabled` 状态的服务。

## User Story

**As a** 使用OUSea首页的学生
**I want** 常用服务只展示当前真正开放的能力
**So that** 点击入口时不会进入演示页、维护页或与实际配置不一致的功能

## Current Findings

- 首页固定白名单为课表、成绩、考试、选课结果、资料、校历、跑腿、找同行、空教室、校园卡。
- `campus-card` 没有对应 `MiniappModuleKey`，当前页面数据来自本地静态演示文件。
- review/bootstrap 当前启用课表、成绩、考试、选课、通过率、校历、社区、二手、跑腿、找同行、资料、空教室与校车；社团隐藏。
- 首页当前以 `state !== 'hidden'` 判断可见，导致 `maintenance` 也进入常用服务。
- 首页最终样式强制所有图标使用同一种蓝色，违反 Master“常用服务可以采用不同业务色”的规则。

## Implementation Overview

1. 保留 `quickServices` 作为入口、图标、文案和路由的唯一注册表。
2. 删除固定 `homeServiceKeys` 十项白名单，首页从注册表筛选具有真实运行时模块映射且解析状态严格为 `enabled` 的服务。
3. 继续遵循 qualification 版本迁移排除规则，不渲染该版本不可用页面。
4. `campus-card` 在拥有真实模块契约前不进入首页常用服务；不删除其现有演示页，避免扩大本任务范围。
5. 宫格保持五列紧凑布局，但允许依据启用数量自然增加或减少行数，不为凑满十项插入未启用服务。
6. 图标与底板统一使用 Ousea 海洋蓝色系；图标视觉尺寸保持 `40–48rpx`。
7. “全部服务”页面本轮不改变维护态说明与导航策略，仅校准首页常用服务。

## Files to Modify

- `src/pages/index/index.tsx` - 改为按运行时模块状态生成首页常用服务。
- `src/pages/index/index.scss` - 恢复 Master 指定的多业务色紧凑宫格。
- `scripts/home-guest-smoke.ts` - 移除固定十项断言，新增启用态、动态数量、无静态校园卡及业务色断言。

## Libraries/Dependencies

- 使用项目现有 Taro 4.1.11 与 `runtime-config`，不新增依赖或接口。

## Testing Requirements

- `enabled` 模块出现在首页；`maintenance` 与 `hidden` 模块不出现。
- 没有模块映射的静态校园卡不进入首页常用服务。
- qualification 版本继续排除已迁移模块。
- 启用项不足或超过十项时宫格自然换行，无空占位、无固定数量截断。
- 不同服务保留可识别的图标色和浅色底板，暗色模式仍使用语义表面。
- 通过首页 smoke、runtime config smoke、设计 Token、暗色模式、typecheck 与 lint；按约定不重复执行 watch build。

---

**Implementation Notes:** 本任务以服务端运行时配置作为“实际启用”的唯一事实源，页面只负责注册入口呈现，不再维护第二套固定启用清单。

## Result

- 首页已删除固定十项白名单，仅展示存在模块映射且当前校区运行时状态严格为 `enabled` 的服务。
- 未接入真实模块协议的校园卡演示入口、`maintenance` 与 `hidden` 服务不再出现在首页。
- 五列宫格会随启用数量自然换行，图标与底板统一使用 Ousea 海洋蓝色系。
- 已通过首页 smoke、typecheck、lint、设计 Token、暗色模式与字体排版检查；按开发约定未重复执行 watch build。
