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
      coupon_start_at: '2000-01-01T00:00:00Z',
      coupon_end_at: '2999-01-01T00:00:00Z',
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
  const tile = (overrides: Record<string, unknown> = {}, canConvert = true) => renderToStaticMarkup(React.createElement(AffiliateProductCard, {
    layout: 'tile',
    product: {
      title: '双列商品',
      goods_id: '123',
      availability: 'valid',
      coupon_status: 'active',
      coupon_amount: '20',
      coupon_start_at: '2000-01-01T00:00:00Z',
      coupon_end_at: '2999-01-01T00:00:00Z',
      actual_price: '39.9',
      ...overrides,
    },
    canConvert,
    onBuy: () => undefined,
  }))
  assert.ok(tile().includes('affiliate-product-card--tile'), '首页使用双列卡片')
  const compactTile = tile({ shop_name: '测试店铺', coupon_condition: '满100元可用' })
  assert.ok(!compactTile.includes('测试店铺'), '首页卡片不额外堆叠店铺行，详情仍保留完整信息')
  assert.ok(!compactTile.includes('满100元可用'), '首页卡片不额外堆叠券门槛行')
  assert.ok(compactTile.includes('affiliate-product-card__price-prefix'), '有效券显示券后价格语义')
  const missingCouponDates = tile({ coupon_start_at: undefined, original_price: '50.00', actual_price: '39.90' })
  assert.ok(!missingCouponDates.includes('>券后</span>'), '缺少优惠券有效期时不宣称券后价')
  assert.ok(missingCouponDates.includes('>¥50.00</span>'), '缺少优惠券有效期时回退商品原价')
  assert.ok(!missingCouponDates.includes('affiliate-product-card__original-price'), '缺少优惠券有效期时不保留可能失效的券后价划线')
  assert.ok(tile().includes('>+</div>'), '可购双列卡片显示紧凑购买按钮')
  assert.ok(tile().includes('>推广</div>'), '双列布局保留推广披露')
  assert.ok(tile({ coupon_status: 'unknown', coupon_amount: undefined }).includes('优惠待核验'), '未知券状态不能被样式隐藏')
  assert.ok(!tile({}, false).includes('>+</div>'), '购买能力关闭时不得显示可操作加号')
  assert.ok(tile({}, false).includes('推广暂不可用'), '双列布局保留能力关闭提示')
  assert.ok(!tile({ original_price: '27.45', actual_price: '27.45' }).includes('affiliate-product-card__original-price'), '原价与当前价相同不显示删除线原价')
  const discountedPrice = tile({ original_price: '30.00', actual_price: '27.45' })
  assert.ok(discountedPrice.includes('affiliate-product-card__original-price'), '原价高于当前价时显示删除线原价')
  assert.ok(discountedPrice.includes('>¥30.00</span>'), '删除线区域展示真实原价金额')
  assert.ok(!tile({ original_price: '20.00', actual_price: '27.45' }).includes('affiliate-product-card__original-price'), '原价低于当前价时不显示删除线原价')
  assert.ok(!tile({ original_price: 'NaN', actual_price: '27.45' }).includes('affiliate-product-card__original-price'), '非法原价不得显示删除线')
  assert.ok(!tile({ original_price: '30.00', actual_price: '' }).includes('affiliate-product-card__original-price'), '当前价缺失时不得显示删除线原价')
} finally {
  Module._load = originalLoad
}

console.log('Affiliate product card UI smoke passed')
