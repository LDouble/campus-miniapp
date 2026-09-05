## Task: 修复模拟选课学期列表

**ID:** GH-192-simulation-periods
**Label:** Miniapp: 修复模拟选课学期列表
**Description:** 模拟选课课表使用完整校历学期列表，并按选择的学期展示本地模拟课程。
**Type:** Bug
**Status:** In Progress
**Priority:** High
**Created:** 2026-09-05
**Updated:** 2026-09-05
**Issue:** https://github.com/LDouble/campus-miniapp/issues/192
**PRD:** [修复方案](../PRDS/GH-192-simulation-periods.md)

## 验收标准

- 模拟选课页展示服务端校历返回的全部可用学期，而不是仅展示第一门模拟课程对应的一个学期。
- 默认选中服务端标记的当前学期；用户切换学期后只展示该学期的本地模拟课程。
- 没有模拟课程或校历请求失败时仍有稳定的学期选择与空状态，不伪造错误学期。
- 模拟选课数据继续只读写本机，不新增服务端存储或提交真实选课。
