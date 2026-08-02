import { DomUtils, ElementType, parseDocument } from 'htmlparser2'

export type HTMLNode = any

export const parseHTML = (body: string): HTMLNode => parseDocument(body)

export const isElement = (node: HTMLNode, tag?: string) => (
  !!node
  && (node.type === ElementType.Tag || node.type === ElementType.Script
    || node.type === ElementType.Style)
  && (!tag || String(node.name || '').toLowerCase() === tag.toLowerCase())
)

export const attribute = (node: HTMLNode, name: string) => {
  if (!isElement(node)) return ''
  const key = Object.keys(node.attribs || {}).find((candidate) => (
    candidate.toLowerCase() === name.toLowerCase()
  ))
  return key ? String(node.attribs[key] || '') : ''
}

export const hasAttribute = (node: HTMLNode, name: string) => {
  if (!isElement(node)) return false
  return Object.keys(node.attribs || {}).some((candidate) => (
    candidate.toLowerCase() === name.toLowerCase()
  ))
}

export const hasClass = (node: HTMLNode, className: string) => (
  attribute(node, 'class').split(/\s+/).includes(className)
)

export const children = (node: HTMLNode) => (
  Array.isArray(node?.children) ? node.children : []
)

export const findAll = (
  node: HTMLNode,
  predicate: (candidate: HTMLNode) => boolean,
) => DomUtils.findAll(predicate, children(node))

export const findFirst = (
  node: HTMLNode,
  predicate: (candidate: HTMLNode) => boolean,
) => DomUtils.findOne(predicate, children(node), true)

export const compactText = (node: HTMLNode) => (
  DomUtils.textContent(node).replace(/[\s\u00a0]+/g, ' ').trim()
)

const collectVisibleText = (
  node: HTMLNode,
  inheritedHidden: boolean,
  output: string[],
) => {
  const hidden = inheritedHidden || elementIsHidden(node)
  if (!hidden && node?.type === ElementType.Text) {
    output.push(String(node.data || ''))
  }
  children(node).forEach((child) => collectVisibleText(child, hidden, output))
}

export const visibleText = (node: HTMLNode) => {
  const output: string[] = []
  collectVisibleText(node, false, output)
  return output.join(' ').replace(/[\s\u00a0]+/g, ' ').trim()
}

export const directTableCells = (row: HTMLNode) => (
  children(row).filter((node) => isElement(node, 'td') || isElement(node, 'th'))
)

export const directTableRows = (table: HTMLNode) => {
  const result: HTMLNode[] = []
  const visit = (node: HTMLNode) => {
    children(node).forEach((child) => {
      if (isElement(child, 'table')) return
      if (isElement(child, 'tr')) result.push(child)
      else visit(child)
    })
  }
  visit(table)
  return result
}

export const positiveSpan = (node: HTMLNode, name: 'rowspan' | 'colspan') => {
  const value = Number.parseInt(attribute(node, name), 10)
  return Number.isInteger(value) && value > 0 ? value : 1
}

export const splitLabeledText = (value: string): [string, string] => {
  const index = value.search(/[：:]/)
  if (index < 0) return ['', '']
  return [value.slice(0, index).trim(), value.slice(index + 1).trim()]
}

export const elementIsHidden = (node: HTMLNode) => {
  if (!isElement(node)) return false
  const tag = String(node.name || '').toLowerCase()
  if (['script', 'style', 'template'].includes(tag)) return true
  if (tag === 'input' && attribute(node, 'type').trim().toLowerCase() === 'hidden') {
    return true
  }
  if (hasAttribute(node, 'hidden')) return true
  if (attribute(node, 'aria-hidden').trim().toLowerCase() === 'true') return true
  const style = attribute(node, 'style').replace(/\s+/g, '').toLowerCase()
  if (style.includes('display:none') || style.includes('visibility:hidden')) return true
  return attribute(node, 'class')
    .toLowerCase()
    .split(/\s+/)
    .some((name) => ['hidden', 'hide', 'd-none'].includes(name))
}

export const isChallengeControlName = (name: string) => {
  const value = name.toLowerCase()
  return value.includes('captcha')
    || value.includes('verifycode')
    || value.includes('verify_code')
    || value.includes('verify-code')
}

export const detectInteractiveChallenge = (body: string) => {
  const trimmed = body.replace(/^\ufeff/, '').trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  const root = parseHTML(trimmed)
  const inputs = findAll(root, (node) => isElement(node, 'input'))
  const hasLoginForm = inputs.some((node) => (
    ['username', 'password'].includes(attribute(node, 'name').trim().toLowerCase())
  ))
  const hasVisibleControl = inputs.some((node) => {
    let current: HTMLNode = node
    while (current) {
      if (elementIsHidden(current)) return false
      current = current.parent
    }
    return isChallengeControlName(attribute(node, 'name').trim())
  })
  if (hasVisibleControl) return true
  const text = visibleText(root)
  if (['请完成验证码', '请输入验证码', '滑动验证', '设备确认'].some(
    (candidate) => text.includes(candidate),
  )) return true
  if (hasLoginForm) return false
  return findAll(root, (node) => (
    isElement(node)
    && ['title', 'h1', 'h2'].includes(String(node.name || '').toLowerCase())
    && visibleText(node).includes('安全验证')
  )).length > 0
}

export interface HTMLTable {
  headers: string[]
  rows: HTMLNode[][]
}

export const htmlTables = (body: string): HTMLTable[] => {
  const root = parseHTML(body)
  return findAll(root, (node) => isElement(node, 'table'))
    .map((table) => {
      const rows = directTableRows(table).map(directTableCells).filter((cells) => cells.length)
      const headerIndex = rows.findIndex((cells) => cells.some((cell) => isElement(cell, 'th')))
      if (headerIndex < 0) return null
      return {
        headers: rows[headerIndex].map(compactText),
        rows: rows.slice(headerIndex + 1),
      }
    })
    .filter((table): table is HTMLTable => !!table)
}

export const headersContain = (headers: string[], expected: string) => (
  headers.some((header) => header.trim() === expected.trim())
)

export const findHTMLTable = (body: string, requiredHeaders: string[]) => (
  htmlTables(body).find((table) => (
    requiredHeaders.every((header) => headersContain(table.headers, header))
  )) || null
)

export const tableObjectRows = (table: HTMLTable) => (
  table.rows.map((cells) => Object.fromEntries(
    table.headers.map((header, index) => [header, cells[index] ? compactText(cells[index]) : '']),
  ))
)
