## Task: 模拟选课长按跳转蹭课携带学期

**ID:** GH-199-simulation-audit-period
**Label:** Miniapp: 模拟选课跳转蹭课携带学期
**Description:** 从模拟选课课表长按时段进入蹭课检索时，携带当前模拟课表学期，避免蹭课页恢复为默认学期。
**Type:** Bug
**Status:** Testing
**Priority:** High
**Created:** 2026-09-06
**Updated:** 2026-09-06
**Issue:** https://github.com/LDouble/campus-miniapp/issues/199
**PRD:** [实现方案](../PRDS/GH-199-simulation-audit-period.md)

---

## 验收标准

- 从模拟选课课表长按空白时段并选择“选课”后，跳转 URL 同时携带当前 `periodId`、`weekday` 和 `section`。
- 蹭课检索页优先使用合法的路由 `periodId`，加载对应学期的课程和个人蹭课状态。
- 路由缺少学期、学期不存在或参数非法时，沿用现有默认学期逻辑，不出现空页面或错误查询。
- 现有课表到蹭课的星期、节次带入能力保持不变。
- 全部服务页提供独立的“模拟选课”入口，并打开模拟课表模式。
- 模拟选课页每次显示时展示长按引导，并在 3 秒后自动隐藏。
- 通过相关 smoke test、Lint、类型检查和小程序构建。
