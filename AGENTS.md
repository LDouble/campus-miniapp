# Campus Miniapp Development Rules

## Ousea / Global design source

All new miniapp UI and all visual refactors must use Ousea / Global as the single source of truth.

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
