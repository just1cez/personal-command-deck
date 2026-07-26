/**
 * 项目专注弹窗：确认这一轮的目标、关联待办和时长，然后开始并切到聚焦页。
 *
 * 打开入口有两个（推进页的项目卡片、命令面板），弹窗本身渲染在最外层，
 * 所以草稿状态放在 DeckUiContext 里而不是某个面板内部。
 */
import { Minus, Play, Plus, X } from 'lucide-react'
import { useFocusActions } from '../actions/useFocusActions'
import { ThemedSelect } from '../components/ui/ThemedSelect'
import {
  FOCUS_DURATION_PRESETS,
  FOCUS_MINUTES_MAX,
  FOCUS_MINUTES_MIN,
  FOCUS_MINUTES_STEP,
} from '../config/constants'
import { useWindowKeyDown } from '../hooks/useWindowKeyDown'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import type { SelectOption } from '../types'

export function ProjectFocusDialog() {
  const { stats } = useDashboardStore()
  const {
    projectFocusDraft,
    closeProjectFocusDraft,
    setProjectFocusMinutes,
    setProjectFocusTaskId,
  } = useDeckUi()
  const { projectFocusTarget, startProjectFocus } = useFocusActions()

  // 弹窗打开期间：Esc 关闭、回车开始。
  // 分钟输入框会 stopPropagation，所以在里面按回车只是收起输入，不会误触发开始。
  useWindowKeyDown((event) => {
    if (event.key === 'Escape') closeProjectFocusDraft()
    if (event.key === 'Enter') {
      event.preventDefault()
      startProjectFocus()
    }
  }, Boolean(projectFocusTarget))

  if (!projectFocusTarget) return null

  const taskOptions: SelectOption[] = [
    { value: '', label: '不关联待办' },
    ...stats.topTasks
      .filter((task) => !task.done)
      .map((task) => ({ value: task.id, label: `Top·${task.title}` })),
    ...stats.todos
      .filter((task) => !task.done)
      .map((task) => ({ value: task.id, label: task.title })),
  ]

  return (
    <div
      className="command-overlay focus-dialog-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={closeProjectFocusDraft}
    >
      <div className="focus-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="focus-dialog-head">
          <div>
            <span>项目专注</span>
            <strong>{projectFocusTarget.name}</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭专注设置"
            title="关闭"
            onClick={closeProjectFocusDraft}
          >
            <X size={18} />
          </button>
        </div>

        <div className="focus-dialog-target">
          <span>本轮目标</span>
          <strong>{projectFocusTarget.nextAction}</strong>
        </div>

        <label className="focus-dialog-task">
          <span>关联今日待办</span>
          <ThemedSelect
            className="focus-dialog-task-select"
            aria-label="关联今日待办"
            value={projectFocusDraft.taskId}
            onChange={setProjectFocusTaskId}
            options={taskOptions}
          />
        </label>

        <div className="focus-duration-presets" aria-label="选择专注时长">
          {FOCUS_DURATION_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={projectFocusDraft.minutes === minutes ? 'active' : ''}
              onClick={() => setProjectFocusMinutes(minutes)}
            >
              {minutes}
              <small>分钟</small>
            </button>
          ))}
        </div>

        <div className="focus-dialog-stepper">
          <button
            type="button"
            title={`减少 ${FOCUS_MINUTES_STEP} 分钟`}
            onClick={() =>
              setProjectFocusMinutes((minutes) =>
                Math.max(FOCUS_MINUTES_MIN, minutes - FOCUS_MINUTES_STEP),
              )
            }
          >
            <Minus size={16} />
          </button>
          <label className="focus-dialog-minutes">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="专注分钟数"
              // 0 显示为空串，方便用户直接删掉重打。
              value={projectFocusDraft.minutes === 0 ? '' : projectFocusDraft.minutes}
              onChange={(event) =>
                setProjectFocusMinutes(Number(event.target.value.replace(/\D/g, '')) || 0)
              }
              // 失焦时才夹到合法区间，输入过程中不打断用户。
              onBlur={() =>
                setProjectFocusMinutes((minutes) =>
                  Math.min(FOCUS_MINUTES_MAX, Math.max(FOCUS_MINUTES_MIN, minutes)),
                )
              }
              onKeyDown={(event) => {
                // 不让回车冒泡到窗口，否则会立刻开始专注。
                event.stopPropagation()
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <span>分钟</span>
          </label>
          <button
            type="button"
            title={`增加 ${FOCUS_MINUTES_STEP} 分钟`}
            onClick={() =>
              setProjectFocusMinutes((minutes) =>
                Math.min(FOCUS_MINUTES_MAX, minutes + FOCUS_MINUTES_STEP),
              )
            }
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="focus-dialog-actions">
          <button type="button" className="secondary-action" onClick={closeProjectFocusDraft}>
            取消
          </button>
          <button type="button" className="primary-action" onClick={startProjectFocus}>
            <Play size={16} />
            开始并切到聚焦
          </button>
        </div>
      </div>
    </div>
  )
}
