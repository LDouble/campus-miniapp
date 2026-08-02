const { BigInteger } = require('jsbn')
const sm2Utils = require('sm-crypto/src/sm2/utils')
const { sm3 } = require('sm-crypto/src/sm2/sm3')

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export type SecureRandomBytes = (length: number) => Promise<Uint8Array>

const arrayToHex = (bytes: number[] | Uint8Array) => (
  Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
)

const base64Decode = (value: string) => {
  const input = value.replace(/\s+/g, '')
  if (!input || input.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(input)) {
    throw new Error('SM2 公钥编码无效')
  }
  const output: number[] = []
  for (let index = 0; index < input.length; index += 4) {
    const chunk = input.slice(index, index + 4)
    const values = [...chunk].map((character) => (
      character === '=' ? 0 : BASE64_ALPHABET.indexOf(character)
    ))
    if (values.some((item) => item < 0)) throw new Error('SM2 公钥编码无效')
    const combined = (
      (values[0] << 18)
      | (values[1] << 12)
      | (values[2] << 6)
      | values[3]
    )
    output.push((combined >>> 16) & 0xff)
    if (chunk[2] !== '=') output.push((combined >>> 8) & 0xff)
    if (chunk[3] !== '=') output.push(combined & 0xff)
  }
  return output
}

const base64Encode = (bytes: number[] | Uint8Array) => {
  const input = Array.from(bytes)
  let result = ''
  for (let index = 0; index < input.length; index += 3) {
    const first = input[index]
    const second = input[index + 1]
    const third = input[index + 2]
    const combined = (
      (first << 16)
      | ((second || 0) << 8)
      | (third || 0)
    )
    result += BASE64_ALPHABET[(combined >>> 18) & 0x3f]
    result += BASE64_ALPHABET[(combined >>> 12) & 0x3f]
    result += second === undefined ? '=' : BASE64_ALPHABET[(combined >>> 6) & 0x3f]
    result += third === undefined ? '=' : BASE64_ALPHABET[combined & 0x3f]
  }
  return result
}

export const taroSecureRandomBytes: SecureRandomBytes = async (length) => {
  if (!Number.isInteger(length) || length < 1 || length > 1024) {
    throw new Error('安全随机数长度无效')
  }
  const taroModule = require('@tarojs/taro')
  const runtime = taroModule.default || taroModule
  const result = await runtime.getRandomValues({ length })
  const bytes = new Uint8Array(result.randomValues)
  if (bytes.byteLength !== length) throw new Error('安全随机数生成失败')
  return bytes
}

const encryptRawC1C3C2 = async (
  message: string,
  publicKeyHex: string,
  randomBytes: SecureRandomBytes,
) => {
  if (
    publicKeyHex.length !== 130
    || !publicKeyHex.startsWith('04')
    || !/^[0-9a-f]+$/i.test(publicKeyHex)
    || !sm2Utils.verifyPublicKey(publicKeyHex)
  ) {
    throw new Error('SM2 公钥无效')
  }
  const keypair = sm2Utils.generateKeyPairHex(
    arrayToHex(await randomBytes(32)),
    16,
  )
  const privateScalar = new BigInteger(keypair.privateKey, 16)
  const publicPoint = sm2Utils.getGlobalCurve().decodePointHex(publicKeyHex)
  if (!publicPoint) throw new Error('SM2 公钥无效')

  const sharedPoint = publicPoint.multiply(privateScalar)
  const x2 = sm2Utils.hexToArray(
    sm2Utils.leftPad(sharedPoint.getX().toBigInteger().toRadix(16), 64),
  )
  const y2 = sm2Utils.hexToArray(
    sm2Utils.leftPad(sharedPoint.getY().toBigInteger().toRadix(16), 64),
  )
  const plain = sm2Utils.hexToArray(sm2Utils.utf8ToHex(message))
  const c3 = sm3([].concat(x2, plain, y2))

  let counter = 1
  let offset = 0
  let block: number[] = []
  const z = ([] as number[]).concat(x2, y2)
  const cipher = plain.map((byte) => {
    if (offset === block.length) {
      block = sm3([
        ...z,
        (counter >>> 24) & 0xff,
        (counter >>> 16) & 0xff,
        (counter >>> 8) & 0xff,
        counter & 0xff,
      ])
      counter += 1
      offset = 0
    }
    const result = byte ^ block[offset]
    offset += 1
    return result
  })
  const c1 = keypair.publicKey
  return `${c1}${arrayToHex(c3)}${arrayToHex(cipher)}`
}

export const encryptSM2Password = async (
  password: string,
  encodedPublicKey: string,
  randomBytes: SecureRandomBytes = taroSecureRandomBytes,
) => {
  const keyBytes = base64Decode(encodedPublicKey.trim())
  const publicKeyHex = arrayToHex(keyBytes)
  const encryptedHex = await encryptRawC1C3C2(password, publicKeyHex, randomBytes)
  return base64Encode(sm2Utils.hexToArray(encryptedHex))
}

export const base64ForAcademicTest = {
  encode: base64Encode,
  decode: base64Decode,
}
