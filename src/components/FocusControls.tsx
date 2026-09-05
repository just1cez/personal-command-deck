/**
 * 聚焦页的计时器控制台：倒计时读数 + 时长调整 + 开始/暂停/重置。
 *
 * 时长输入框用"草稿态"处理：输入过程中不立即写回状态，
 * 否则删到空串会被立刻纠正成最小值，用户根本没法改数字。
 * 失焦或回车时才提交并夹到合法区间。
 */
import { useEffect, useState } from 'react'
import { Minus, Pause, Play, Plus, RotateCcw, TimerReset } from 'lucide-react'
import {
  FOCUS_MINUTES_MAX,
  FOCUS_MINUTES_MIN,
  FOCUS_MINUTES_STEP,
} from '../config/constants'
import { clampFocusMinutes, getFocusSecondsLeft } from '../domain/focus'
import { formatMinutes } from '../utils'

function Countdown({ running, endsAt, secondsLeft }: { running: boolean; endsAt?: string; secondsLeft: number }) {
  const [remaining, setRemaining] = useState(() => running ? getFocusSecondsLeft(endsAt) : secondsLeft)
  useEffect(() => {
    if (!running) return
    const sync = () => setRemaining(getFocusSecondsLeft(endsAt))
    const initial = window.setTimeout(sync, 0)
    const timer = window.setInterval(sync, 1000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [running, endsAt])
  return <strong>{formatMinutes(running ? remaining : secondsLeft)}</strong>
}

export function FocusControls({
  running,
  secondsLeft,
  endsAt,
  durationMinutes,
  focusLabel,
  onDurationChange,
  onStart,
  onPause,
  onReset,
}: {
  running: boolean
  secondsLeft: number
  endsAt?: string
  durationMinutes: number
  focusLabel: string
  onDurationChange: (durationMinutes: number) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  /** null 表示"没在编辑"，此时输入框显示真实时长。 */
  const [durationDraft, setDurationDraft] = useState<string | null>(null)

  const commitDuration = () => {
    if (durationDraft === null) return
    // 空串或非法输入时回退到当前时长，不做惩罚性重置。
    onDurationChange(clampFocusMinutes(Number(durationDraft) || durationMinutes))
    setDurationDraft(null)
  }

  return (
    <div className="focus-console">
      <div className="timer-readout">
        <TimerReset size={18} />
        <Countdown running={running} endsAt={endsAt} secondsLeft={secondsLeft} />
        <span>{focusLabel}</span>
      </div>

      <div className="focus-controls">
        <div className="duration-stepper" aria-label="专注分钟数">
          <button
            type="button"
            title={`减少 ${FOCUS_MINUTES_STEP} 分钟`}
            disabled={running}
            onClick={() =>
              onDurationChange(Math.max(FOCUS_MINUTES_MIN, durationMinutes - FOCUS_MINUTES_STEP))
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
              value={durationDraft ?? durationMinutes}
              // 只留数字，避免输入法或粘贴带进奇怪字符。
              onChange={(event) => setDurationDraft(event.target.value.replace(/\D/g, ''))}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={commitDuration}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  // 交给 onBlur 统一提交，只有一条提交路径。
                  event.currentTarget.blur()
                }
              }}
            />
            <small>分钟</small>
          </span>
          <button
            type="button"
            title={`增加 ${FOCUS_MINUTES_STEP} 分钟`}
            disabled={running}
            onClick={() =>
              onDurationChange(Math.min(FOCUS_MINUTES_MAX, durationMinutes + FOCUS_MINUTES_STEP))
            }
          >
            <Plus size={14} />
          </button>
        </div>

        {running ? (
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
