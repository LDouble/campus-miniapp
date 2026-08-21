#!/usr/bin/env bash
set -euo pipefail

MINIAPP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${CAMPUS_BACKEND_DIR:-$MINIAPP_DIR/../campus_backend}"
WECHATIDE_CLIENT="${WECHATIDE_CLIENT:-Codex}"
API_BASE_URL="${CAMPUS_E2E_API_BASE_URL:-http://127.0.0.1:18080}"
RUN_ID="E2E-COMMUNITY-$(date +%s)-$RANDOM"
PARENT_MARKER="$RUN_ID-PARENT"
CHILD_MARKER="$RUN_ID-CHILD"
PARENT_CONTENT="$PARENT_MARKER 父模块真实 UI 发布、审核与聚合列表验证"
CHILD_CONTENT="$CHILD_MARKER 子模块真实 UI 发布、驳回、撤销与列表隔离验证"
CHILD_EDITED_CONTENT="$CHILD_MARKER 子模块驳回后通过真实 UI 编辑并重新送审"
COMMENT_CONTENT="$RUN_ID-COMMENT"
REPLY_CONTENT="$RUN_ID-REPLY"
CANCELLED_REPLY_CONTENT="$RUN_ID-CANCELLED-REPLY"
SCREENSHOT_DIR="$MINIAPP_DIR/.local/e2e-community"
PARENT_SCREENSHOT="$SCREENSHOT_DIR/parent-list.png"
COMMENT_SCREENSHOT="$SCREENSHOT_DIR/comment-approved.png"
REPLY_SCREENSHOT="$SCREENSHOT_DIR/comment-reply-pending.png"
PAGINATION_SCREENSHOT="$SCREENSHOT_DIR/pagination.png"
NETWORK_EVIDENCE=''

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

step() {
  echo "→ $1"
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

query_count() {
  local selector="$1"
  local wait="${2:-1}"
  wechat automation_page_action \
    --project "$MINIAPP_DIR" \
    --action querySelectorAll \
    --selector "$selector" \
    --wait "$wait" |
    jq -er '.result.elements | length'
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
        --command "grep -E '/api/v1/(campus-circle|comments)'" |
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

admin_request() {
  local method="$1"
  local path="$2"
  local key="$3"
  local body="$4"
  local output_file="$5"
  curl -sS \
    -o "$output_file" \
    -w '%{http_code}' \
    -X "$method" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $key" \
    -d "$body" \
    "$API_BASE_URL$path"
}

cleanup() {
  local status="$1"
  local post_ids comment_ids remaining event_remaining
  set +e

  post_ids="$(mysql_query "SELECT GROUP_CONCAT(id) FROM campus_circle_posts WHERE content LIKE '$RUN_ID%';")"
  if [[ -n "$post_ids" && "$post_ids" != "NULL" ]]; then
    comment_ids="$(mysql_query "SELECT GROUP_CONCAT(id) FROM comments WHERE target_type = 'campus_circle_post' AND target_id IN ($post_ids);")"
    if [[ -n "$comment_ids" && "$comment_ids" != "NULL" ]]; then
      mysql_query "DELETE FROM domain_events WHERE aggregate_type = 'comment' AND aggregate_id IN ($comment_ids);" >/dev/null
      mysql_query "DELETE FROM outbox_events WHERE aggregate_type = 'comment' AND aggregate_id IN ($comment_ids);" >/dev/null
    fi
    mysql_query "DELETE FROM domain_events WHERE aggregate_type = 'campus_circle_post' AND aggregate_id IN ($post_ids);" >/dev/null
    mysql_query "DELETE FROM outbox_events WHERE aggregate_type = 'campus_circle_post' AND aggregate_id IN ($post_ids);" >/dev/null
    mysql_query "DELETE FROM comments WHERE target_type = 'campus_circle_post' AND target_id IN ($post_ids);" >/dev/null
    mysql_query "DELETE FROM campus_circle_posts WHERE id IN ($post_ids);" >/dev/null
    event_remaining="$(mysql_query "
      SELECT
        (SELECT COUNT(*) FROM domain_events
          WHERE aggregate_type = 'campus_circle_post' AND aggregate_id IN ($post_ids))
        + (SELECT COUNT(*) FROM outbox_events
          WHERE aggregate_type = 'campus_circle_post' AND aggregate_id IN ($post_ids));
    ")"
    if [[ "$event_remaining" != "0" ]]; then
      echo "E2E 清理失败，仍有 $event_remaining 条临时社区事件。" >&2
      status=1
    fi
  fi

  mysql_query "
    DELETE FROM idempotency_records
    WHERE operation_id IN (
      'CreateCampusCirclePost',
      'ReviewCampusCirclePost',
      'RevokeCampusCirclePostReview',
      'CreateComment',
      'ReviewComment'
    )
      AND CONVERT(response_body USING utf8mb4) LIKE '%$RUN_ID%';
  " >/dev/null

  remaining="$(mysql_query "
    SELECT
      (SELECT COUNT(*) FROM campus_circle_posts WHERE content LIKE '$RUN_ID%')
      + (SELECT COUNT(*) FROM comments WHERE content LIKE '$RUN_ID%');
  ")"
  if [[ "$remaining" != "0" ]]; then
    echo "E2E 清理失败，仍有 $remaining 条临时社区记录。" >&2
    status=1
  fi

  trap - EXIT
  exit "$status"
}
trap 'cleanup $?' EXIT

ready_status="$(curl -sS -o /tmp/community-e2e-ready.json -w '%{http_code}' "$API_BASE_URL/health/ready")"
if [[ "$ready_status" != "200" || "$(jq -r '.data.status' /tmp/community-e2e-ready.json)" != "ready" ]]; then
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

step "检查本地部署拓扑与登录态"
set -a
# shellcheck disable=SC1091
source "$BACKEND_DIR/.env"
set +a
login_payload="$(jq -cn \
  --arg username "$CAMPUS_ADMIN_USERNAME" \
  --arg password "$CAMPUS_ADMIN_PASSWORD" \
  '{username:$username,password:$password}')"
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
tap '.life-primary-tabs__item:nth-child(1)'

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

sections_response="$(
  curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/campus-circle/sections"
)"
ROOT_ID="$(jq -er '
  [.data.items[]
    | select(.parent_id == null and .status == "active")
    | select([.children[] | select(.status == "active")] | length >= 2)
  ][0].id
' <<<"$sections_response")"
CHILD_ID="$(jq -er --argjson root "$ROOT_ID" '
  [.data.items[]
    | select(.id == $root)
    | .children[]
    | select(.status == "active")
  ][0].id
' <<<"$sections_response")"
SIBLING_ID="$(jq -er --argjson root "$ROOT_ID" --argjson child "$CHILD_ID" '
  [.data.items[]
    | select(.id == $root)
    | .children[]
    | select(.status == "active" and .id != $child)
  ][0].id
' <<<"$sections_response")"

expected_section_count="$(jq -er '
  [.data.items[]
    | select(.parent_id == null and .status == "active")
    | 1 + ([.children[] | select(.status == "active")] | length)
  ] | add
' <<<"$sections_response")"
actual_section_count="$(query_count '.community-section-tab' 2)"
if [[ "$actual_section_count" != "$expected_section_count" ]]; then
  echo "页面板块数量 $actual_section_count 与服务端 $expected_section_count 不一致。" >&2
  exit 1
fi

# 父模块真实 UI 发帖：必须保留根板块 ID。
step "父模块发帖与权限审核"
tap "#community-section-$ROOT_ID"
tap '.community-publish-fab'
assert_present "#publisher-community-section-$ROOT_ID.publisher-community-section--active"
input_text '#publisher-content' "$PARENT_CONTENT"
tap '#publisher-submit'

PARENT_POST_ID="$(mysql_query "SELECT id FROM campus_circle_posts WHERE content = '$PARENT_CONTENT' ORDER BY id DESC LIMIT 1;")"
parent_row="$(mysql_query "SELECT CONCAT(section_id, ':', status, ':', version) FROM campus_circle_posts WHERE id = $PARENT_POST_ID;")"
if [[ "$parent_row" != "$ROOT_ID:pending_review:1" ]]; then
  echo "父模块帖子落库状态错误：$parent_row" >&2
  exit 1
fi
capture_network POST /api/v1/campus-circle/posts 201
assert_absent "#community-post-$PARENT_POST_ID"

member_review_status="$(
  curl -sS \
    -o /tmp/community-e2e-member-review.json \
    -w '%{http_code}' \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $RUN_ID-member-review-denied" \
    -d '{"expected_version":1,"approved":true}' \
    "$API_BASE_URL/api/v1/admin/campus-circle/posts/$PARENT_POST_ID/review"
)"
if [[ "$member_review_status" != "403" ]]; then
  echo "普通成员调用审核接口应返回 403，实际为 ${member_review_status}。" >&2
  exit 1
fi

parent_review_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$PARENT_POST_ID/review" \
    "$RUN_ID-parent-approve" \
    '{"expected_version":1,"approved":true}' \
    /tmp/community-e2e-parent-review.json
)"
if [[ "$parent_review_status" != "200" ||
  "$(jq -r '.data.status' /tmp/community-e2e-parent-review.json)" != "approved" ]]; then
  echo "父模块帖子审核通过失败。" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/community/index >/dev/null
tap '.life-primary-tabs__item:nth-child(1)'
tap "#community-section-$ROOT_ID"
assert_present "#community-post-$PARENT_POST_ID"
mkdir -p "$SCREENSHOT_DIR"
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$PARENT_SCREENSHOT" \
  --wait-for-selector "#community-post-$PARENT_POST_ID" >/dev/null

# 子模块真实 UI 发帖，并覆盖驳回、重复审核冲突、撤销审核和再次通过。
step "子模块发帖与完整审核状态机"
tap "#community-section-$CHILD_ID"
tap '.community-publish-fab'
assert_present "#publisher-community-section-$CHILD_ID.publisher-community-section--active"
input_text '#publisher-content' "$CHILD_CONTENT"
tap '#publisher-submit'

CHILD_POST_ID="$(mysql_query "SELECT id FROM campus_circle_posts WHERE content = '$CHILD_CONTENT' ORDER BY id DESC LIMIT 1;")"
child_row="$(mysql_query "SELECT CONCAT(section_id, ':', status, ':', version) FROM campus_circle_posts WHERE id = $CHILD_POST_ID;")"
if [[ "$child_row" != "$CHILD_ID:pending_review:1" ]]; then
  echo "子模块帖子落库状态错误：$child_row" >&2
  exit 1
fi
capture_network POST /api/v1/campus-circle/posts 201

reject_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$CHILD_POST_ID/review" \
    "$RUN_ID-child-reject" \
    '{"expected_version":1,"approved":false,"reason":"E2E 驳回验证"}' \
    /tmp/community-e2e-child-reject.json
)"
if [[ "$reject_status" != "200" ]]; then
  echo "子模块帖子驳回失败。" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page packages/social/community/detail \
  --query "id=$CHILD_POST_ID&mode=post" >/dev/null
assert_present '#community-detail-more'
wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page packages/social/publish/index \
  --query "section=community&mode=edit&id=$CHILD_POST_ID" >/dev/null
assert_present '#publisher-content'
assert_absent '#publisher-title'
input_text '#publisher-content' "$CHILD_EDITED_CONTENT"
tap '#publisher-submit'

child_edited_row="$(mysql_query "SELECT CONCAT(section_id, ':', status, ':', version, ':', content) FROM campus_circle_posts WHERE id = $CHILD_POST_ID;")"
if [[ "$child_edited_row" != "$CHILD_ID:pending_review:3:$CHILD_EDITED_CONTENT" ]]; then
  echo "子模块帖子驳回后编辑送审状态错误：$child_edited_row" >&2
  exit 1
fi
capture_network PATCH "/api/v1/campus-circle/posts/$CHILD_POST_ID" 200

duplicate_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$CHILD_POST_ID/review" \
    "$RUN_ID-child-duplicate" \
    '{"expected_version":2,"approved":true}' \
    /tmp/community-e2e-child-duplicate.json
)"
initial_approve_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$CHILD_POST_ID/review" \
    "$RUN_ID-child-initial-approve" \
    '{"expected_version":3,"approved":true}' \
    /tmp/community-e2e-child-initial-approve.json
)"
revoke_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$CHILD_POST_ID/revoke-review" \
    "$RUN_ID-child-revoke" \
    '{"expected_version":4,"reason":"E2E 撤销通过验证"}' \
    /tmp/community-e2e-child-revoke.json
)"
approve_status="$(
  admin_request \
    POST \
    "/api/v1/admin/campus-circle/posts/$CHILD_POST_ID/review" \
    "$RUN_ID-child-approve" \
    '{"expected_version":5,"approved":true}' \
    /tmp/community-e2e-child-approve.json
)"
if [[ "$duplicate_status" != "409" ||
  "$initial_approve_status" != "200" ||
  "$revoke_status" != "200" ||
  "$approve_status" != "200" ||
  "$(jq -r '.data.status' /tmp/community-e2e-child-approve.json)" != "approved" ]]; then
  echo "子模块审核状态机验收失败。" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/community/index >/dev/null
tap '.life-primary-tabs__item:nth-child(1)'
tap "#community-section-$CHILD_ID"
assert_present "#community-post-$CHILD_POST_ID"
tap "#community-section-$ROOT_ID"
assert_present "#community-post-$CHILD_POST_ID"
tap "#community-section-$SIBLING_ID"
assert_absent "#community-post-$CHILD_POST_ID"

# 评价：作者能看到待审核内容，但公开计数保持 0；审核后计数变为 1。
step "评价待审核可见性与审核计数"
tap "#community-section-$CHILD_ID"
tap "#community-post-$CHILD_POST_ID .api-post__body"
input_text "#business-comment-campus_circle_post-$CHILD_POST_ID" "$COMMENT_CONTENT"
tap "#business-comment-submit-campus_circle_post-$CHILD_POST_ID"

COMMENT_ID="$(mysql_query "SELECT id FROM comments WHERE content = '$COMMENT_CONTENT' ORDER BY id DESC LIMIT 1;")"
comment_row="$(mysql_query "SELECT CONCAT(target_id, ':', status, ':', version) FROM comments WHERE id = $COMMENT_ID;")"
if [[ "$comment_row" != "$CHILD_POST_ID:pending_review:1" ]]; then
  echo "评价落库状态错误：$comment_row" >&2
  exit 1
fi
capture_network POST /api/v1/comments 201
assert_present "#detail-comment-$COMMENT_ID.business-detail-comment--pending_review"
if [[ "$(element_text '.business-detail-comments__heading')" != *"评论 0"* ]]; then
  echo "待审核评价不应提前增加公开计数。" >&2
  exit 1
fi

comment_review_status="$(
  admin_request \
    POST \
    "/api/v1/admin/comments/$COMMENT_ID/review" \
    "$RUN_ID-comment-approve" \
    '{"expected_version":1,"approved":true}' \
    /tmp/community-e2e-comment-review.json
)"
comment_duplicate_status="$(
  admin_request \
    POST \
    "/api/v1/admin/comments/$COMMENT_ID/review" \
    "$RUN_ID-comment-duplicate" \
    '{"expected_version":2,"approved":false,"reason":"重复审核"}' \
    /tmp/community-e2e-comment-duplicate.json
)"
if [[ "$comment_review_status" != "200" ||
  "$comment_duplicate_status" != "409" ||
  "$(jq -r '.data.status' /tmp/community-e2e-comment-review.json)" != "approved" ]]; then
  echo "评价审核状态机验收失败。" >&2
  exit 1
fi

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page packages/social/community/detail \
  --query "id=$CHILD_POST_ID&mode=post" >/dev/null
assert_present "#detail-comment-$COMMENT_ID.business-detail-comment--approved"
if [[ "$(element_text '.business-detail-comments__heading')" != *"评论 1"* ]]; then
  echo "评价审核通过后公开计数不是 1。" >&2
  exit 1
fi
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$COMMENT_SCREENSHOT" \
  --wait-for-selector "#detail-comment-$COMMENT_ID" >/dev/null

# 回复：取消回复会清空目标；重新回复时请求携带直接父评论 ID，待审核内容本地可见。
step "评论回复目标、取消状态与待审核线程"
tap "#detail-comment-reply-$COMMENT_ID"
assert_present "#business-comment-replying-$COMMENT_ID"
input_text "#business-comment-campus_circle_post-$CHILD_POST_ID" "$CANCELLED_REPLY_CONTENT"
tap "#business-comment-cancel-reply-$COMMENT_ID"
assert_absent "#business-comment-replying-$COMMENT_ID"
cancelled_reply_count="$(mysql_query "SELECT COUNT(*) FROM comments WHERE content = '$CANCELLED_REPLY_CONTENT';")"
if [[ "$cancelled_reply_count" != "0" ]]; then
  echo "取消回复后不应把回复草稿误发为根评论。" >&2
  exit 1
fi

tap "#detail-comment-reply-$COMMENT_ID"
input_text "#business-comment-campus_circle_post-$CHILD_POST_ID" "$REPLY_CONTENT"
tap "#business-comment-submit-campus_circle_post-$CHILD_POST_ID"

REPLY_ID="$(mysql_query "SELECT id FROM comments WHERE content = '$REPLY_CONTENT' ORDER BY id DESC LIMIT 1;")"
reply_row="$(mysql_query "SELECT CONCAT(parent_id, ':', root_id, ':', status, ':', version) FROM comments WHERE id = $REPLY_ID;")"
if [[ "$reply_row" != "$COMMENT_ID:$COMMENT_ID:pending_review:1" ]]; then
  echo "评论回复的父级、根节点或审核状态错误：$reply_row" >&2
  exit 1
fi
capture_network POST /api/v1/comments 201
assert_present "#detail-comment-$REPLY_ID.business-detail-comment__reply--pending_review"
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$REPLY_SCREENSHOT" \
  --wait-for-selector "#detail-comment-$REPLY_ID" >/dev/null

# 列表分页与搜索使用隔离夹具，业务板块仍来自服务端。
step "列表分页与搜索"
mysql_query "
  INSERT INTO campus_circle_posts
    (section_id, author_id, content, status, published_at, version)
  WITH RECURSIVE sequence AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM sequence WHERE n < 21
  )
  SELECT
    $ROOT_ID,
    $MEMBER_ID,
    CONCAT('$RUN_ID-PAGE-', LPAD(n, 2, '0'), ' 分页列表夹具'),
    'approved',
    UTC_TIMESTAMP(3) - INTERVAL n SECOND,
    2
  FROM sequence;
" >/dev/null

wechat simulator_open_page \
  --project "$MINIAPP_DIR" \
  --page pages/community/index >/dev/null
tap '.life-primary-tabs__item:nth-child(1)'
tap "#community-section-$ROOT_ID"
assert_present '#community-load-more'
first_page_count="$(query_count '.api-post' 1)"
if [[ "$first_page_count" != "20" ]]; then
  echo "社区第一页应为 20 条，实际为 ${first_page_count}。" >&2
  exit 1
fi
wechat automation_viewport_action \
  --project "$MINIAPP_DIR" \
  --action pageScrollTo \
  --scroll-top 100000 >/dev/null
loaded_count="$(query_count '.api-post' 3)"
if (( loaded_count <= 20 )); then
  echo "上滑触底后列表没有自动追加数据。" >&2
  exit 1
fi
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$PAGINATION_SCREENSHOT" \
  --wait-for-selector ".api-post" >/dev/null

input_text '#community-search-input' "$PARENT_MARKER"
tap '#community-search-submit'
search_count="$(query_count '.api-post' 2)"
if [[ "$search_count" != "1" ]]; then
  echo "按唯一内容标识搜索应返回 1 条，实际为 ${search_count}。" >&2
  exit 1
fi
assert_present "#community-post-$PARENT_POST_ID"

capture_network
for expected in \
  $'GET\t/api/v1/campus-circle/sections\t200' \
  $'POST\t/api/v1/campus-circle/posts\t201' \
  $'POST\t/api/v1/comments\t201'; do
  expected_method="${expected%%$'\t'*}"
  expected_rest="${expected#*$'\t'}"
  expected_path="${expected_rest%%$'\t'*}"
  expected_status="${expected_rest##*$'\t'}"
  if ! awk -F '\t' \
    -v method="$expected_method" \
    -v path="$expected_path" \
    -v status="$expected_status" '
      $1 == method && index($2, path) && $3 == status { found = 1 }
      END { exit found ? 0 : 1 }
    ' <<<"$NETWORK_EVIDENCE"; then
    echo "模拟器网络日志缺少预期响应：$expected_method $expected_path $expected_status" >&2
    exit 1
  fi
done
if awk -F '\t' '$3 >= 500 && $3 <= 599 { found = 1 } END { exit found ? 0 : 1 }' <<<"$NETWORK_EVIDENCE"; then
  echo "社区 E2E 期间出现接口 5xx。" >&2
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
echo "社区上线级 E2E 通过：动态板块、父/子模块发帖、审核、评价、列表隔离、分页和搜索均符合预期。"
echo "取证截图："
echo "- $PARENT_SCREENSHOT"
echo "- $COMMENT_SCREENSHOT"
echo "- $REPLY_SCREENSHOT"
echo "- $PAGINATION_SCREENSHOT"
