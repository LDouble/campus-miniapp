# Miniapp: 评价卡片教师归属标识

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-09-08
**Last Updated:** 2026-09-08

## Overview

选课情报接口的单条评价已包含可选 `teacher_name`，但小程序评价卡片没有渲染该字段。用户在“全部教师”范围查看时无法判断评价归属；原始记录确实缺少教师时，页面也没有说明其属于课程通用评价。

## User Story

**As a** 查看课程评价的学生
**I want** 清楚看到每条评价对应的教师或未注明教师状态
**So that** 不会把课程通用经验错误归因给某位老师

## Implementation Overview

- 评价卡片元信息增加教师归属标签。
- `teacher_name` 有值时展示教师姓名。
- `teacher_name` 为空时展示“未注明教师”，并通过辅助文案说明这是课程通用评价，禁止前端猜测教师。
- 教师筛选状态下仍展示卡片自身归属，便于识别历史别名或异常数据。

## Files to Modify

- `src/features/course-intelligence/reader.tsx` - 渲染教师归属。
- `src/features/course-intelligence/reader.scss` - 教师归属标签样式。
- `scripts/academic-statistics-smoke.ts` - 增加归属展示回归断言。

## API and Database Changes

- 无。复用 `CourseIntelligenceReviewView.teacher_name`。

## Testing Requirements

- 有教师名时展示教师名。
- 教师名为 `null` 或空白时展示“未注明教师 · 课程通用评价”。
- 分页、维度筛选和教师筛选行为保持不变。
- 通过 lint、类型检查、相关 smoke 和小程序构建。

## Risk

- “未注明教师”只表达源数据缺失，不代表所有教师，不能自动归入当前筛选教师。
