#!/usr/bin/env bash
set -euo pipefail

MINIAPP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${CAMPUS_BACKEND_DIR:-$MINIAPP_DIR/../campus_backend}"
WECHATIDE_CLIENT="${WECHATIDE_CLIENT:-Codex}"
API_BASE_URL="${CAMPUS_E2E_API_BASE_URL:-http://127.0.0.1:18080}"
RUN_ID="E2E-LIFE-$(date +%s)-$RANDOM"

ERRAND_CONTENT="$RUN_ID-ERRAND 跑腿新建内容"
ERRAND_EDITED_CONTENT="$RUN_ID-ERRAND 跑腿驳回后编辑内容"
ERRAND_PICKUP="$RUN_ID 北区取件点"
ERRAND_DROPOFF="$RUN_ID 图书馆送达点"

MARKET_CONTENT="$RUN_ID-MARKET 九成新校园闲置物品"
MARKET_EDITED_CONTENT="$RUN_ID-MARKET 驳回后补充真实成色"

CARPOOL_CONTENT="$RUN_ID-CARPOOL 可带一件行李"
CARPOOL_EDITED_CONTENT="$RUN_ID-CARPOOL 驳回后补充集合信息"
CARPOOL_ORIGIN="$RUN_ID 校园北门"
CARPOOL_DESTINATION="$RUN_ID 火车站"

CONTACT_VALUE="e2e-$RUN_ID"
SCREENSHOT_DIR="$MINIAPP_DIR/.local/e2e-life-services"
ERRAND_SCREENSHOT="$SCREENSHOT_DIR/errand-approved.png"
MARKET_SCREENSHOT="$SCREENSHOT_DIR/market-approved.png"
CARPOOL_SCREENSHOT="$SCREENSHOT_DIR/carpool-approved.png"
NETWORK_EVIDENCE=''

ERRAND_ID=''
MARKET_ID=''
CARPOOL_ID=''

if [[ ! -f "$BACKEND_DIR/compose.yaml" || ! -f "$BACKEND_DIR/.env" ]]; then
  echo "未找到本地后端 compose.yaml 或 .env：$BACKEND_DIR" >&2
  exit 1
fi

for command in curl docker jq wechatide; do
  if ! command -v "$command" >/dev/null; then
    echo "缺少 E2E 依赖命令：$command" >&2
    exit 1
  fi
done

mysql_query() {
  local sql="$1"
  docker compose \
    --project-directory "$BACKEND_DIR" \
    -f "$BACKEND_DIR/compose.yaml" \
    exec -T mysql \
    sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -N -B -uroot "$MYSQL_DATABASE" -e "$1"' \
    -- "$sql"
}

wechat() {
  wechatide -c "$WECHATIDE_CLIENT" "$@"
}

step() {
  echo "→ $1"
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

query_element() {
  local selector="$1"
  local wait="${2:-2}"
  wechat automation_page_action \
    --project "$MINIAPP_DIR" \
    --action querySelector \
    --selector "$selector" \
    --wait "$wait"
}

assert_present() {
  local selector="$1"
  if ! query_element "$selector" 3 |
    jq -e '.ok == true and .result.success == true and .result.element != null' >/dev/null; then
    echo "页面缺少预期元素：$selector" >&2
    exit 1
  fi
}

assert_absent() {
  local selector="$1"
  if query_element "$selector" 1 2>/dev/null |
    jq -e '.ok == true and .result.success == true and .result.element != null' >/dev/null; then
    echo "页面出现了不应存在的元素：$selector" >&2
    exit 1
  fi
}

tap() {
  local selector="$1"
  local result attempt
  for attempt in 1 2 3; do
    result="$(
      wechat automation_element_action \
        --project "$MINIAPP_DIR" \
        --action tap \
        --selector "$selector" \
        --wait-for-selector "$selector" || true
    )"
    if jq -e '.ok == true' <<<"$result" >/dev/null; then
      return
    fi
    if [[ "$result" == *"page destroyed"* && "$attempt" != "3" ]]; then
      sleep 1
      continue
    fi
    break
  done
  echo "点击元素失败：$selector" >&2
  jq '{ok, errorType, message, reason}' <<<"$result" >&2 || true
  exit 1
}

input_text() {
  local selector="$1"
  local value="$2"
  local result attempt
  for attempt in 1 2 3; do
    result="$(
      wechat automation_element_action \
        --project "$MINIAPP_DIR" \
        --action input \
        --selector "$selector" \
        --value "$value" \
        --wait-for-selector "$selector" || true
    )"
    if jq -e '.ok == true' <<<"$result" >/dev/null; then
      return
    fi
    if [[ "$result" == *"page destroyed"* && "$attempt" != "3" ]]; then
      sleep 1
      continue
    fi
    break
  done
  echo "输入元素失败：$selector" >&2
  jq '{ok, errorType, message, reason}' <<<"$result" >&2 || true
  exit 1
}

element_value() {
  local selector="$1"
  wechat automation_element_action \
    --project "$MINIAPP_DIR" \
    --action value \
    --selector "$selector" \
    --wait-for-selector "$selector" |
    jq -er '.result'
}

element_text() {
  local selector="$1"
  wechat automation_element_action \
    --project "$MINIAPP_DIR" \
    --action text \
    --selector "$selector" \
    --wait-for-selector "$selector" |
    jq -er '.result'
}

assert_value() {
  local selector="$1"
  local expected="$2"
  local actual
  actual="$(element_value "$selector")"
  if [[ "$actual" != "$expected" ]]; then
    echo "表单回填错误：$selector，预期“$expected”，实际“$actual”。" >&2
    exit 1
  fi
}

wait_for_id() {
  local table="$1"
  local where="$2"
  local value attempt
  for attempt in 1 2 3 4 5; do
    value="$(mysql_query "SELECT id FROM $table WHERE $where ORDER BY id DESC LIMIT 1;")"
    if [[ "$value" =~ ^[0-9]+$ ]]; then
      printf '%s' "$value"
      return
    fi
    sleep 1
  done
  echo "等待 $table 临时记录落库超时。" >&2
  exit 1
}

admin_review() {
  local path="$1"
  local key="$2"
  local version="$3"
  local approved="$4"
  local reason="$5"
  local output_file="$6"
  local body
  body="$(
    jq -cn \
      --argjson expected_version "$version" \
      --argjson approved "$approved" \
      --arg reason "$reason" \
      '{expected_version:$expected_version,approved:$approved}
       + if $reason == "" then {} else {reason:$reason} end'
  )"
  curl -sS \
    -o "$output_file" \
    -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $key" \
    -d "$body" \
    "$API_BASE_URL$path"
}

open_life_publisher() {
  local section="$1"
  wechat simulator_open_page \
    --project "$MINIAPP_DIR" \
    --page pages/community/index >/dev/null
  tap "#life-section-$section"
  assert_present "#life-publish-$section"
  tap "#life-publish-$section"
  assert_present '#publisher-content'
  assert_absent '#publisher-title'
}

search_and_open() {
  local section="$1"
  local keyword="$2"
  local card_selector="$3"
  wechat simulator_open_page \
    --project "$MINIAPP_DIR" \
    --page pages/community/index >/dev/null
  tap "#life-section-$section"
  input_text "#life-search-input-$section" "$keyword"
  tap "#life-search-submit-$section"
  assert_present "$card_selector"
  tap "$card_selector"
  assert_present '.detail-overview__description'
}

capture_network() {
  local expected_method="${1:-}"
  local expected_path="${2:-}"
  local expected_status="${3:-}"
  local current attempt
  for attempt in 1 2 3 4 5; do
    sleep 1
    current="$(
      wechat get_simulator_network \
        --project "$MINIAPP_DIR" \
        --command "grep -E '/api/v1/(errands|marketplace/listings|carpool/trips)'" |
        jq -r '
          .result
          | split("\n")[]
          | fromjson?
          | select(.type == "HTTP_RESPONSE")
          | [.detail.method, .detail.url, (.detail.status | tostring)]
          | @tsv
        '
    )"
    NETWORK_EVIDENCE+=$'\n'"$current"
    if [[ -z "$expected_method" ]] ||
      awk -F '\t' \
        -v method="$expected_method" \
        -v path="$expected_path" \
        -v status="$expected_status" '
          $1 == method && index($2, path) && $3 == status { found = 1 }
          END { exit found ? 0 : 1 }
        ' <<<"$current"; then
      return
    fi
  done
  echo "未及时捕获模拟器响应：$expected_method $expected_path $expected_status" >&2
  exit 1
}

assert_network_response() {
  local method="$1"
  local path="$2"
  local status="$3"
  if ! awk -F '\t' \
    -v method="$method" \
    -v path="$path" \
    -v status="$status" '
      $1 == method && index($2, path) && $3 == status { found = 1 }
      END { exit found ? 0 : 1 }
    ' <<<"$NETWORK_EVIDENCE"; then
    echo "模拟器网络日志缺少预期响应：$method $path $status" >&2
    exit 1
  fi
}

cleanup() {
  local status="$1"
  local errand_ids market_ids carpool_ids remaining
  set +e

  errand_ids="$(mysql_query "SELECT GROUP_CONCAT(id) FROM errand_tasks WHERE description LIKE '$RUN_ID%';")"
  market_ids="$(mysql_query "SELECT GROUP_CONCAT(id) FROM marketplace_listings WHERE description LIKE '$RUN_ID%';")"
  carpool_ids="$(mysql_query "SELECT GROUP_CONCAT(id) FROM carpool_trips WHERE description LIKE '$RUN_ID%';")"

  mysql_query "
    DELETE FROM idempotency_records
    WHERE CONVERT(response_body USING utf8mb4) LIKE '%$RUN_ID%';
  " >/dev/null

  if [[ -n "$errand_ids" && "$errand_ids" != "NULL" ]]; then
    mysql_query "DELETE FROM domain_events WHERE aggregate_type = 'errand' AND aggregate_id IN ($errand_ids);" >/dev/null
    mysql_query "DELETE FROM outbox_events WHERE aggregate_type = 'errand' AND aggregate_id IN ($errand_ids);" >/dev/null
    mysql_query "DELETE FROM errand_tasks WHERE id IN ($errand_ids);" >/dev/null
  fi
  if [[ -n "$market_ids" && "$market_ids" != "NULL" ]]; then
    mysql_query "DELETE FROM marketplace_reservations WHERE listing_id IN ($market_ids);" >/dev/null
    mysql_query "DELETE FROM domain_events WHERE aggregate_type = 'listing' AND aggregate_id IN ($market_ids);" >/dev/null
    mysql_query "DELETE FROM outbox_events WHERE aggregate_type = 'listing' AND aggregate_id IN ($market_ids);" >/dev/null
    mysql_query "DELETE FROM marketplace_listings WHERE id IN ($market_ids);" >/dev/null
  fi
  if [[ -n "$carpool_ids" && "$carpool_ids" != "NULL" ]]; then
    mysql_query "DELETE FROM domain_events WHERE aggregate_type = 'carpool_trip' AND aggregate_id IN ($carpool_ids);" >/dev/null
    mysql_query "DELETE FROM outbox_events WHERE aggregate_type = 'carpool_trip' AND aggregate_id IN ($carpool_ids);" >/dev/null
    mysql_query "DELETE FROM carpool_trips WHERE id IN ($carpool_ids);" >/dev/null
  fi

  remaining="$(mysql_query "
    SELECT
      (SELECT COUNT(*) FROM errand_tasks WHERE description LIKE '$RUN_ID%')
      + (SELECT COUNT(*) FROM marketplace_listings WHERE description LIKE '$RUN_ID%')
      + (SELECT COUNT(*) FROM carpool_trips WHERE description LIKE '$RUN_ID%');
  ")"
  if [[ "$remaining" != "0" ]]; then
    echo "E2E 清理失败，仍有 $remaining 条临时业务记录。" >&2
    status=1
  fi

  trap - EXIT
  exit "$status"
}
trap 'cleanup $?' EXIT

ready_status="$(curl -sS -o /tmp/life-services-e2e-ready.json -w '%{http_code}' "$API_BASE_URL/health/ready")"
if [[ "$ready_status" != "200" || "$(jq -r '.data.status' /tmp/life-services-e2e-ready.json)" != "ready" ]]; then
  echo "本地 API 未 ready：$API_BASE_URL/health/ready" >&2
  exit 1
fi

running_services="$(
  docker compose \
    --project-directory "$BACKEND_DIR" \
    -f "$BACKEND_DIR/compose.yaml" \
    ps --services --status running |
    sort
)"
if [[ "$running_services" != $'mysql\nredis' ]]; then
  echo "本地 E2E 只允许 Docker 运行 mysql、redis；当前为：$running_services" >&2
  exit 1
fi

step "检查本地部署拓扑与真实登录态"
set -a
# shellcheck disable=SC1091
source "$BACKEND_DIR/.env"
set +a
login_payload="$(
  jq -cn \
    --arg username "$CAMPUS_ADMIN_USERNAME" \
    --arg password "$CAMPUS_ADMIN_PASSWORD" \
    '{username:$username,password:$password}'
)"
login_response="$(
  curl -fsS \
    -H 'Content-Type: application/json' \
    -d "$login_payload" \
    "$API_BASE_URL/api/v1/auth/login"
)"
ADMIN_TOKEN="$(jq -er '.data.access_token' <<<"$login_response")"

wechat check_wechatide_status --skill-version 0.3.4 |
  jq -e '.ok == true and .result.loginExpired == false' >/dev/null
ensure_project_window
wechat simulator_refresh --project "$MINIAPP_DIR" >/dev/null
wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/community/index >/dev/null
tap '#life-section-community'
wechat automation_evaluate \
  --project "$MINIAPP_DIR" \
  --fn-source "() => { wx.removeStorageSync('lifePublisher.drafts.v2'); return true }" >/dev/null

MEMBER_TOKEN="$(
  wechat automation_evaluate \
    --project "$MINIAPP_DIR" \
    --fn-source "() => wx.getStorageSync('campus.auth.accessToken.v1')" |
    jq -er '.result.result.result'
)"
member_response="$(
  curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/auth/me"
)"
MEMBER_ID="$(jq -er '.data.user.id' <<<"$member_response")"

mkdir -p "$SCREENSHOT_DIR"

step "跑腿：真实 UI 新建、驳回、编辑、自动复审与公开搜索"
open_life_publisher errands
input_text '#publisher-content' "$ERRAND_CONTENT"
input_text '#publisher-pickup-location' "$ERRAND_PICKUP"
input_text '#publisher-dropoff-location' "$ERRAND_DROPOFF"
input_text '#publisher-reward-yuan' '8.80'
input_text '#publisher-contact' "$CONTACT_VALUE"
tap '#publisher-submit'

ERRAND_ID="$(wait_for_id errand_tasks "description = '$ERRAND_CONTENT'")"
errand_created="$(mysql_query "SELECT CONCAT(requester_id, ':', status, ':', review_status, ':', version) FROM errand_tasks WHERE id = $ERRAND_ID;")"
if [[ "$errand_created" != "$MEMBER_ID:open:pending_review:1" ]]; then
  echo "跑腿新建落库状态错误：$errand_created" >&2
  exit 1
fi
capture_network POST /api/v1/errands 201
errand_reject_status="$(
  admin_review \
    "/api/v1/admin/errands/$ERRAND_ID/review" \
    "$RUN_ID-errand-reject" \
    1 \
    false \
    'E2E 请补充任务说明' \
    /tmp/life-e2e-errand-reject.json
)"
if [[ "$errand_reject_status" != "200" ]]; then
  echo "跑腿审核驳回失败：HTTP $errand_reject_status" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/errands/detail \
  --query "id=$ERRAND_ID" >/dev/null
assert_present '#detail-action-edit'
tap '#detail-action-edit'
assert_present '#publisher-content'
assert_absent '#publisher-title'
assert_value '#publisher-content' "$ERRAND_CONTENT"
assert_value '#publisher-pickup-location' "$ERRAND_PICKUP"
assert_value '#publisher-dropoff-location' "$ERRAND_DROPOFF"
input_text '#publisher-content' "$ERRAND_EDITED_CONTENT"
tap '#publisher-submit'

errand_edited="$(mysql_query "SELECT CONCAT(status, ':', review_status, ':', version, ':', pickup_location, ':', dropoff_location) FROM errand_tasks WHERE id = $ERRAND_ID;")"
if [[ "$errand_edited" != "open:pending_review:4:$ERRAND_PICKUP:$ERRAND_DROPOFF" ]]; then
  echo "跑腿编辑后自动复审状态错误：$errand_edited" >&2
  exit 1
fi
capture_network PATCH "/api/v1/errands/$ERRAND_ID" 200
capture_network POST "/api/v1/errands/$ERRAND_ID/submit-review" 200
errand_approve_status="$(
  admin_review \
    "/api/v1/admin/errands/$ERRAND_ID/review" \
    "$RUN_ID-errand-approve" \
    4 \
    true \
    '' \
    /tmp/life-e2e-errand-approve.json
)"
if [[ "$errand_approve_status" != "200" ]]; then
  echo "跑腿审核通过失败：HTTP $errand_approve_status" >&2
  exit 1
fi
search_and_open errands "$RUN_ID-ERRAND" "#errand-card-$ERRAND_ID"
if [[ "$(element_text '.detail-overview__description')" != "$ERRAND_EDITED_CONTENT" ]]; then
  echo "跑腿详情未展示编辑后的业务说明。" >&2
  exit 1
fi
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$ERRAND_SCREENSHOT" \
  --wait-for-selector '.detail-overview__description' >/dev/null

step "二手：真实 UI 新建送审、驳回、编辑复审与公开搜索"
open_life_publisher market
input_text '#publisher-content' "$MARKET_CONTENT"
input_text '#publisher-price-yuan' '36.50'
input_text '#publisher-contact' "$CONTACT_VALUE"
tap '#publisher-submit'

MARKET_ID="$(wait_for_id marketplace_listings "description = '$MARKET_CONTENT'")"
market_created="$(mysql_query "SELECT CONCAT(owner_id, ':', status, ':', version) FROM marketplace_listings WHERE id = $MARKET_ID;")"
if [[ "$market_created" != "$MEMBER_ID:pending_review:2" ]]; then
  echo "二手新建送审状态错误：$market_created" >&2
  exit 1
fi
capture_network POST /api/v1/marketplace/listings 201
capture_network POST "/api/v1/marketplace/listings/$MARKET_ID/submit" 200
market_reject_status="$(
  admin_review \
    "/api/v1/admin/marketplace/listings/$MARKET_ID/review" \
    "$RUN_ID-market-reject" \
    2 \
    false \
    'E2E 请补充成色' \
    /tmp/life-e2e-market-reject.json
)"
if [[ "$market_reject_status" != "200" ]]; then
  echo "二手审核驳回失败：HTTP $market_reject_status" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/marketplace/detail \
  --query "id=$MARKET_ID" >/dev/null
assert_present '#detail-action-edit'
tap '#detail-action-edit'
assert_present '#publisher-content'
assert_absent '#publisher-title'
assert_value '#publisher-content' "$MARKET_CONTENT"
assert_value '#publisher-price-yuan' '36.50'
input_text '#publisher-content' "$MARKET_EDITED_CONTENT"
tap '#publisher-submit'

market_edited="$(mysql_query "SELECT CONCAT(status, ':', version, ':', price_cents) FROM marketplace_listings WHERE id = $MARKET_ID;")"
if [[ "$market_edited" != "pending_review:5:3650" ]]; then
  echo "二手编辑后自动复审状态错误：$market_edited" >&2
  exit 1
fi
capture_network PATCH "/api/v1/marketplace/listings/$MARKET_ID" 200
capture_network POST "/api/v1/marketplace/listings/$MARKET_ID/submit" 200
market_approve_status="$(
  admin_review \
    "/api/v1/admin/marketplace/listings/$MARKET_ID/review" \
    "$RUN_ID-market-approve" \
    5 \
    true \
    '' \
    /tmp/life-e2e-market-approve.json
)"
if [[ "$market_approve_status" != "200" ]]; then
  echo "二手审核通过失败：HTTP $market_approve_status" >&2
  exit 1
fi
search_and_open market "$RUN_ID-MARKET" "#marketplace-card-$MARKET_ID"
if [[ "$(element_text '.detail-overview__description')" != "$MARKET_EDITED_CONTENT" ]]; then
  echo "二手详情未展示编辑后的物品描述。" >&2
  exit 1
fi
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$MARKET_SCREENSHOT" \
  --wait-for-selector '.detail-overview__description' >/dev/null

step "拼车：真实 UI 新建、驳回、描述回填编辑、复审与描述搜索"
open_life_publisher carpool
input_text '#publisher-content' "$CARPOOL_CONTENT"
input_text '#publisher-origin' "$CARPOOL_ORIGIN"
input_text '#publisher-destination' "$CARPOOL_DESTINATION"
input_text '#publisher-total-seats' '3'
input_text '#publisher-contact' "$CONTACT_VALUE"
tap '#publisher-submit'

CARPOOL_ID="$(wait_for_id carpool_trips "description = '$CARPOOL_CONTENT'")"
carpool_created="$(mysql_query "SELECT CONCAT(organizer_id, ':', status, ':', review_status, ':', version) FROM carpool_trips WHERE id = $CARPOOL_ID;")"
if [[ "$carpool_created" != "$MEMBER_ID:open:pending_review:1" ]]; then
  echo "拼车新建落库状态错误：$carpool_created" >&2
  exit 1
fi
capture_network POST /api/v1/carpool/trips 201
carpool_reject_status="$(
  admin_review \
    "/api/v1/admin/carpool/trips/$CARPOOL_ID/review" \
    "$RUN_ID-carpool-reject" \
    1 \
    false \
    'E2E 请补充集合说明' \
    /tmp/life-e2e-carpool-reject.json
)"
if [[ "$carpool_reject_status" != "200" ]]; then
  echo "拼车审核驳回失败：HTTP $carpool_reject_status" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/carpool/detail \
  --query "id=$CARPOOL_ID" >/dev/null
assert_present '#detail-action-edit'
tap '#detail-action-edit'
assert_present '#publisher-content'
assert_absent '#publisher-title'
assert_value '#publisher-content' "$CARPOOL_CONTENT"
assert_value '#publisher-origin' "$CARPOOL_ORIGIN"
assert_value '#publisher-destination' "$CARPOOL_DESTINATION"
input_text '#publisher-content' "$CARPOOL_EDITED_CONTENT"
tap '#publisher-submit'

carpool_edited="$(mysql_query "SELECT CONCAT(status, ':', review_status, ':', version, ':', origin, ':', destination) FROM carpool_trips WHERE id = $CARPOOL_ID;")"
if [[ "$carpool_edited" != "open:pending_review:4:$CARPOOL_ORIGIN:$CARPOOL_DESTINATION" ]]; then
  echo "拼车编辑后自动复审状态错误：$carpool_edited" >&2
  exit 1
fi
capture_network PATCH "/api/v1/carpool/trips/$CARPOOL_ID" 200
capture_network POST "/api/v1/carpool/trips/$CARPOOL_ID/submit-review" 200
carpool_approve_status="$(
  admin_review \
    "/api/v1/admin/carpool/trips/$CARPOOL_ID/review" \
    "$RUN_ID-carpool-approve" \
    4 \
    true \
    '' \
    /tmp/life-e2e-carpool-approve.json
)"
if [[ "$carpool_approve_status" != "200" ]]; then
  echo "拼车审核通过失败：HTTP $carpool_approve_status" >&2
  exit 1
fi
search_and_open carpool "$RUN_ID-CARPOOL" "#carpool-card-$CARPOOL_ID"
if [[ "$(element_text '.detail-overview__description')" != "$CARPOOL_EDITED_CONTENT" ]]; then
  echo "拼车详情或描述关键词搜索未使用编辑后的补充说明。" >&2
  exit 1
fi
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$CARPOOL_SCREENSHOT" \
  --wait-for-selector '.detail-overview__description' >/dev/null

step "核对模拟器网络响应与 JavaScript 运行错误"
capture_network
assert_network_response POST /api/v1/errands 201
assert_network_response PATCH "/api/v1/errands/$ERRAND_ID" 200
assert_network_response POST "/api/v1/errands/$ERRAND_ID/submit-review" 200
assert_network_response POST /api/v1/marketplace/listings 201
assert_network_response PATCH "/api/v1/marketplace/listings/$MARKET_ID" 200
assert_network_response POST "/api/v1/marketplace/listings/$MARKET_ID/submit" 200
assert_network_response POST /api/v1/carpool/trips 201
assert_network_response PATCH "/api/v1/carpool/trips/$CARPOOL_ID" 200
assert_network_response POST "/api/v1/carpool/trips/$CARPOOL_ID/submit-review" 200

if awk -F '\t' '$3 >= 500 && $3 <= 599 { found = 1 } END { exit found ? 0 : 1 }' <<<"$NETWORK_EVIDENCE"; then
  echo "四类业务 E2E 期间出现接口 5xx。" >&2
  exit 1
fi

console_result="$(
  wechat get_simulator_console \
    --project "$MINIAPP_DIR" \
    --command "grep -iE 'TypeError|ReferenceError|Unhandled'" |
    jq -r '.result'
)"
if [[ -n "$console_result" ]]; then
  echo "模拟器出现未处理的 JavaScript 异常。" >&2
  exit 1
fi

step "清理临时 E2E 数据"
echo "生活服务 E2E 通过：跑腿、二手、拼车均完成真实 UI 新建、驳回、编辑、重新送审、审核通过、搜索与详情回填。"
echo "取证截图："
echo "- $ERRAND_SCREENSHOT"
echo "- $MARKET_SCREENSHOT"
echo "- $CARPOOL_SCREENSHOT"
