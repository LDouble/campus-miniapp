import {
  decodeWebViewUrl,
  normalizeWebViewUrl,
} from '../src/features/webview/url'

const validUrls = [
  'https://example.com/path?q=%20',
  'HTTPS://sub.example.com:443/news?id=1',
]
const invalidUrls = [
  '',
  'http://example.com',
  'javascript:alert(1)',
  'data:text/html,unsafe',
  'https://user@example.com',
  'https://example..com',
  'https://example.com unsafe',
  'https://localhost/path',
]

for (const value of validUrls) {
  if (normalizeWebViewUrl(value) !== value) {
    throw new Error(`expected valid WebView URL: ${value}`)
  }
}

for (const value of invalidUrls) {
  if (normalizeWebViewUrl(value)) {
    throw new Error(`expected invalid WebView URL: ${value}`)
  }
}

const target = 'https://example.com/news?id=1'
if (decodeWebViewUrl(encodeURIComponent(target)) !== target) {
  throw new Error('encoded WebView URL was not decoded safely')
}

console.log('webview-url-smoke: ok')
