# 本科生考试卡片小时级倒计时修复

**Issue:** [#179](https://github.com/LDouble/campus-miniapp/issues/179)
**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-09-02
**Last Updated:** 2026-09-02

## Overview

修正本科生考试安排页面右上角待考状态的倒计时精度，并补充课程表进入时的日期锚点。考试倒计时当前把距离考试的剩余毫秒数直接按 24 小时换算并向上取整，导致剩余 1 天多但不足 2 天时显示“2 天后”。课程表则会从本地偏好恢复上次选择的星期，重新进入页面时不能稳定定位今天。新的逻辑按小时拆分考试剩余时间，并让课表每次进入按系统日期定位星期。

## User Story

**作为** 使用本科生考试安排的学生
**我希望** 卡片右上角的待考倒计时能精确到小时
**以便** 准确判断距离考试还有多久并及时安排复习。

## Context

考试页面已有独立的 `getExamStatusLabel`，它没有复用此前修正过的生活服务截止时间格式化逻辑，仍然使用完整天数向上取整。考试状态本身仍按开始时间和结束时间判断，不需要改变；只需替换 upcoming 状态的显示格式。

## Requirements

1. 考试开始时间距离当前时间小于 24 小时，显示向上取整后的小时数，例如“3 小时后”。
2. 剩余时间达到 24 小时，显示完整天数；有剩余小时则继续展示小时，例如“1 天 12 小时后”。
3. 恰好整天时不显示“0 小时”。
4. 进行中的考试继续显示“进行中”。
5. 已结束的考试继续显示“已结束”。
6. 考试列表卡片和考试详情使用同一个状态格式化结果。
7. 课表页面每次进入和重新显示时默认选中今天对应的星期，星期日映射为第 7 天。
8. 课表保留当前页面内的手动星期切换，但不把上次选择作为下一次进入的默认值。
9. 课表同步学期、手动刷新和切换学期时，星期锚点都使用今天，不再写死为星期一。

## Implementation Plan

- 在 `src/pages/academic/utils.ts` 增加可独立测试的考试倒计时格式化辅助函数。
- 让 `getExamStatusLabel` 在 upcoming 状态下使用该辅助函数。
- 在 `scripts/academic-exams-smoke.ts` 增加 3 小时、24 小时、36 小时和跨天小时的断言。
- 不新增依赖，不修改 API 契约和页面结构。

## Files to Modify

- `src/pages/academic/utils.ts` - 修正考试待考状态的倒计时格式化。
- `scripts/academic-exams-smoke.ts` - 增加倒计时边界测试。
- `src/pages/academic/schedule/index.tsx` - 进入课表时忽略历史星期并定位今天。
- `scripts/academic-schedule-smoke.ts` - 增加星期转换和页面锚点回归断言。

## API Endpoints

不新增或修改 API。继续使用现有考试安排接口。

## Testing Requirements

### Unit / Smoke Tests

- 3 小时 -> “3 小时后”。
- 24 小时 -> “1 天后”。
- 36 小时 -> “1 天 12 小时后”。
- 49 小时 -> “2 天 1 小时后”。
- 进行中和已结束状态文案不变。
- 周一至周六映射为第 1 至第 6 天，周日映射为第 7 天。
- 课表页面不能直接以本地保存的 `selectedWeekday` 作为进入时的默认值。

### Manual Testing Checklist

- 打开本科生考试安排页面，确认距离 9 月 2 日 13:30 的考试不再显示“2 天后”，而显示按实际剩余小时计算的文案。
- 临近 24 小时时确认文案从天级切换到小时级。
- 确认考试列表卡片右上角和详情页状态一致。
- 选择非今天的课表星期后离开并重新进入，确认重新定位到今天。
- 确认日视图和周视图都高亮今天对应的星期。
- 确认 full 和 qualification 小程序构建均通过。

## Delivery Notes

- `formatExamCountdown` 已统一处理考试待考状态：不足一天显示小时，跨天显示完整天数和剩余小时，整天不显示“0 小时”。
- `getExamStatusLabel` 和 `getExamStatus` 使用同一个可选时间快照，避免临界时间重复读取当前时间造成状态与文案不一致。
- `getAcademicWeekday` 统一把系统星期转换为课表的周一至周日 1-7；课表初始化和 `useDidShow` 会覆盖本地保存的历史星期。
- 课表学期同步、手动刷新和切换学期都改为定位今天，用户在当前页面内手动切换星期仍然有效。
- 已通过 `yarn test:academic-exams`、`yarn lint`、`yarn typecheck`、`yarn test:design-tokens`、`yarn test:typography`、`yarn test:dark-mode` 和 `yarn build:weapp`。
- 课表补充修复已通过 `yarn test:academic-schedule`，并重新完成 product full 构建；资格版因缺少 AppID 未执行。
