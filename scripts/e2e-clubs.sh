#!/usr/bin/env bash
set -euo pipefail

MINIAPP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVIEW_CONTROL_DIR="${CAMPUS_REVIEW_CONTROL_DIR:-$HOME/.local/share/campus/control/review}"
REVIEW_MANAGED_ENV="${CAMPUS_REVIEW_MANAGED_ENV:-$REVIEW_CONTROL_DIR/managed.env}"
WECHATIDE_CLIENT="${WECHATIDE_CLIENT:-Codex}"
API_BASE_URL="${CAMPUS_E2E_API_BASE_URL:-https://review.weouc.com}"
FIXTURE_FILE="$MINIAPP_DIR/scripts/fixtures/clubs-e2e-native.js"
RUN_ID="E2E-CLUB-$(date +%s)-$RANDOM"
CLUB_NAME="海洋影像社-$RUN_ID"
SCREENSHOT_DIR="$MINIAPP_DIR/.local/e2e-clubs"
SCREENSHOT_FILE="$SCREENSHOT_DIR/published-version-stays-visible.png"
DIRECTORY_SCREENSHOT_FILE="$SCREENSHOT_DIR/directory-index.png"
CLUB_ID=''
CREATED_CATEGORY_ID=''
CREATED_CATEGORY_VERSION=''
CATEGORY_CLEANUP_ROWS=''
ADMIN_TOKEN=''
MEMBER_TOKEN=''

for command in curl jq wechatide; do
  if ! command -v "$command" >/dev/null; then
    echo "缺少社团 E2E 依赖命令：$command" >&2
    exit 1
  fi
done
if [[ ! -f "$REVIEW_MANAGED_ENV" ]]; then
  echo "缺少 review 管理凭据文件：$REVIEW_MANAGED_ENV" >&2
  exit 1
fi
if [[ ! -f "$FIXTURE_FILE" ]]; then
  echo "缺少原生媒体 fixture：$FIXTURE_FILE" >&2
  exit 1
fi

wechat() {
  wechatide -c "$WECHATIDE_CLIENT" "$@"
}

step() {
  echo "→ $1"
}

review_curl() {
  curl --noproxy '*' "$@"
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

evaluate() {
  local source="$1"
  local result attempt
  for attempt in 1 2 3; do
    result="$(
      wechat automation_evaluate \
        --project "$MINIAPP_DIR" \
        --fn-source "$source" || true
    )"
    if jq -e '.ok == true and .result.success == true' <<<"$result" >/dev/null; then
      printf '%s\n' "$result"
      return 0
    fi
    if [[ "$attempt" != "3" ]]; then sleep 1; fi
  done
  printf '%s\n' "$result"
  return 1
}

open_page() {
  local page="$1"
  local query="${2:-}"
  if [[ -n "$query" ]]; then
    wechat simulator_open_page --project "$MINIAPP_DIR" --page "$page" --query "$query" >/dev/null
  else
    wechat simulator_open_page --project "$MINIAPP_DIR" --page "$page" >/dev/null
  fi
}

scroll_page() {
  local scroll_top="$1"
  wechat automation_viewport_action \
    --project "$MINIAPP_DIR" \
    --action pageScrollTo \
    --scroll-top "$scroll_top" >/dev/null
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
  local wait="${2:-5}"
  if ! query_element "$selector" "$wait" |
    jq -e '.ok == true and .result.success == true and .result.element != null' >/dev/null; then
    echo "页面缺少预期元素：$selector" >&2
    evaluate "() => ({
      mediaFixture: wx.__clubE2EDebug || null,
      mediaBatch: wx.getStorageSync('campus.club.e2e.native.v1'),
    })" >&2 || true
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
  local wait="${2:-2}"
  wechat automation_page_action \
    --project "$MINIAPP_DIR" \
    --action querySelectorAll \
    --selector "$selector" \
    --wait "$wait" |
    jq -er '.result.elements | length'
}

tap() {
  local selector="$1"
  local wait="${2:-0}"
  local result
  result="$(
    wechat automation_element_action \
      --project "$MINIAPP_DIR" \
      --action tap \
      --selector "$selector" \
      --wait "$wait" \
      --wait-for-selector "$selector" || true
  )"
  if ! jq -e '.ok == true and .result.success == true' <<<"$result" >/dev/null; then
    echo "点击元素失败：$selector" >&2
    jq '{ok, errorType, message, reason}' <<<"$result" >&2 || true
    exit 1
  fi
}

input_text() {
  local selector="$1"
  local value="$2"
  local result
  result="$(
    wechat automation_element_action \
      --project "$MINIAPP_DIR" \
      --action input \
      --selector "$selector" \
      --value "$value" \
      --wait-for-selector "$selector" || true
  )"
  if ! jq -e '.ok == true and .result.success == true' <<<"$result" >/dev/null; then
    echo "输入元素失败：$selector" >&2
    exit 1
  fi
}

select_first_category() {
  local result
  result="$(
    wechat automation_element_action \
      --project "$MINIAPP_DIR" \
      --action trigger \
      --selector '#club-category-picker' \
      --type change \
      --detail '{"value":0}' \
      --wait-for-selector '#club-category-picker' || true
  )"
  if ! jq -e '.ok == true and .result.success == true' <<<"$result" >/dev/null; then
    echo "选择社团分类失败。" >&2
    exit 1
  fi
}

admin_post() {
  local path="$1"
  local key="$2"
  local body="$3"
  review_curl -fsS \
    -X POST \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $key" \
    -d "$body" \
    "$API_BASE_URL$path"
}

install_media_fixture() {
  local fixture_source fixture_result
  fixture_source="$(<"$FIXTURE_FILE")"
  fixture_result="$(evaluate "$fixture_source" || true)"
  if ! jq -e '
    .result.result.result.installed == true
    and .result.result.result.taroPatched == true
  ' <<<"$fixture_result" >/dev/null; then
    echo "原生媒体 fixture 安装失败。" >&2
    exit 1
  fi
}

refresh_member_token() {
  MEMBER_TOKEN="$(
    evaluate "() => wx.getStorageSync('campus.auth.accessToken.v1')" |
      jq -er '.result.result.result'
  )"
}

cleanup() {
  local status="$1"
  set +e
  if [[ -n "$CLUB_ID" && -n "$ADMIN_TOKEN" ]]; then
    editor="$(
      review_curl -fsS \
        -H "Authorization: Bearer $MEMBER_TOKEN" \
        "$API_BASE_URL/api/v1/clubs/$CLUB_ID/editor" 2>/dev/null || true
    )"
    version="$(jq -r '.data.version // empty' <<<"$editor" 2>/dev/null)"
    if [[ -n "$version" ]]; then
      admin_post \
        "/api/v1/admin/clubs/$CLUB_ID/visibility" \
        "$RUN_ID-cleanup-suspend" \
        "{\"expected_version\":$version,\"status\":\"suspended\"}" >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$CATEGORY_CLEANUP_ROWS" && -n "$ADMIN_TOKEN" ]]; then
    while IFS=$'\t' read -r category_id category_version; do
      [[ -n "$category_id" && -n "$category_version" ]] || continue
      admin_post \
        "/api/v1/admin/club-categories/$category_id/status" \
        "$RUN_ID-cleanup-category-$category_id" \
        "{\"expected_version\":$category_version,\"status\":\"archived\"}" >/dev/null 2>&1 || true
    done <<<"$CATEGORY_CLEANUP_ROWS"
  fi
  evaluate "() => {
    const original = wx.__clubE2ENativeOriginal
    if (original) {
      wx.chooseMedia = original.chooseMedia
      wx.cropImage = original.cropImage
      wx.showModal = original.showModal
      const taro = wx.__clubE2ETaro
      if (taro) {
        taro.chooseMedia = original.taroChooseMedia
        taro.cropImage = original.taroCropImage
        taro.getFileInfo = original.taroGetFileInfo
        taro.getImageInfo = original.taroGetImageInfo
        taro.showModal = original.taroShowModal
        taro.showToast = original.taroShowToast
      }
    }
    wx.removeStorageSync('campus.club.e2e.native.v1')
    delete wx.__clubE2ENativeOriginal
    delete wx.__clubE2ETaro
    delete wx.__clubE2EDebug
    return true
  }" >/dev/null 2>&1 || true
  trap - EXIT
  exit "$status"
}
trap 'cleanup $?' EXIT

step "检查 review API、管理员凭据与微信开发者工具"
ready="$(review_curl -fsS "$API_BASE_URL/health/ready")"
if [[ "$(jq -r '.data.status' <<<"$ready")" != 'ready' ]]; then
  echo "review API 未 ready：$API_BASE_URL" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$REVIEW_MANAGED_ENV"
set +a
login_payload="$(jq -cn \
  --arg username "$CAMPUS_ADMIN_USERNAME" \
  --arg password "$CAMPUS_ADMIN_PASSWORD" \
  '{username:$username,password:$password}')"
ADMIN_TOKEN="$(
  review_curl -fsS \
    -H 'Content-Type: application/json' \
    -d "$login_payload" \
    "$API_BASE_URL/api/v1/auth/login" |
    jq -er '.data.access_token'
)"
wechat check_wechatide_status |
  jq -e '.ok == true and .result.loginExpired == false' >/dev/null
ensure_project_window
wechat simulator_refresh --project "$MINIAPP_DIR" >/dev/null

step "准备启用中的 review 社团分类"
categories="$(
  review_curl -fsS \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE_URL/api/v1/admin/club-categories"
)"
CATEGORY_ID="$(jq -r '[.data[] | select(.status == "active")][0].id // empty' <<<"$categories")"
CATEGORY_CLEANUP_ROWS="$(jq -r '.data[] | select(.status == "active" and .name == "E2E 社团分类") | [.id, .version] | @tsv' <<<"$categories")"
if [[ -z "$CATEGORY_ID" ]]; then
  created_category="$(admin_post \
    '/api/v1/admin/club-categories' \
    "$RUN_ID-create-category" \
    "{\"slug\":\"e2e-club-$RANDOM\",\"name\":\"E2E 社团分类\",\"sort_order\":9999}")"
  CATEGORY_ID="$(jq -er '.data.id' <<<"$created_category")"
  CREATED_CATEGORY_ID="$CATEGORY_ID"
  CREATED_CATEGORY_VERSION="$(jq -er '.data.version' <<<"$created_category")"
  CATEGORY_CLEANUP_ROWS="${CATEGORY_CLEANUP_ROWS}${CATEGORY_CLEANUP_ROWS:+$'\n'}$CREATED_CATEGORY_ID"$'\t'"$CREATED_CATEGORY_VERSION"
fi

step "重置媒体选择批次；上传仍使用 review 返回的真实 COS 凭证"
evaluate "() => { wx.removeStorageSync('campus.club.e2e.native.v1'); return true }" >/dev/null

step "通过真实创建页上传 Logo 与两张宣传图并提交审核"
# 每次先经过一个不同页面，避免开发者工具在重复打开同一路由时把媒体桩安装到
# 即将卸载的旧页面实例上。
open_page pages/clubs/index
assert_present '#club-search'
open_page pages/clubs/edit
assert_present '#club-name'
install_media_fixture
refresh_member_token
verification="$(
  review_curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/academic-verification"
)"
if [[ "$(jq -r '.data.identity.status // empty' <<<"$verification")" != 'verified' ]]; then
  echo "当前微信 E2E 账号未完成 review 校园认证，请先在开发者工具完成认证。" >&2
  exit 1
fi
input_text '#club-name' "$CLUB_NAME"
select_first_category
input_text '#club-summary' '用镜头记录校园与海洋，让每一次快门都成为共同记忆。'
input_text '#club-description' '海洋影像社面向全校同学开展摄影分享与校园记录。我们定期组织主题拍摄、作品交流和影像策展，让成员在实践中提升表达能力。'
scroll_page 520
tap '#club-logo-picker' 1
assert_present '[id^="club-logo-media-"]' 10
scroll_page 980
tap '#club-gallery-add' 1
if [[ "$(query_count '.club-gallery-draft' 2)" != '2' ]]; then
  echo "首次多图上传未形成两张宣传图。" >&2
  exit 1
fi
for _ in 1 2 3; do
  [[ "$(query_count '[id^="club-gallery-draft-"]' 10)" == '2' ]] && break
  [[ "$(query_count '.club-gallery-draft__retry' 1)" -gt 0 ]] || continue
  tap '.club-gallery-draft__retry' 1
done
if [[ "$(query_count '[id^="club-gallery-draft-"]' 2)" != '2' ]]; then
  echo "首次多图上传重试后仍未全部完成。" >&2
  exit 1
fi
tap '#club-submit-review'
assert_present '.my-club-card'
refresh_member_token

mine="$(
  review_curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/clubs/mine?page=1&page_size=100"
)"
CLUB_ID="$(jq -er --arg name "$CLUB_NAME" '.data.items[] | select(.name == $name) | .id' <<<"$mine")"
first_version="$(jq -er --arg name "$CLUB_NAME" '.data.items[] | select(.name == $name) | .version' <<<"$mine")"
first_working_ids="$(jq -c --arg name "$CLUB_NAME" '[.data.items[] | select(.name == $name) | .working_revision.gallery[].media_id]' <<<"$mine")"
if [[ "$(jq 'length' <<<"$first_working_ids")" != '2' ]]; then
  echo "首次待审修订没有两张宣传图。" >&2
  exit 1
fi

step "管理员在 review 审核通过并验证公开详情"
admin_post \
  "/api/v1/admin/clubs/$CLUB_ID/review" \
  "$RUN_ID-first-approve" \
  "{\"expected_version\":$first_version,\"approved\":true}" >/dev/null
public_before="$(
  review_curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/clubs/$CLUB_ID"
)"
published_ids="$(jq -c '[.data.gallery[].media_id]' <<<"$public_before")"
if [[ "$published_ids" != "$first_working_ids" ]]; then
  echo "初次审核没有整体发布待审图集。" >&2
  exit 1
fi
FIRST_MEDIA_ID="$(jq -r '.[0]' <<<"$published_ids")"
SECOND_MEDIA_ID="$(jq -r '.[1]' <<<"$published_ids")"

step "验证社团广场卡片、字母目录与索引跳转"
directory_result="$(
  review_curl -fsS -G \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    --data-urlencode "keyword=$CLUB_NAME" \
    "$API_BASE_URL/api/v1/clubs/directory"
)"
DIRECTORY_INITIAL="$(jq -er --argjson id "$CLUB_ID" '.data.groups[] as $group | $group.items[] | select(.id == $id) | select(.name_initial == $group.initial) | .name_initial' <<<"$directory_result")"
if [[ "$DIRECTORY_INITIAL" == '#' ]]; then
  DIRECTORY_SECTION='other'
else
  DIRECTORY_SECTION="$DIRECTORY_INITIAL"
fi
open_page pages/clubs/index
assert_present '#club-search'
input_text '#club-search' "$CLUB_NAME"
tap '#club-search-action'
assert_present "#club-card-$CLUB_ID"
tap '#club-view-directory'
assert_present "#club-directory-section-$DIRECTORY_SECTION"
assert_present "#club-directory-row-$CLUB_ID"
tap "#club-index-$DIRECTORY_SECTION"
mkdir -p "$SCREENSHOT_DIR"
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$DIRECTORY_SCREENSHOT_FILE" >/dev/null
tap "#club-directory-row-$CLUB_ID"
assert_present "#club-gallery-image-$FIRST_MEDIA_ID"
assert_present "#club-gallery-image-$SECOND_MEDIA_ID"

step "通过真实编辑页替换一张宣传图并再次提交审核"
open_page pages/clubs/edit "id=$CLUB_ID"
assert_present "#club-gallery-draft-$FIRST_MEDIA_ID"
install_media_fixture
scroll_page 980
tap "#club-gallery-draft-$FIRST_MEDIA_ID .club-gallery-draft__delete" 1
assert_absent "#club-gallery-draft-$FIRST_MEDIA_ID"
tap '#club-gallery-add' 1
if [[ "$(query_count '[id^="club-gallery-draft-"]' 10)" != '2' ]]; then
  echo "二次编辑没有保持两张宣传图。" >&2
  exit 1
fi
tap '#club-submit-review'
assert_present "#my-club-$CLUB_ID"
refresh_member_token

editor_pending="$(
  review_curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/clubs/$CLUB_ID/editor"
)"
pending_status="$(jq -r '.data.working_revision.status' <<<"$editor_pending")"
pending_ids="$(jq -c '[.data.working_revision.gallery[].media_id]' <<<"$editor_pending")"
NEW_MEDIA_ID="$(jq -r --argjson old "$SECOND_MEDIA_ID" '[.data.working_revision.gallery[].media_id | select(. != $old)][0]' <<<"$editor_pending")"
if [[ "$pending_status" != 'pending_review' || "$pending_ids" == "$published_ids" ]]; then
  echo "二次修改没有形成独立待审图集。" >&2
  exit 1
fi

step "验证待审期间公众继续看到完整旧图集"
public_during="$(
  review_curl -fsS \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    "$API_BASE_URL/api/v1/clubs/$CLUB_ID"
)"
if [[ "$(jq -c '[.data.gallery[].media_id]' <<<"$public_during")" != "$published_ids" ]]; then
  echo "待审期间公开图集被提前切换。" >&2
  exit 1
fi
open_page pages/clubs/detail "id=$CLUB_ID"
assert_present "#club-gallery-image-$FIRST_MEDIA_ID"
assert_present "#club-gallery-image-$SECOND_MEDIA_ID"
assert_absent "#club-gallery-image-$NEW_MEDIA_ID"
tap "#club-gallery-image-$FIRST_MEDIA_ID"
assert_present '.club-viewer'
assert_present '#club-viewer-close'

mkdir -p "$SCREENSHOT_DIR"
wechat simulator_screenshot \
  --project "$MINIAPP_DIR" \
  --path "$SCREENSHOT_FILE" >/dev/null

echo "社团 review E2E 通过：真实页面、真实 API、真实 COS 多图上传、审核公开与待审版本隔离。"
echo "目录截图：$DIRECTORY_SCREENSHOT_FILE"
echo "版本隔离截图：$SCREENSHOT_FILE"
