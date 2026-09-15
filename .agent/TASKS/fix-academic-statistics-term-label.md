## Task: 修复通过率趋势学期标签

**ID:** fix-academic-statistics-term-label
**Label:** OUSea小程序：修复通过率趋势学期标签
**Description:** 修复通过率课程趋势和教师趋势把学期代码后缀错误映射为季节的问题，并改用服务端学期标签作为展示事实来源。
**Type:** Bug
**Status:** Done
**Priority:** High
**Created:** 2026-08-14
**Updated:** 2026-08-14
**PRD:** [产品需求文档](../PRDS/fix-academic-statistics-term-label.md)

---

## 实施范围

- 课程趋势与详情展示正确的夏、秋、春学期。
- 教师趋势记录使用相同的标签口径。
- 优先使用服务端 `term_label`，旧接口数据保留正确的 `term_code` 兼容映射。
- 更新 OpenAPI 生成类型并增加学期标签格式化回归测试。

## 验证结果

- `yarn test:academic-statistics`
- `yarn typecheck`
- `yarn lint`
- `yarn build:weapp`
- `git diff --check`
