#!/bin/sh
set -eu

./node_modules/.bin/taro build --type weapp "$@"

# 开发 watcher 保持 Taro 原始增量产物；只有交付构建执行分包归位和体积守卫。
if [ "${NODE_ENV:-production}" != "development" ]; then
  output_root="dist/${TARO_APP_EDITION:-full}"
  node scripts/relocate-subpackage-assets.cjs "$output_root"
  node scripts/check-weapp-package-size.cjs "$output_root"
fi
