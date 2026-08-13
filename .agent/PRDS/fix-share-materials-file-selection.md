# 海大校园小程序：修复分享资料选择文件时报错

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-13
**Last Updated:** 2026-08-13

## 一、问题概述

打开课程资料页并点击“分享资料”后，小程序可能提示：

`Cannot read properties of undefined (reading 'filter')`

该错误会阻断资料分享流程，也会导致微信代码审核判定页面存在运行时异常。

## 二、复现链路与根因

- 资料页主入口的“分享资料”按钮调用 `openUpload`。
- 当没有上传草稿时，`openUpload` 立即调用 `chooseFiles`。
- `chooseFiles` 调用 `Taro.chooseMessageFile` 后，直接执行 `result.tempFiles.filter(...)`。
- 正常微信 API 返回中 `tempFiles` 应为数组，但审核自动化、用户取消、基础库兼容异常或不完整 mock 可能返回缺少该字段的结果。
- 当前代码没有校验 `tempFiles`，因此对 `undefined` 调用 `filter`。
- 外层 `catch` 又直接把 `error.message` 作为 Toast 展示，最终用户看到原始英文 TypeError。

开发者工具在正常文件选择环境下不一定稳定复现，但错误文本与该唯一的“外部返回值直接调用 filter”路径完全一致。

## 三、修复目标

- 文件选择结果缺少 `tempFiles` 时不再抛出运行时异常。
- 用户取消或没有选择文件时安静结束，不显示错误。
- 返回结构异常时显示明确中文提示，不暴露 JavaScript 原始异常。
- 合法文件筛选、大小限制、格式限制和上传流程保持不变。
- 微信审核自动化即使返回不完整文件选择结果，也不会产生未处理异常。
- 同步加固扫描发现的社团图片选择和学历认证选图，避免缺少 `tempFiles` 时出现同类异常。

## 四、技术方案

### 4.1 规范化文件选择结果

- 在课程资料校验模块增加纯函数，接收未知文件列表。
- 仅当输入为数组时继续处理，否则返回空数组。
- 对数组元素校验必要字段：文件名、路径和有限的正数文件大小。
- 在必要字段有效后再执行扩展名、大小和数量限制。
- `chooseFiles` 只消费规范化后的数组，避免直接访问不可信 API 返回字段。

### 4.2 交互与错误处理

- `result.tempFiles` 缺失或为空时直接返回，按用户取消处理。
- 有文件但全部被格式或大小规则过滤时，保留现有中文提示。
- `catch` 不再直接展示任意 `error.message`：
  - 微信取消选择类错误安静结束。
  - 其他异常统一提示“文件选择失败，请重试”。
- 文件持久化或后续处理的业务错误仍使用可控的中文文案。

### 4.3 自动测试

- 扩展 `scripts/course-materials-smoke.ts`，覆盖：
  - `undefined`、`null`、非数组输入返回空列表。
  - 空数组返回空列表。
  - 合法 PDF、Word、PPT 文件保留。
  - 缺少名称、路径或大小的异常记录被忽略。
  - 超过 50MB 或格式不支持的文件被忽略。
  - 结果最多保留 5 个文件。

### 4.4 同类入口加固

- 增加共享的 `tempFiles` 安全提取函数，非数组或缺失字段统一返回空数组。
- 社团图片选择在空结果时返回空列表。
- 学历认证选图在空结果时直接结束。
- 两个入口的取消与正常选择行为保持不变。

## 五、拟修改文件

- `src/features/course-materials/validation.ts`：增加文件选择结果规范化与筛选函数。
- `src/pages/materials/index.tsx`：使用安全筛选结果，并收敛文件选择错误提示。
- `scripts/course-materials-smoke.ts`：补充异常返回与合法文件筛选测试。
- `src/utils/file-selection.ts`：提供微信文件/媒体选择结果的安全数组提取。
- `src/features/clubs/images.ts`：加固社团图片选择结果。
- `src/pages/academic-verification/index.tsx`：加固学历认证图片选择结果。
- `.agent/TASKS/fix-share-materials-file-selection.md`：记录任务状态。
- `.agent/PRDS/fix-share-materials-file-selection.md`：记录方案和验收标准。

不修改后端接口，不改变允许的文件格式、大小或数量。

## 六、测试要求

- 执行 `yarn test:course-materials`。
- 执行 `yarn typecheck`。
- 执行 `yarn lint`。
- 执行 `yarn build:weapp`。
- 在微信开发者工具打开资料页，点击“分享资料”，确认正常文件选择流程可用。
- 模拟 `chooseMessageFile` 返回缺少 `tempFiles`，确认页面无 TypeError。
- 模拟取消文件选择，确认无英文异常提示。

## 七、验收标准

- “分享资料”入口不再出现 `Cannot read properties of undefined (reading 'filter')`。
- 空或异常文件选择结果不会导致页面崩溃。
- 合法资料仍可正常选择并进入上传编辑流程。
- 用户只看到可理解的中文反馈。
- 课程资料测试、类型检查、Lint 和微信小程序构建全部通过。

## 八、同类问题扫描结果

### 8.1 已在本任务修复

- `src/features/clubs/images.ts`：社团图片选择直接对 `chooseMedia.tempFiles` 调用 `map`。
- `src/pages/academic-verification/index.tsx`：学历认证选图直接读取 `chooseMedia.tempFiles[0]`。
- 两处均已改用共享安全提取函数，字段缺失或不是数组时返回空数组。

### 8.2 建议后续独立加固

扫描还发现以下风险仅在后端返回结构违反 OpenAPI 声明或本地缓存损坏时触发，涉及范围较广，不纳入本次审核热修：

- 课程资料分页、我的资料、反馈、资料文件列表和上传会话的数组字段缺少运行时结构校验。
- 教务课程、成绩、考试、选课和学期接口返回值直接按数组使用。
- 班车、课程统计、空教室、社区帖子图片和消息分页存在同类网络响应数组假设。
- 自定义课程本地缓存缺少完整数组及元素结构校验。

建议后续建立统一的 API 响应解析与缓存 schema 校验层，避免在各页面散布默认空数组并掩盖后端协议错误。

---

**实施说明：**

本修复把微信文件选择结果视为不可信运行时输入，在进入现有上传逻辑前完成结构校验；业务代码、自动测试与微信开发者工具异常返回验证均已完成。
