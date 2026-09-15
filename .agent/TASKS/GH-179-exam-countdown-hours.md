## Task: 修正本科生考试卡片小时级倒计时

**ID:** GH-179-exam-countdown-hours
**Issue:** [#179](https://github.com/LDouble/campus-miniapp/issues/179)
**Label:** OUSea小程序: 修正本科生考试卡片倒计时精度
**Description:** 修正教务页面的时间锚点问题：考试安排卡片按小时展示待考时间，课程表每次进入默认定位今天。
**Type:** Bug
**Status:** Done
**Priority:** High
**Created:** 2026-09-02
**Updated:** 2026-09-02
**PRD:** [Link](../PRDS/GH-179-exam-countdown-hours.md)

---

### 背景

考试卡片的 `getExamStatusLabel` 仍使用 `Math.ceil(剩余毫秒 / 1 天)`。因此距离考试 1 天多但不足 2 天时，会错误显示为“2 天后”。例如 9 月 2 日 13:30 的考试，在临近考试时仍可能显示“2 天后”。

### 目标

将考试安排页面的待考倒计时精确到小时，并保持进行中、已结束状态及现有接口不变。

### 验收标准

- 距离考试 36 小时显示“1 天 12 小时后”。
- 距离考试 24 小时显示“1 天后”。
- 距离考试不足 24 小时（例如 3 小时）显示“3 小时后”。
- 进行中的考试显示“进行中”。
- 已结束的考试显示“已结束”。
- 考试列表卡片和详情页使用一致的待考状态文案。

### 范围

- 修改考试页面共用的倒计时格式化逻辑。
- 为小时级、整天和跨天场景补充自动化断言。

### 非范围

- 不修改后端接口、考试数据结构、学期选择策略或座位号展示。
- 不调整页面视觉样式和导航行为。

### 补充问题：课表进入时定位今天

- 课表页面初始化会读取本地 `selectedWeekday`，导致重新进入时沿用上次选择的星期。
- 课表每次进入（包括页面重新显示）应按系统当前日期定位星期一至星期日；星期日映射为第 7 天。
- 用户在当前页面手动切换星期仍然有效，但不应成为下一次进入页面的默认锚点。
- 学期同步、手动刷新和切换学期后的星期锚点也统一使用今天，而不是写死星期一。

### 补充修改文件

- `src/pages/academic/utils.ts` - 提供日期到教务星期的统一转换。
- `src/pages/academic/schedule/index.tsx` - 忽略持久化的旧星期并在进入/刷新时锚定今天。
- `scripts/academic-schedule-smoke.ts` - 增加星期锚点和本地偏好覆盖断言。

### 完成情况

- 已确认并修复课表页面读取本地 `selectedWeekday` 导致重新进入沿用上次星期的问题。
- 已覆盖首次初始化、页面重新显示、学期同步、手动刷新和切换学期场景。
- 已通过 `yarn test:academic-schedule`、`yarn test:academic-exams`、`yarn lint`、`yarn typecheck`、`yarn build:weapp` 和 product full 构建。

### 完成情况

- 已将考试待考状态改为按小时向上取整，跨天显示“天 + 小时”。
- 已让考试状态和倒计时使用同一个时间快照。
- 已补充小时级、整天、跨天以及进行中/已结束状态断言。
- 已通过 `yarn test:academic-exams`、`yarn lint`、`yarn typecheck`、设计校验和 `yarn build:weapp`。
