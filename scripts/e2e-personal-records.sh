#!/usr/bin/env bash
set -euo pipefail

MINIAPP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${CAMPUS_BACKEND_DIR:-$MINIAPP_DIR/../campus_backend}"
WECHATIDE_CLIENT="${WECHATIDE_CLIENT:-Codex}"
WECHAT_APP_ID="${TARO_APP_WECHAT_APP_ID:-wx0d9936d6708f44c0}"
SCREENSHOT_PATH="$MINIAPP_DIR/.local/e2e-personal-records.png"

if [[ ! -f "$BACKEND_DIR/compose.yaml" ]]; then
  echo "未找到后端 compose.yaml：$BACKEND_DIR" >&2
  exit 1
fi

mysql_query() {
  local sql="$1"
  docker compose \
    --project-directory "$BACKEND_DIR" \
    -f "$BACKEND_DIR/compose.yaml" \
    exec -T mysql \
    sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -uroot "$MYSQL_DATABASE" -e "$1"' \
    -- "$sql"
}

wechat() {
  wechatide -c "$WECHATIDE_CLIENT" "$@"
}

ensure_project_window() {
  local runtime
  runtime="$(
    wechat automation_runtime_info \
      --project "$MINIAPP_DIR" \
      --action currentPage 2>/dev/null || true
  )"
  if jq -e '.ok == true and .result.success == true' <<<"$runtime" >/dev/null; then
    return
  fi
  wechat open_project_window \
    --project "$MINIAPP_DIR" \
    --window-mode fullMode >/dev/null
}

CURRENT_USER_ID="$(mysql_query "SELECT id FROM users WHERE app_id = '$WECHAT_APP_ID' AND open_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1;")"
if [[ ! "$CURRENT_USER_ID" =~ ^[0-9]+$ ]]; then
  echo "未找到当前 AppID 对应的微信联调用户，请先在开发者工具打开小程序完成登录。" >&2
  exit 1
fi

OTHER_USER_ID="$(mysql_query "SELECT id FROM users WHERE id <> $CURRENT_USER_ID ORDER BY id LIMIT 1;")"
ERRAND_ID="$(mysql_query "SELECT id FROM errand_tasks WHERE contact_ciphertext <> '' ORDER BY id DESC LIMIT 1;")"
CARPOOL_ID="$(
  mysql_query "
    SELECT t.id
    FROM carpool_trips t
    LEFT JOIN carpool_participants p
      ON p.trip_id = t.id AND p.user_id = $CURRENT_USER_ID
    WHERE t.organizer_id <> $CURRENT_USER_ID
      AND p.id IS NULL
    ORDER BY t.id DESC
    LIMIT 1;
  "
)"

if [[ ! "$OTHER_USER_ID" =~ ^[0-9]+$ || ! "$ERRAND_ID" =~ ^[0-9]+$ || ! "$CARPOOL_ID" =~ ^[0-9]+$ ]]; then
  echo "本地后端缺少可复用的双用户、跑腿或拼车夹具，请先运行后端集成数据初始化。" >&2
  exit 1
fi

ORIGINAL_RUNNER_ID="$(mysql_query "SELECT COALESCE(runner_id, 0) FROM errand_tasks WHERE id = $ERRAND_ID;")"
ORDER_NO="E2E-MY-$CURRENT_USER_ID"

cleanup() {
  mysql_query "DELETE FROM trade_orders WHERE order_no = '$ORDER_NO';" >/dev/null || true
  if [[ "$ORIGINAL_RUNNER_ID" == "0" ]]; then
    mysql_query "UPDATE errand_tasks SET runner_id = NULL WHERE id = $ERRAND_ID;" >/dev/null || true
  else
    mysql_query "UPDATE errand_tasks SET runner_id = $ORIGINAL_RUNNER_ID WHERE id = $ERRAND_ID;" >/dev/null || true
  fi
  mysql_query "DELETE FROM carpool_participants WHERE trip_id = $CARPOOL_ID AND user_id = $CURRENT_USER_ID;" >/dev/null || true
}
trap cleanup EXIT

mysql_query "
  UPDATE errand_tasks
  SET runner_id = $CURRENT_USER_ID
  WHERE id = $ERRAND_ID;

  INSERT INTO carpool_participants
    (trip_id, user_id, status, joined_at, cancelled_at, version)
  VALUES
    ($CARPOOL_ID, $CURRENT_USER_ID, 'joined', UTC_TIMESTAMP(3), NULL, 1);

  DELETE FROM trade_orders WHERE order_no = '$ORDER_NO';
  INSERT INTO trade_orders
    (order_no, order_type, resource_type, resource_id, buyer_id, seller_id,
     amount_cents, currency, payment_mode, trade_status, fulfillment_status,
     title_snapshot, resource_snapshot, idempotency_key, completed_at, version)
  VALUES
    ('$ORDER_NO', 'errand', 'errand_task', $ERRAND_ID, $CURRENT_USER_ID, $OTHER_USER_ID,
     880, 'CNY', 'offline', 'completed', 'delivered',
     '北区快递站 → 图书馆南门', JSON_OBJECT('task_id', $ERRAND_ID, 'description', 'E2E 校园跑腿订单'),
     'e2e-my-$CURRENT_USER_ID', UTC_TIMESTAMP(3), 1);
" >/dev/null

wechat check_wechatide_status --skill-version 0.3.4 >/dev/null
ensure_project_window
wechat simulator_refresh --project "$MINIAPP_DIR" >/dev/null
wechat simulator_open_page --project "$MINIAPP_DIR" --page pages/profile/index >/dev/null

wechatide -c "$WECHATIDE_CLIENT" automation_page_action \
  --project "$MINIAPP_DIR" \
  --action querySelector \
  --selector ".profile-menu__orders" \
  --wait 2 >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_element_action \
  --project "$MINIAPP_DIR" \
  --action tap \
  --selector ".profile-menu__orders" >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_page_action \
  --project "$MINIAPP_DIR" \
  --action querySelector \
  --selector ".my-record-card--order" \
  --wait 2 >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_element_action \
  --project "$MINIAPP_DIR" \
  --action tap \
  --selector ".my-services-filter--buyer" >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_page_action \
  --project "$MINIAPP_DIR" \
  --action querySelector \
  --selector ".my-record-card--order" \
  --wait 1 >/dev/null

wechatide -c "$WECHATIDE_CLIENT" automation_navigate \
  --project "$MINIAPP_DIR" \
  --action navigateBack \
  --delta 1 >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_element_action \
  --project "$MINIAPP_DIR" \
  --action tap \
  --selector ".profile-menu__accepted" \
  --wait-for-selector ".profile-menu__accepted" >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_page_action \
  --project "$MINIAPP_DIR" \
  --action querySelector \
  --selector ".my-record-card--errand" \
  --wait 2 >/dev/null

wechatide -c "$WECHATIDE_CLIENT" automation_navigate \
  --project "$MINIAPP_DIR" \
  --action navigateBack \
  --delta 1 >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_element_action \
  --project "$MINIAPP_DIR" \
  --action tap \
  --selector ".profile-menu__carpool" \
  --wait-for-selector ".profile-menu__carpool" >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_element_action \
  --project "$MINIAPP_DIR" \
  --action tap \
  --selector ".my-services-filter--joined" \
  --wait-for-selector ".my-services-filter--joined" >/dev/null
wechatide -c "$WECHATIDE_CLIENT" automation_page_action \
  --project "$MINIAPP_DIR" \
  --action querySelector \
  --selector ".my-record-card--carpool" \
  --wait 2 >/dev/null

mkdir -p "$(dirname "$SCREENSHOT_PATH")"
wechatide -c "$WECHATIDE_CLIENT" simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$SCREENSHOT_PATH" \
  --wait-for-selector ".my-record-card--carpool" >/dev/null

NETWORK_RESULT="$(
  wechatide -c "$WECHATIDE_CLIENT" get_simulator_network \
    --project "$MINIAPP_DIR" \
    --command "grep -E '/api/v1/(orders|errands/mine|carpool/trips/mine)'" |
    jq -r '.result'
)"
for endpoint in "/api/v1/orders" "/api/v1/errands/mine" "/api/v1/carpool/trips/mine"; do
  if ! printf '%s\n' "$NETWORK_RESULT" |
    awk -v endpoint="$endpoint" '
      index($0, endpoint) && index($0, "\"status\":200") { found = 1 }
      END { exit found ? 0 : 1 }
    '; then
    echo "个人记录接口未观察到 HTTP 200 响应：$endpoint" >&2
    exit 1
  fi
done

CONSOLE_RESULT="$(
  wechatide -c "$WECHATIDE_CLIENT" get_simulator_console \
    --project "$MINIAPP_DIR" \
    --command "grep -iE 'TypeError|ReferenceError|Unhandled'" |
    jq -r '.result'
)"
if [[ "$CONSOLE_RESULT" == *"TypeError"* || "$CONSOLE_RESULT" == *"ReferenceError"* || "$CONSOLE_RESULT" == *"Unhandled"* ]]; then
  echo "模拟器出现未处理的 JavaScript 异常。" >&2
  exit 1
fi

echo "E2E 通过：我的订单、买方筛选、我的接单、我的拼车参与均显示真实后端记录。"
echo "截图：$SCREENSHOT_PATH"
