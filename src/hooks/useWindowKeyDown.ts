/**
 * 在 window 上监听键盘事件。
 *
 * 用 ref 转发回调，好处是监听器只在 `enabled` 变化时装卸一次，
 * 回调里引用的最新状态却始终是对的——不必把一堆依赖塞进 effect 的依赖数组。
 *
 * 注意：输入框里的按键如果不希望触发这里的快捷键，需要在该输入框的
 * onKeyDown 里调用 `event.stopPropagation()`（React 的事件挂在根节点上，
 * 阻止冒泡后原生事件就到不了 window）。
 */
import { useEffect, useRef } from 'react'

export const useWindowKeyDown = (
  handler: (event: KeyboardEvent) => void,
  enabled = true,
) => {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const listener = (event: KeyboardEvent) => handlerRef.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [enabled])
}
