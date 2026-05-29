import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  Globe2,
  Link,
  Mail,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  TimerReset,
  Trash2,
  Zap,
} from 'lucide-react'
import type { DashboardState, SelectOption, Task } from './types'
import { formatMinutes } from './utils'

export function PanelTitle({
  icon,
  title,
  aside,
}: {
  icon: React.ReactNode
  title: string
  aside?: string
}) {
  return (
    <div className="panel-title">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {aside && <span>{aside}</span>}
    </div>
  )
}

export function TaskRow({
  task,
  orderMoveDirection,
  onToggle,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  task: Task
  orderMoveDirection?: 'up' | 'down'
  onToggle: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  return (
    <li
      className={[
        'task-row',
        task.done ? 'done' : '',
        orderMoveDirection ? `order-moved move-${orderMoveDirection}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="check-button" onClick={onToggle}>
        {task.done ? <Check size={15} /> : <Circle size={15} />}
      </button>
      <span>{task.title}</span>
      <OrderControls
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
      <button
        type="button"
        className="icon-button danger"
        title="删除任务"
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

export function OrderControls({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="order-controls">
      <button
        type="button"
        className="icon-button"
        title="上移"
        aria-label="上移"
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        className="icon-button"
        title="下移"
        aria-label="下移"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDown size={14} />
      </button>
    </div>
  )
}

export function FocusControls({
  dashboard,
  focusLabel,
  onDurationChange,
  onStart,
  onPause,
  onReset,
}: {
  dashboard: DashboardState
  focusLabel: string
  onDurationChange: (durationMinutes: number) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  return (
    <div className="focus-console">
      <div className="timer-readout">
        <TimerReset size={18} />
        <strong>{formatMinutes(dashboard.focus.secondsLeft)}</strong>
        <span>{focusLabel}</span>
      </div>
      <div className="focus-controls">
        <div className="duration-stepper" aria-label="专注分钟数">
          <button
            type="button"
            title="减少 5 分钟"
            disabled={dashboard.focus.running}
            onClick={() =>
              onDurationChange(Math.max(5, dashboard.focus.durationMinutes - 5))
            }
          >
            <Minus size={14} />
          </button>
          <span>
            <strong>{dashboard.focus.durationMinutes}</strong>
            <small>分钟</small>
          </span>
          <button
            type="button"
            title="增加 5 分钟"
            disabled={dashboard.focus.running}
            onClick={() =>
              onDurationChange(Math.min(120, dashboard.focus.durationMinutes + 5))
            }
          >
            <Plus size={14} />
          </button>
        </div>
        {dashboard.focus.running ? (
          <button type="button" className="primary-action" onClick={onPause}>
            <Pause size={16} />
            暂停
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={onStart}>
            <Play size={16} />
            开始专注
          </button>
        )}
        <button type="button" className="secondary-action" onClick={onReset}>
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  )
}

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
  const selected = options.find((option) => option.value === value) ?? options[0]

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
      className={[
        'themed-select',
        compact ? 'compact' : '',
        open ? 'open' : '',
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
        onClick={() => setOpen((current) => !current)}
      >
        {selected?.icon}
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="themed-select-menu" role="listbox">
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

export function IconByName({ name }: { name: string }) {
  const props = { size: 20 }
  if (name === 'github') return <Globe2 {...props} />
  if (name === 'sparkles') return <Sparkles {...props} />
  if (name === 'zap') return <Zap {...props} />
  if (name === 'mail') return <Mail {...props} />
  if (name === 'calendar') return <CalendarClock {...props} />
  if (name === 'doc') return <Pencil {...props} />
  if (name === 'sun') return <Sun {...props} />
  if (name === 'star') return <Star {...props} />
  if (name === 'globe') return <Globe2 {...props} />
  return <Link {...props} />
}
