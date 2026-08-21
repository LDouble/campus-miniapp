# OUSea小程序：修复教师历史浮层中趋势图穿透显示

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-14
**Last Updated:** 2026-08-14

## 一、问题概述

课程通过率页面包含课程整体的“学期趋势”Canvas 图表和历史授课教师列表。点击教师后会打开教师历史详情底部浮层，但底层课程趋势图仍显示在浮层之上，与教师详情内容重叠。

## 二、根因

- 课程趋势图使用 Taro `Canvas`，编译到微信小程序后具有原生组件层级特性。
- 教师详情浮层使用普通 `View`，仅依赖 `position: fixed` 和 `z-index` 遮罩。
- 当前 `selectedTeacher` 只锁定页面滚动，没有在浮层打开时卸载 Canvas。
- 因此在部分微信基础库或设备上，Canvas 会穿透普通 View 遮罩；继续提高 CSS `z-index` 不能可靠解决。

## 三、修复目标

- 打开教师历史详情后，课程整体的学期趋势图不再穿透浮层。
- 教师详情中的学期记录正常展示，不被误隐藏。
- 关闭教师详情后，课程趋势图恢复显示，并按当前指标、当前选中学期重新绘制。
- 不修改统计接口、教师趋势请求和现有布局。

## 四、技术方案

- 在 `src/pages/academic/statistics/index.tsx` 中把课程趋势 Canvas 的挂载条件与 `selectedTeacher` 关联。
- 教师浮层打开期间不渲染 Canvas 及其触摸层；底层趋势卡片的静态标签可保留，由遮罩正常覆盖。
- 趋势绘制副作用在教师浮层打开时不调用 `drawTrend`。
- 将 `selectedTeacher` 加入绘制副作用依赖；浮层关闭后 Canvas 重新挂载，延时绘制逻辑自动恢复当前图表。
- 恢复仓库中未合并提交 `c612868` 的同等最小代码改动，不引入新的层级样式。

## 五、修改文件

- `src/pages/academic/statistics/index.tsx`：控制 Canvas 挂载和重绘时机。
- `.agent/TASKS/fix-teacher-history-trend-visibility.md`：记录任务状态。
- `.agent/PRDS/fix-teacher-history-trend-visibility.md`：记录修复方案与验收标准。

本修复按用户要求与成绩资料浮层滚动修复放在同一分支，不修改后端。

## 六、测试要求

### 自动检查

- `yarn typecheck`
- `yarn lint`
- `yarn build:weapp`
- `git diff --check`

### 手工验收

- 至少存在两个学期趋势点时，打开任一教师历史详情，底层课程趋势图完全不可见。
- 关闭教师详情后，趋势图恢复显示。
- 切换“通过率/平均分”及趋势学期后，再开关教师详情，图表恢复内容正确。
- 教师详情加载中、加载成功和空数据状态均不受影响。

## 七、验收标准

- 教师历史浮层打开期间不出现底层趋势 Canvas 穿透。
- 浮层关闭后趋势图恢复且交互正常。
- 教师分学期历史数据正常展示。
- 类型检查、Lint、小程序构建和差异检查全部通过。

---

**实施说明：**

该问题属于微信小程序 Canvas 原生组件层级问题，通过控制组件生命周期解决，不使用单纯抬高 `z-index` 的脆弱方案。
