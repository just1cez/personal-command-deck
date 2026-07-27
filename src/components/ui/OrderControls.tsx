/** 列表条目的上移 / 下移按钮。 */
import { ArrowDown, ArrowUp } from 'lucide-react'

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
