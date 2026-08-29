import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  defaultProductionApiBaseUrl,
  defaultReviewApiBaseUrl,
  loadApiEndpoints,
} from '../config/api-endpoints'
import {
  normalizeMiniProgramEnvVersion,
  resolveApiBaseUrl,
} from '../src/api/environment'

const endpoints = {
  review: 'https://review-api.example.invalid/',
  production: 'https://api.example.invalid',
}

assert.equal(resolveApiBaseUrl('develop', endpoints), 'https://review-api.example.invalid')
assert.equal(resolveApiBaseUrl('trial', endpoints), 'https://api.example.invalid')
assert.equal(resolveApiBaseUrl('release', endpoints), 'https://api.example.invalid')
assert.equal(resolveApiBaseUrl('unexpected', endpoints), 'https://review-api.example.invalid')
assert.equal(normalizeMiniProgramEnvVersion(undefined), 'develop')

assert.deepEqual(loadApiEndpoints({ TARO_APP_API_BASE_URL: 'http://localhost:8080/' }, false), {
  review: 'http://localhost:8080',
  production: defaultProductionApiBaseUrl,
})
assert.deepEqual(loadApiEndpoints({
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.production,
}, true), {
  review: defaultReviewApiBaseUrl,
  production: 'https://api.example.invalid',
})
assert.deepEqual(loadApiEndpoints({}, true), {
  review: defaultReviewApiBaseUrl,
  production: defaultProductionApiBaseUrl,
})
assert.throws(() => loadApiEndpoints({
  TARO_APP_REVIEW_API_BASE_URL: 'http://review-api.example.invalid',
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.production,
}, true), /must use HTTPS/)
assert.throws(() => loadApiEndpoints({
  TARO_APP_REVIEW_API_BASE_URL: 'https://REVIEW-api.example.invalid',
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.review,
}, true), /must be distinct/)

const buildConfigSource = readFileSync(resolve(__dirname, '../config/index.ts'), 'utf8')
assert.match(
  buildConfigSource,
  /const buildApiEndpoints = \{\s*review: apiEndpoints\.production,\s*production: apiEndpoints\.production,?\s*\}/u,
  '小程序各构建环境必须统一注入 product 域名',
)

console.log('api environment smoke checks passed')
