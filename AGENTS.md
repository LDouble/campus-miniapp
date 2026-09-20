# Campus Miniapp Development Rules

## Ousea / Global design source

All new miniapp UI and all visual refactors must use Ousea / Global as the default design source. When the user specifies a Stitch page for visual replication, follow the Stitch rules below and explicitly explain any conflicts with Ousea / Global.

Before changing a page or shared component:

1. Read [`design-system/campus-miniapp/MASTER.md`](design-system/campus-miniapp/MASTER.md).
2. Read the relevant page override under `design-system/campus-miniapp/pages/` when one exists.
3. Use [`design-system/campus-miniapp/ousea-design-tokens.json`](design-system/campus-miniapp/ousea-design-tokens.json) for primitive values.

Implementation rules:

- Consume `--ousea-*` / `$ousea-*` for new primitives. Do not create page-local aliases for global colors, type, spacing, or radii.
- Existing `--campus-*` variables are a semantic compatibility layer and must map back to Ousea / Global for light mode.
- Keep dark-mode values semantic; do not replace Ousea primitives with page-specific dark palettes.
- Preserve API data, navigation, loading, error, empty, accessibility, safe-area, and reduced-motion behavior while adapting Figma references.
- Use real SVG/PNG assets for functional icons. Emoji are not functional icons.
- When a global Token changes, update the JSON source, `src/app.scss`, `src/styles/_tokens.scss`, documentation, and smoke assertions together.

Required UI validation:

```bash
yarn lint
yarn typecheck
yarn test:design-tokens
yarn test:typography
yarn test:dark-mode
yarn build:weapp
```

## Stitch 设计稿复刻规则

当用户指定 Stitch 页面要求复刻时，所有小程序页面与组件均须遵守：

1. 以用户指定的 Stitch 页面为唯一视觉依据，同时读取原始 HTML 和截图；不得混用其他版本的设计稿或仅凭截图印象实现。
2. 按原稿还原布局、尺寸比例、字体、间距、颜色、圆角、边框、阴影和图标，不凭感觉调整。用户明确要求的差异按用户要求执行。
3. 如果原稿与 OUSea token 或小程序平台限制冲突，先向用户说明具体差异及影响，不得静默替换或自行改变视觉效果。

### 视觉验收（必做）

视觉复刻必须经过截图验收，不得以编译、Lint、类型检查或代码测试通过代替视觉验收。

1. 统一参考图与实际页面的视口尺寸、缩放、展示数据和页面状态。使用微信开发者工具自动化截取真实小程序页面；需要渲染 Stitch 原始 HTML 时，可使用 Playwright 生成同尺寸参考截图。
2. 对参考图与实际图进行并排、半透明叠加和差异图检查，可使用 ImageMagick、Pixelmatch 等工具。逐项核对布局、尺寸比例、字体、间距、颜色、圆角、边框、阴影、图标及对齐；头像、按钮和文字基线等细节须局部放大检查。
3. 单独记录用户明确允许的差异。跨平台字体抗锯齿等渲染差异须结合人工视觉复核，不得仅凭单一相似度百分比判定通过，也不得将布局偏移或尺寸错误归为渲染误差。
4. 发现非预期差异后必须修正并重新截图、对比，直到完成复验。工具不可用或未能完成截图对比时，明确说明未验证项，不得声称已完成 1 比 1 复刻。
5. 交付时提供参考图、实际图、叠加图或差异图的可访问路径，并说明允许的差异及仍存在的限制。
