import * as assert from 'node:assert/strict'
import {
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
  production: 'http://localhost:8080',
})
assert.deepEqual(loadApiEndpoints({
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.production,
}, true), {
  review: defaultReviewApiBaseUrl,
  production: 'https://api.example.invalid',
})
assert.throws(() => loadApiEndpoints({}, true), /require isolated API URLs/)
assert.throws(() => loadApiEndpoints({
  TARO_APP_REVIEW_API_BASE_URL: 'http://review-api.example.invalid',
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.production,
}, true), /must use HTTPS/)
assert.throws(() => loadApiEndpoints({
  TARO_APP_REVIEW_API_BASE_URL: 'https://REVIEW-api.example.invalid',
  TARO_APP_PRODUCTION_API_BASE_URL: endpoints.review,
}, true), /must be distinct/)

console.log('api environment smoke checks passed')
