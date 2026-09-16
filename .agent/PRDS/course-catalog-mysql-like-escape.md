# Backend: 修复课程检索 internal_error

**Priority:** High
**Status:** In Progress
**Type:** Bug
**Created:** 2026-09-05
**Last Updated:** 2026-09-05

## Overview

生产 `product_api` 的课程检索请求因 MySQL 解析 `LIKE ... ESCAPE '\\'` 失败，返回统一的 `internal_error`。需要修复 SQL 生成方式，保证模糊搜索和通配符转义在生产 MySQL 与本地 SQLite 测试中一致。

## Context

request_id `02d658ed-1fb2-4a78-b72a-058e207fdf6a` 对应日志显示课程目录计数查询触发 MySQL 1064，错误位置位于 `opening_code LIKE ... ESCAPE` 条件。

## Implementation Overview

- 统一使用 `!` 作为 LIKE 模式转义字符，避免 MySQL 字符串字面量中的反斜杠转义歧义。
- 对用户输入中的 `!`、`%`、`_` 做对应转义。
- 覆盖课程名、课程代码、选课号、教师、开设单位、校区和课程类别过滤。

## Files to Modify

- `../backend/internal/modules/academic_course_catalog/infrastructure/member_course_search_store.go`：修复 LIKE ESCAPE SQL 和模式转义。
- `../backend/internal/modules/academic_course_catalog/infrastructure/member_course_search_store_test.go`：补充跨数据库转义回归测试。

## Testing Requirements

- 课程名、教师名、类别和选课号检索仍能正常返回结果。
- `%`、`_` 和 `!` 作为普通输入字符时不会改变模糊匹配语义。
- 目标包测试、OpenAPI/迁移生成检查和构建通过。
