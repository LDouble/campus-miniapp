# Campus Miniapp Development Rules

本仓库根规则只保留所有任务都需要的边界；视觉设计与 Stitch 复刻细节按需读取 .agents/*.md。

## 通用原则

1. 保留既有 API 数据、导航、加载、错误、空状态、可访问性、安全区和 reduced-motion 行为，除非需求明确要求改变。
2. 功能图标使用真实 SVG/PNG 或项目现有图标体系；不要用 Emoji 代替功能图标。
3. 不提交本机环境文件、构建产物、node_modules 或真实凭据。
4. 只运行与当前改动匹配的最小充分验证；不要因为改了一个小逻辑就默认执行完整视觉验收。

## 按需规则

- 新增 UI、视觉重构、Design Token、主题或共享组件：读取 .agents/ui-design.md。
- 用户明确指定 Stitch 页面或要求高保真/1:1 复刻：在 ui-design.md 基础上再读取 .agents/stitch.md。

## 验证原则

- 普通 TypeScript/业务逻辑改动：运行相关 lint/typecheck/目标测试和 git diff --check。
- UI/Token 改动：按 .agents/ui-design.md 运行对应检查。
- Stitch/高保真复刻：按 .agents/stitch.md 完成真实截图对比；编译通过不能替代视觉验收。

不要把 README、设计系统全文或 Stitch 规则预读到所有任务中；只有当前任务触发时再读取对应文档。
