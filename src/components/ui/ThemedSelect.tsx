/**
 * 自绘下拉框。
 *
 * 不用原生 `<select>` 的原因：需要在选项里放图标，并且要跟随四套主题换肤。
 * 代价是要自己处理三件事：
 * 1. 点击外部/按 Esc 关闭；
 * 2. 空间不够时向上弹出；
 * 3. 无障碍属性（listbox / option / aria-selected）。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { SelectOption } from '../../types'

/** 菜单与触发器之间的间距，用于判断上下方是否放得下。 */
const MENU_GAP = 8

export function ThemedSelect({
  value,
  options,
  onChange,
  label,
  icon,
  className = '',
  compact = false,
  'aria-label': ariaLabel,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label?: string
  icon?: React.ReactNode
  className?: string
  compact?: boolean
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down')
  const selectRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 找不到匹配项时退回第一项，避免触发器显示空白。
  const selected = options.find((option) => option.value === value) ?? options[0]

  // 用 layout effect 在绘制前定好方向，否则会看到菜单"跳"一下。
  useLayoutEffect(() => {
    if (!open) return

    const updateMenuPlacement = () => {
      const selectElement = selectRef.current
      const menuElement = menuRef.current
      if (!selectElement || !menuElement) return

      const selectRect = selectElement.getBoundingClientRect()
      const menuHeight = menuElement.getBoundingClientRect().height
      const spaceBelow = window.innerHeight - selectRect.bottom - MENU_GAP
      const spaceAbove = selectRect.top - MENU_GAP

      // 下方放不下、且上方更宽敞时才向上弹。
      const nextPlacement = menuHeight > spaceBelow && spaceAbove > spaceBelow ? 'up' : 'down'
      setMenuPlacement((current) => (current === nextPlacement ? current : nextPlacement))
    }

    updateMenuPlacement()
    window.addEventListener('resize', updateMenuPlacement)
    // 捕获阶段监听：面板内部的滚动容器也要能触发重算。
    window.addEventListener('scroll', updateMenuPlacement, true)
    return () => {
      window.removeEventListener('resize', updateMenuPlacement)
      window.removeEventListener('scroll', updateMenuPlacement, true)
    }
  }, [open, options.length])

  // 点击页面任意处或按 Esc 都关闭；组件根节点会阻止自身点击冒泡。
  useEffect(() => {
    if (!open) return

    const handleClick = () => setOpen(false)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      ref={selectRef}
      className={[
        'themed-select',
        compact ? 'compact' : '',
        open ? 'open' : '',
        open && menuPlacement === 'up' ? 'drop-up' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => event.stopPropagation()}
    >
      {label && (
        <span className="themed-select-label">
          {icon}
          {label}
        </span>
      )}
      <button
        type="button"
        className="themed-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => {
          // 每次打开都先假设向下，再由 layout effect 校正。
          setMenuPlacement('down')
          setOpen((current) => !current)
        }}
      >
        {selected?.icon}
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div ref={menuRef} className="themed-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={option.value === value ? 'selected' : ''}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
