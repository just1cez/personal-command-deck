/**
 * 任务行。
 *
 * 同时服务于今日 Top 3、普通待办和明日任务三个列表，差异全靠可选属性控制：
 * - 传了 `onRename` 才能双击改名；
 * - 传了 `onProgressChange` 才显示完成度滑块（明日任务不需要）。
 */
import { useState } from 'react'
import { Check, Circle, Trash2 } from 'lucide-react'
import type { OrderDirection, Task } from '../types'
import { OrderControls } from './ui/OrderControls'
import { ProgressSlider } from './ui/ProgressSlider'

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
  /** 有值时播放一次位移动画。 */
  orderMoveDirection?: OrderDirection
  onToggle: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onRename?: (title: string) => void
  maxLength?: number
  /** 已累计的专注分钟数，为 0 时不显示徽标。 */
  focusMinutes?: number
  onProgressChange?: (value: number) => void
}) {
  const editable = Boolean(onRename)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)

  // 老数据可能没有 progress 字段，用完成状态兜底。
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
    // 每次进入编辑都以最新标题为准，避免用上一次遗留的草稿。
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
              // 拦下按键，否则 Esc 会被全局监听当成"关闭命令面板"。
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
      <button type="button" className="icon-button danger" title="删除任务" onClick={onRemove}>
        <Trash2 size={15} />
      </button>

      {onProgressChange && (
        <div className="task-progress">
          <ProgressSlider
            value={progressValue}
            ariaLabel={`${task.title} 完成度`}
            onChange={onProgressChange}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <strong className="task-progress-value">{progressValue}%</strong>
        </div>
      )}
    </li>
  )
}
