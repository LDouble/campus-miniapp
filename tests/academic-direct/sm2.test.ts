import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  base64ForAcademicTest,
  encryptSM2Password,
} from '../../src/features/academic-direct/sm2'

const { sm2 } = require('sm-crypto')
const sm2Utils = require('sm-crypto/src/sm2/utils')

test('SM2 使用注入的安全随机字节生成可解密的 C1C3C2 密文', async () => {
  const keypair = sm2.generateKeyPairHex('123456789abcdef', 16)
  const encodedPublicKey = base64ForAcademicTest.encode(
    sm2Utils.hexToArray(keypair.publicKey),
  )
  let requestedLength = 0
  const encrypted = await encryptSM2Password(
    '测试密码-Aa123!',
    encodedPublicKey,
    async (length) => {
      requestedLength = length
      return Uint8Array.from(
        Array.from({ length }, (_, index) => (index * 17 + 11) & 0xff),
      )
    },
  )
  const encryptedHex = sm2Utils.arrayToHex(
    base64ForAcademicTest.decode(encrypted),
  )

  assert.equal(requestedLength, 32)
  assert.equal(encryptedHex.startsWith('04'), true)
  assert.equal(
    sm2.doDecrypt(encryptedHex.slice(2), keypair.privateKey, 1),
    '测试密码-Aa123!',
  )
})
