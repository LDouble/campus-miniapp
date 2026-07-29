import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Input, Textarea } from '@tarojs/components'
import type { InputProps } from '@tarojs/components/types/Input'
import type { TextareaProps } from '@tarojs/components/types/Textarea'

type KeyboardVisibilityProps = {
  keepVisibleOnKeyboard?: boolean
  keyboardVisibilitySpacing?: number
  onKeyboardVisibilityChange?: (height: number) => void
}

type KeyboardSafeInputProps = Omit<InputProps, 'adjustPosition'> & KeyboardVisibilityProps
type KeyboardSafeTextareaProps = Omit<TextareaProps, 'adjustPosition'> & KeyboardVisibilityProps

const DEFAULT_CURSOR_SPACING = 18
const KEYBOARD_SCROLL_DURATION = 160
const KEYBOARD_LAYOUT_DELAY = 60

let controlSequence = 0

const useControlId = (id?: string) => {
  const fallbackId = useRef('')
  if (!fallbackId.current) {
    controlSequence += 1
    fallbackId.current = `keyboard-safe-control-${controlSequence}`
  }
  return id || fallbackId.current
}

const scrollControlIntoKeyboardViewport = (
  controlId: string,
  keyboardHeight: number,
  spacing: number,
  windowHeight: number,
) => {
  if (keyboardHeight <= 0) return

  const query = Taro.createSelectorQuery()
  query.select(`#${controlId}`).boundingClientRect()
  query.selectViewport().scrollOffset()
  query.exec((results) => {
    const rect = results[0] as { bottom?: number } | null
    const viewport = results[1] as { scrollTop?: number } | null
    const controlBottom = Number(rect?.bottom)
    const visibleBottom = windowHeight - keyboardHeight - spacing

    if (!Number.isFinite(controlBottom) || controlBottom <= visibleBottom) return

    void Taro.pageScrollTo({
      scrollTop: Math.max(
        0,
        Number(viewport?.scrollTop || 0) + controlBottom - visibleBottom,
      ),
      duration: KEYBOARD_SCROLL_DURATION,
    })
  })
}

const useKeyboardVisibilityScroll = (
  controlId: string,
  keepVisibleOnKeyboard: boolean,
  spacing: number,
) => {
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const windowHeight = useRef(Taro.getSystemInfoSync().windowHeight).current

  useEffect(() => () => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current)
  }, [])

  return useCallback((keyboardHeight: number) => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current)
    if (!keepVisibleOnKeyboard || keyboardHeight <= 0) return

    layoutTimer.current = setTimeout(() => {
      scrollControlIntoKeyboardViewport(
        controlId,
        keyboardHeight,
        spacing,
        windowHeight,
      )
    }, KEYBOARD_LAYOUT_DELAY)
  }, [controlId, keepVisibleOnKeyboard, spacing, windowHeight])
}

export function useKeyboardInset() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const onKeyboardVisibilityChange = useCallback((height: number) => {
    setKeyboardHeight(Math.max(0, height))
  }, [])

  return {
    keyboardHeight,
    onKeyboardVisibilityChange,
  }
}

export function KeyboardSafeInput({
  id,
  cursorSpacing = DEFAULT_CURSOR_SPACING,
  keepVisibleOnKeyboard = true,
  keyboardVisibilitySpacing = cursorSpacing,
  onKeyboardVisibilityChange,
  onFocus,
  onBlur,
  onKeyboardHeightChange,
  ...props
}: KeyboardSafeInputProps) {
  const controlId = useControlId(id)
  const keepControlVisible = useKeyboardVisibilityScroll(
    controlId,
    keepVisibleOnKeyboard,
    keyboardVisibilitySpacing,
  )

  return (
    <Input
      {...props}
      id={controlId}
      adjustPosition={false}
      cursorSpacing={cursorSpacing}
      onFocus={(event) => {
        onFocus?.(event)
        const height = Math.max(0, event.detail.height || 0)
        onKeyboardVisibilityChange?.(height)
        keepControlVisible(height)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        onKeyboardVisibilityChange?.(0)
      }}
      onKeyboardHeightChange={(event) => {
        onKeyboardHeightChange?.(event)
        const height = Math.max(0, event.detail.height || 0)
        onKeyboardVisibilityChange?.(height)
        keepControlVisible(height)
      }}
    />
  )
}

export function KeyboardSafeTextarea({
  id,
  cursorSpacing = DEFAULT_CURSOR_SPACING,
  keepVisibleOnKeyboard = true,
  keyboardVisibilitySpacing = cursorSpacing,
  onKeyboardVisibilityChange,
  onFocus,
  onBlur,
  onKeyboardHeightChange,
  ...props
}: KeyboardSafeTextareaProps) {
  const controlId = useControlId(id)
  const keepControlVisible = useKeyboardVisibilityScroll(
    controlId,
    keepVisibleOnKeyboard,
    keyboardVisibilitySpacing,
  )

  return (
    <Textarea
      {...props}
      id={controlId}
      adjustPosition={false}
      cursorSpacing={cursorSpacing}
      onFocus={(event) => {
        onFocus?.(event)
        const height = Math.max(0, event.detail.height || 0)
        onKeyboardVisibilityChange?.(height)
        keepControlVisible(height)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        onKeyboardVisibilityChange?.(0)
      }}
      onKeyboardHeightChange={(event) => {
        onKeyboardHeightChange?.(event)
        const height = Math.max(0, event.detail.height || 0)
        onKeyboardVisibilityChange?.(height)
        keepControlVisible(height)
      }}
    />
  )
}
