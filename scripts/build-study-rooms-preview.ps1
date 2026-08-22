$ErrorActionPreference = 'Stop'

$env:TARO_APP_STUDY_ROOMS_PREVIEW = '1'
$env:TARO_APP_WECHAT_AI_ENABLED = '0'

yarn taro build --type weapp --env development
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Output '一起自习本地预览已构建到 dist/full。'
