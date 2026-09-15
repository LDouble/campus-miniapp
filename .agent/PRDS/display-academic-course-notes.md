# OUSea小程序：展示课表全局提示与课程备注

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## 概述

教务课程接口已在成功响应中增加课表级 `schedule_note`，用于说明未安排时间或地点等无法直接落入网格的信息；每门课程也增加了课程级 `note`。小程序需要完整保留这两类信息，并在正确的浏览场景展示。

## 用户故事

**作为** 查看课程表的学生

**我希望** 在课表页看到教务系统关于课程安排的整体提示，并在点开课程后看到该课程的备注

**从而** 能理解未排入网格的课程情况，并获得课程相关的补充说明。

## 接口契约

`POST /api/v1/academic/courses` 的成功响应保持 `data` 数组，同时增加：

```json
{
  "data": [
    {
      "id": "course-1",
      "note": "课程备注"
    }
  ],
  "schedule_note": "部分课程尚未安排上课时间或地点。"
}
```

- `schedule_note` 是当前学期课表的全局提示，可能为空字符串。
- `data[].note` 是单门课程的备注，接口返回字符串；空字符串不渲染占位区域。
- 旧版本本地缓存没有这些字段时仍须正常读取。

## 交互需求

### 课表全局提示

- 当 `schedule_note` 非空时，在课表内容顶部、缓存状态提示之后展示信息条。
- 提示文字保持紧凑单行，超出可视宽度时使用双文本无缝自动跑马灯展示，短文案保持静止，不改变课程网格的交互方式。
- `schedule_note` 为空时不渲染空信息条。
- 按学期保存并随课程缓存读取；网络失败使用本地缓存时仍展示该学期最近一次提示。

### 课程备注

- 点击周视图或日视图中的课程打开现有课程详情浮层。
- 在地点、教师、周次、来源等课程信息之后展示“课程备注”区块，再展示既有课程服务入口。
- 课程没有备注时不渲染标题或空白容器。
- 自定义课程没有接口备注，继续保持现有编辑、删除和服务入口。

### 课程参考与操作入口视觉补充

- 课程没有有效 `pass_rate` 时不渲染课程参考卡片，不展示空状态占位。
- 课程详情浮层使用统一的 Ousea 中性承载面，课程色只保留在左侧强调轨。
- 课程服务入口合并为紧凑的主次操作卡，浅色和暗色模式均保持清晰对比。
- 成绩、考试、选课结果共用的学期入口使用浅蓝信息层级；入口去掉重复的前置 label，采用单行布局直接展示完整学期名称，空间不足时仅做省略。
- 选择面板保留触控高度并收紧圆角、留白和选项间距。

## 技术方案

- 同步前端生成 schema：补充 `AcademicCourse.note` 与 `AcademicCourseListResponseBody.schedule_note`。
- 扩展成功响应 envelope 的兼容元数据读取，仅由学术课程查询转换为 `scheduleNote`，不改变其他 `apiRequest` 调用。
- 在 `AcademicQueryResult` 和 academic repository 中透传 `scheduleNote`，并在课程映射中透传 `note`。
- 将全局备注按学期加入 `AcademicScheduleCache`，兼容旧缓存结构。
- 课表页按当前学期切换和请求结果更新提示；课程浮层复用现有 Ousea 信息卡结构。
- 新样式使用 Ousea 原始 token、紧凑固定信息区高度、超长提示自动跑马灯、暗色语义覆盖和减少动态效果支持。

## 预计修改文件

- `src/api/client.ts`、`src/api/types.ts`、`src/api/academic.ts`
- `src/api/generated/schema.ts`
- `src/pages/academic/types.ts`、`src/pages/academic/repository.ts`
- `src/pages/academic/storage.ts`、`src/pages/academic/schedule/index.tsx`
- `src/pages/academic/index.scss`、`src/styles/_dark-mode.scss`
- `src/features/academic-statistics/course-pass-rate-preview/index.tsx`、`src/features/academic-statistics/course-pass-rate-preview/index.scss`
- `scripts/academic-schedule-smoke.ts` 或相关课程表 smoke 测试
- `scripts/academic-grades-ui-smoke.ts`、`scripts/academic-statistics-smoke.ts`

## 测试要求

- 课程 schema 和 API envelope 类型包含 `note`、`schedule_note`。
- repository 正确映射课程备注并透传全局提示。
- 旧缓存无备注字段时仍可读取；新缓存按学期保存和恢复提示。
- 空备注不渲染；非空全局提示和课程备注均展示。
- 全局提示、课程浮层在浅色和暗色模式下均有足够对比度，长文本可换行。
- 运行 `yarn lint`、`yarn typecheck`、`yarn test:design-tokens`、`yarn test:typography`、`yarn test:dark-mode`、相关 smoke 测试和 `yarn build:weapp`。

## 非目标

- 不修改后端接口或教务数据解析逻辑。
- 不在课程网格卡片内增加大段备注，避免破坏周视图的密度。
- 不为自定义课程新增备注编辑字段。
