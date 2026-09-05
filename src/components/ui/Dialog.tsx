import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

/** 统一处理键盘焦点、Esc 与遮罩关闭；内容继续使用各弹窗原有布局。 */
export function Dialog({ label, className = '', onClose, children }: {
  label: string
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => { closeRef.current = onClose }, [onClose])
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const controls = () => [...container.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter(element => !element.closest('[hidden], [inert]') && getComputedStyle(element).display !== 'none')
    const initial = container.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? controls()[0] ?? container
    initial.focus()
    const isTopDialog = () => [...document.querySelectorAll('[role="dialog"]')].at(-1) === container
    const handleKey = (event: KeyboardEvent) => {
      if (!isTopDialog()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const items = controls()
        const first = items[0] ?? container
        const last = items.at(-1) ?? container
        if (!container.contains(document.activeElement) || document.activeElement === container ||
          (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
      }
    }
    const containFocus = (event: FocusEvent) => {
      if (isTopDialog() && !container.contains(event.target as Node)) (controls()[0] ?? container).focus()
    }
    document.addEventListener('keydown', handleKey, true)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', handleKey, true)
      document.removeEventListener('focusin', containFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return <div ref={containerRef} className={`command-overlay ${className}`} role="dialog"
    aria-modal="true" aria-label={label} tabIndex={-1}
    onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    {children}
  </div>
}
