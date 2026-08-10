#!/bin/sh

set -eu

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

edition="${1:-}"
check_mode="${2:-}"

case "$check_mode" in
  ai|ai-check)
    wechat_ai_enabled="1"
    ;;
  ""|check)
    wechat_ai_enabled="0"
    ;;
  *)
    echo "用法：sh scripts/build-weapp-edition.sh <full|qualification> [check|ai|ai-check]" >&2
    exit 1
    ;;
esac

if [ "$edition" = "qualification" ] && [ "$wechat_ai_enabled" = "1" ]; then
  echo "资格版构建不支持启用微信 AI Skill。" >&2
  exit 1
fi

case "$edition" in
  full)
    current_app_id="${TARO_APP_FULL_WECHAT_APP_ID:-}"
    target_app_id=""
    ;;
  qualification)
    current_app_id="${TARO_APP_QUALIFICATION_WECHAT_APP_ID:-}"
    target_app_id="${TARO_APP_FULL_WECHAT_APP_ID:-}"
    ;;
  *)
    echo "用法：sh scripts/build-weapp-edition.sh <full|qualification> [check]" >&2
    exit 1
    ;;
esac

if [ -z "$current_app_id" ]; then
  echo "未配置 ${edition} 版本的微信小程序 AppID。" >&2
  exit 1
fi

if [ "$edition" = "qualification" ] && [ -z "$target_app_id" ]; then
  echo "资格版构建必须配置 TARO_APP_FULL_WECHAT_APP_ID 作为新版目标 AppID。" >&2
  exit 1
fi

export TARO_APP_EDITION="$edition"
export TARO_APP_ID="$current_app_id"
export TARO_APP_WECHAT_APP_ID="$current_app_id"
export TARO_APP_WECHAT_AI_ENABLED="$wechat_ai_enabled"

if [ "$edition" = "qualification" ]; then
  export TARO_APP_TARGET_WECHAT_APP_ID="$target_app_id"
else
  unset TARO_APP_TARGET_WECHAT_APP_ID || true
fi

./node_modules/.bin/taro build --type weapp

if [ "$edition" = "qualification" ] && [ "$check_mode" = "check" ]; then
  ./node_modules/.bin/ts-node --transpile-only scripts/qualification-build-smoke.ts
fi

if [ "$edition" = "full" ] && [ "$check_mode" = "check" ]; then
  ./node_modules/.bin/ts-node --transpile-only scripts/wechat-ai-submission-smoke.ts
fi

if [ "$edition" = "full" ] && [ "$check_mode" = "ai-check" ]; then
  ./node_modules/.bin/ts-node --transpile-only scripts/wechat-ai-smoke.ts
fi
