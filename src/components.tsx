import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  FileText,
  Globe2,
  Keyboard,
  Link,
  Mail,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  TimerReset,
  Trash2,
  X,
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
  onRename,
  maxLength = 80,
  focusMinutes,
  onProgressChange,
}: {
  task: Task
  orderMoveDirection?: 'up' | 'down'
  onToggle: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onRename?: (title: string) => void
  maxLength?: number
  focusMinutes?: number
  onProgressChange?: (value: number) => void
}) {
  const editable = Boolean(onRename)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const progressValue = task.progress ?? (task.done ? 100 : 0)

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== task.title) {
      onRename?.(next)
    }
    setEditing(false)
  }

  const cancelRename = () => {
    setDraft(task.title)
    setEditing(false)
  }

  const startEditing = () => {
    if (!editable) return
    setDraft(task.title)
    setEditing(true)
  }

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
      <div className="task-main">
        {editing ? (
          <input
            className="task-edit-input"
            value={draft}
            maxLength={maxLength}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelRename()
              }
            }}
          />
        ) : (
          <span
            className={editable ? 'task-title-editable' : ''}
            title={editable ? '双击编辑任务' : undefined}
            onDoubleClick={startEditing}
          >
            {task.title}
          </span>
        )}
        {focusMinutes && focusMinutes > 0 ? (
          <span className="task-focus-badge" title={`已专注 ${focusMinutes} 分钟`}>
            {focusMinutes}分
          </span>
        ) : null}
      </div>
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
      {onProgressChange && (
        <div className="task-progress">
          <input
            type="range"
            className="progress-slider"
            min={0}
            max={100}
            step={10}
            value={progressValue}
            aria-label={`${task.title} 完成度`}
            style={{ '--progress': `${progressValue}%` } as React.CSSProperties}
            onChange={(event) => onProgressChange(Number(event.target.value))}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <strong className="task-progress-value">{progressValue}%</strong>
        </div>
      )}
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
  const running = dashboard.focus.running
  const [durationDraft, setDurationDraft] = useState<string | null>(null)

  const commitDuration = () => {
    if (durationDraft === null) return
    const next = Math.min(
      120,
      Math.max(5, Number(durationDraft) || dashboard.focus.durationMinutes),
    )
    onDurationChange(next)
    setDurationDraft(null)
  }

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
            disabled={running}
            onClick={() =>
              onDurationChange(Math.max(5, dashboard.focus.durationMinutes - 5))
            }
          >
            <Minus size={14} />
          </button>
          <span>
            <input
              className="duration-stepper-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="手动输入专注分钟数"
              title="手动输入专注分钟数"
              disabled={running}
              value={durationDraft ?? dashboard.focus.durationMinutes}
              onChange={(event) =>
                setDurationDraft(event.target.value.replace(/\D/g, ''))
              }
              onFocus={(event) => event.currentTarget.select()}
              onBlur={commitDuration}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <small>分钟</small>
          </span>
          <button
            type="button"
            title="增加 5 分钟"
            disabled={running}
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
          重置
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
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down')
  const selectRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useLayoutEffect(() => {
    if (!open) return

    const updateMenuPlacement = () => {
      const selectElement = selectRef.current
      const menuElement = menuRef.current
      if (!selectElement || !menuElement) return

      const selectRect = selectElement.getBoundingClientRect()
      const menuHeight = menuElement.getBoundingClientRect().height
      const menuGap = 8
      const spaceBelow = window.innerHeight - selectRect.bottom - menuGap
      const spaceAbove = selectRect.top - menuGap
      const nextPlacement = menuHeight > spaceBelow && spaceAbove > spaceBelow ? 'up' : 'down'

      setMenuPlacement((current) => (current === nextPlacement ? current : nextPlacement))
    }

    updateMenuPlacement()
    window.addEventListener('resize', updateMenuPlacement)
    window.addEventListener('scroll', updateMenuPlacement, true)
    return () => {
      window.removeEventListener('resize', updateMenuPlacement)
      window.removeEventListener('scroll', updateMenuPlacement, true)
    }
  }, [open, options.length])

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

const shortcutDisplayNames: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  CmdOrCtrl: 'Ctrl',
  Control: 'Ctrl',
  Ctrl: 'Ctrl',
  Command: 'Cmd',
  Alt: 'Alt',
  Option: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
  Meta: 'Win',
}

const formatAccelerator = (accelerator: string) =>
  accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => shortcutDisplayNames[part] ?? part)
    .join(' + ')

// 与 electron/main.cjs 的 isSafeAccelerator 保持一致：只产出白名单里的按键名
const acceleratorKeyByCode: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Backslash: '\\',
}

const acceleratorKeyFromEvent = (event: KeyboardEvent) => {
  const { code } = event
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F(?:[1-9]|1\d|2[0-4])$/.test(code)) return code
  return acceleratorKeyByCode[code] ?? ''
}

const modifiersFromEvent = (event: KeyboardEvent) =>
  [
    event.ctrlKey ? 'CommandOrControl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Super' : '',
  ].filter(Boolean)

export function ShortcutRecorder({
  value,
  disabled,
  onCapture,
  onRecordingChange,
}: {
  value: string
  disabled: boolean
  onCapture: (accelerator: string) => void
  onRecordingChange?: (recording: boolean) => void
}) {
  const [recording, setRecording] = useState(false)
  const [previewModifiers, setPreviewModifiers] = useState<string[]>([])
  const [needsModifier, setNeedsModifier] = useState(false)

  const stopRecording = useCallback(() => {
    setRecording(false)
    setPreviewModifiers([])
    setNeedsModifier(false)
  }, [])

  useEffect(() => {
    if (!recording) return
    onRecordingChange?.(true)
    return () => onRecordingChange?.(false)
  }, [recording, onRecordingChange])

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        stopRecording()
        return
      }
      const modifiers = modifiersFromEvent(event)
      const key = acceleratorKeyFromEvent(event)
      if (!key) {
        setPreviewModifiers(modifiers)
        setNeedsModifier(false)
        return
      }
      if (!modifiers.length) {
        setPreviewModifiers([])
        setNeedsModifier(true)
        return
      }
      stopRecording()
      onCapture([...modifiers, key].join('+'))
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setPreviewModifiers(modifiersFromEvent(event))
    }
    const handleWindowBlur = () => stopRecording()

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [recording, onCapture, stopRecording])

  const displayValue = recording
    ? previewModifiers.length
      ? `${formatAccelerator(previewModifiers.join('+'))} + …`
      : needsModifier
        ? '需要搭配 Ctrl / Alt / Shift'
        : '按下组合键…'
    : formatAccelerator(value) || '未设置'

  return (
    <div
      className={['shortcut-recorder', recording ? 'recording' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className="shortcut-recorder-value"
        title={recording ? '正在录制快捷键，Esc 取消' : value}
        aria-live="polite"
      >
        {displayValue}
      </span>
      <button
        type="button"
        disabled={disabled}
        title={recording ? '取消录制 (Esc)' : '录制新的呼出快捷键'}
        aria-label={recording ? '取消录制快捷键' : '录制新的呼出快捷键'}
        onClick={() => {
          if (recording) {
            stopRecording()
          } else {
            setRecording(true)
          }
        }}
      >
        {recording ? <X size={14} /> : <Keyboard size={14} />}
        {recording ? '取消' : '修改'}
      </button>
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
  if (name === 'doc') return <FileText {...props} />
  if (name === 'sun') return <Sun {...props} />
  if (name === 'star') return <Star {...props} />
  if (name === 'globe') return <Globe2 {...props} />
  return <Link {...props} />
}
