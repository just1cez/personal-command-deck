/**
 * 完成度滑块。
 *
 * 当前值同时通过 CSS 变量 `--progress` 传给样式，用来画已完成那一段的填充色。
 */
import { PROGRESS_STEP } from '../../config/constants'

export function ProgressSlider({
  value,
  ariaLabel,
  onChange,
  onKeyDown,
}: {
  value: number
  ariaLabel: string
  onChange: (value: number) => void
  /** 例如在任务行里阻止冒泡，免得方向键/快捷键被全局监听器接管。 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type="range"
      className="progress-slider"
      min={0}
      max={100}
      step={PROGRESS_STEP}
      value={value}
      aria-label={ariaLabel}
      style={{ '--progress': `${value}%` } as React.CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
      onKeyDown={onKeyDown}
    />
  )
}
