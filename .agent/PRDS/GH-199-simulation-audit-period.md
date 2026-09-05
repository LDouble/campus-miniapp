# Miniapp：模拟选课长按跳转蹭课携带学期

**Priority:** High
**Status:** In Progress
**Type:** Bug
**Created:** 2026-09-06
**Last Updated:** 2026-09-06

## Overview

修复模拟选课课表长按空白时段进入蹭课检索时丢失学期的问题。跳转应保留用户当前正在查看的模拟课表学期，并继续携带星期和开始节次，让蹭课检索直接定位到同一学期和时段。

## User Story

**As a** 使用模拟选课规划课表的同学
**I want** 长按某个时段进入蹭课检索时保持当前学期和时段
**So that** 我可以直接查找同一学期、同一上课时段的可旁听课程。

## Context

课表长按入口已经会将 `weekday` 和 `section` 放入蹭课页路由，但当前没有传递 `periodId`。蹭课页加载校历后总是选择当前学期，导致从模拟选课的其他学期跳转时查询条件被替换。

## Implementation Overview

- 模拟课表长按跳转时，在现有 URL 查询参数中增加编码后的 `periodId`。
- 蹭课页解析路由中的学期参数；校历返回后仅当该参数存在且属于当前学历的合法学期列表时使用它。
- 参数缺失、非法或不属于当前校历时，继续沿用现有当前学期/首个学期回退逻辑。
- 保持 `weekday`、`section` 的筛选行为和正常课表入口兼容，不新增后端接口。

## Features / Requirements

1. **跳转参数完整性**
   - 从模拟选课课表长按空白时段进入“选课”时，携带 `periodId`、`weekday`、`section`。
   - 参数值使用 URL 编码，避免学期 ID 或其他查询值破坏路由。

2. **蹭课页学期初始化**
   - 校历加载成功后优先使用合法的路由学期。
   - 路由学期不合法时使用当前学期，校历没有当前标记时使用首个学期。
   - 切换学历后重新读取校历，不能继续使用不属于新学历的旧学期参数。

3. **兼容性**
   - 不改变后端筛选契约、个人蹭课状态查询和模拟选课本地存储。
   - 不影响从正常课表进入蹭课时的现有星期、节次参数。

4. **全部服务入口**
   - 在全部服务的教务服务分组中增加“模拟选课”。
   - 入口复用课表模块配置，打开 `/pages/academic/schedule/index?mode=simulation`。

5. **模拟选课引导**
   - 模拟选课页每次显示时都展示“长按课表空白时段，继续选课”的动画引导。
   - 引导展示 3 秒后自动隐藏，用户手动关闭时立即隐藏。
   - 不改变正常课表蹭课引导现有的按天展示策略。

## Files to Create

- `.agent/TASKS/GH-199-simulation-audit-period.md` - 记录任务范围和验收标准。
- `.agent/PRDS/GH-199-simulation-audit-period.md` - 记录实现方案和验证要求。

## Files to Modify

- `src/pages/academic/schedule/index.tsx` - 长按时段跳转时增加 `periodId`。
- `src/pages/academic/utils.ts` - 提供模拟选课默认下一学期的解析逻辑。
- `src/pages/academic/course-catalog/index.tsx` - 解析并校验路由学期，初始化蹭课页学期。
- `src/pages/services/index.tsx` - 在全部服务中增加模拟选课入口。
- `scripts/academic-schedule-smoke.ts` - 验证模拟选课默认下一学期和引导时序契约。
- `scripts/course-audit-smoke.ts` - 增加路由参数、服务入口和学期初始化契约验证。

## API Endpoints

不新增或修改接口。继续使用现有校历、课程目录和个人蹭课接口。

## Database Changes

无数据库变更。

## Libraries/Dependencies

不新增依赖。继续使用现有 Taro 路由和 React 状态管理。

## Technical Implementation

### Architecture Approach

将路由学期视为蹭课页的初始化偏好，而不是强制条件：在校历请求返回后校验 `periodId` 是否属于当前学历的学期列表，合法时使用它，否则调用现有默认回退。用户后续手动切换学期仍直接更新页面状态。

### Technical Considerations

- 使用 `encodeURIComponent` 生成跳转 URL，使用 Taro 路由参数读取值。
- 学期校验必须发生在校历加载完成后，避免用未加载的空列表误判参数。
- 处理参数缺失、空字符串、非法学期和学历切换，确保不会向课程目录接口发送错误学期。
- 不把路由学期写入全局偏好或服务端，避免改变用户其他页面的默认学期。

### Design/UX Considerations

- 不新增视觉控件；用户从当前时段进入蹭课检索后，页面保持原有检索界面。
- 继续展示原有星期、节次筛选结果，用户可以手动清除或切换学期。

## Testing Requirements

### Unit Tests

- 生成跳转 URL 时包含正确编码的 `periodId`、`weekday` 和 `section`。
- 合法路由学期优先于默认当前学期。
- 缺少、非法或不属于校历的路由学期安全回退。

### Integration Tests

- 模拟课表长按时段进入蹭课页后，课程目录请求使用传入学期。
- 蹭课页切换学历后，不使用原学历的路由学期。

### Manual Testing Checklist

- 在模拟选课页切换到非当前学期，长按空白时段选择“选课”，确认蹭课页选中同一学期。
- 确认星期和节次仍带入筛选条件。
- 直接打开不带 `periodId` 的蹭课页，确认仍默认当前学期。
- 验证正常课表入口和学历切换不受影响。
- 在全部服务页点击“模拟选课”，确认进入模拟课表模式。
- 重新进入模拟选课页，确认长按引导每次出现并在 3 秒后隐藏。

---

**Implementation Notes:**

该任务是模拟选课和蹭课检索之间的前端路由修复，不需要后端协作或数据迁移。当前分支同时承载模拟选课默认下一学期的前置修复，确保开发者工具验证时两个行为一致。
