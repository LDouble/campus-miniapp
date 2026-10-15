import { strict as assert } from 'node:assert'
import Module = require('node:module')
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const originalLoad = Module._load
const taroElement = (tagName: string) => (props: Record<string, unknown>) => {
  const {
    ariaRole,
    ariaLabel,
    mode,
    lazyLoad,
    children,
    ...attributes
  } = props
  return React.createElement(tagName, {
    ...attributes,
    role: ariaRole,
    'aria-label': ariaLabel,
  }, children as React.ReactNode)
}

Module._load = function loadAffiliateProductCard(request, parent, isMain) {
  if (request === '@tarojs/components') {
    return {
      Image: taroElement('img'),
      Text: taroElement('span'),
      View: taroElement('div'),
    }
  }
  if (request.endsWith('.scss')) return {}
  return originalLoad.call(this, request, parent, isMain)
}

try {
  const AffiliateProductCard = require('../src/features/affiliate/components/product-card').default
  const markup = renderToStaticMarkup(React.createElement(AffiliateProductCard, {
    product: {
      id: 41,
      title: '示例商品',
      image_url: 'https://img.example/product.jpg',
      coupon_status: 'active',
      coupon_amount: '10',
      coupon_condition: '满 100 元可用',
      actual_price: '29.90',
      original_price: '39.90',
      availability: 'valid',
    },
    canConvert: true,
    onBuy: () => undefined,
  }))

  assert.ok(markup.includes('class="affiliate-product-card__promotion"'), '商品卡应包含推广标识区域')
  assert.ok(markup.includes('>推广</div>'), '商品卡应明确展示“推广”标识')
  assert.ok(markup.includes('src="https://img.example/product.jpg"'), '商品卡应继续展示有效商品图片')
} finally {
  Module._load = originalLoad
}

console.log('Affiliate product card UI smoke passed')
