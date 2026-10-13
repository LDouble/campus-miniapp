# OUSea UI and Design System Rules

仅在新增 UI、视觉重构、主题、Design Token 或共享组件时读取。

## 设计来源

OUSea / Global 是默认设计源。修改页面或共享组件前：
1. 读取 design-system/campus-miniapp/MASTER.md。
2. 若存在对应页面 override，读取 design-system/campus-miniapp/pages/ 下相关文件。
3. 原始 primitive 值使用 design-system/campus-miniapp/ousea-design-tokens.json。

## 实现规则

- 新 primitive 使用 --ousea-* / $ousea-*，不要创建页面私有的全局颜色、字体、间距或圆角别名。
- 既有 --campus-* 是语义兼容层，light mode 应映射回 OUSea / Global。
- dark mode 保持语义化，不用页面私有深色 palette 替换全局 primitive。
- 适配设计时保留 API 数据、导航、loading/error/empty、accessibility、safe-area 和 reduced-motion。
- 功能图标使用真实 SVG/PNG 或项目图标资源。
- 修改全局 Token 时，同步更新 JSON 源、src/app.scss、src/styles/_tokens.scss、文档和相关 smoke assertion。

## 最小验证

根据实际改动选择最小充分检查：
- 业务/组件类型变化：yarn typecheck。
- 样式/代码规范：yarn lint。
- Token 变化：yarn test:design-tokens。
- 字体变化：yarn test:typography。
- dark mode 变化：yarn test:dark-mode。
- 影响小程序构建链路或准备交付时：yarn build:weapp。

不要机械地为每个 UI 小改动全量运行所有检查；必须覆盖被修改的约束。提交前执行 git diff --check。

如果用户明确指定 Stitch 页面，继续读取 .agents/stitch.md；Stitch 在该次任务中是视觉依据，但平台限制和与 OUSea Global 的冲突必须显式说明。
