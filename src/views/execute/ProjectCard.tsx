/**
 * 单个进行中项目的卡片。
 *
 * 两种形态：
 * - 只读态强调"下一步动作"和完成度，右下角是最常用的"专注"按钮；
 * - 编辑态把名称和下一步动作变成输入框，并露出删除入口。
 *
 * 编辑状态本身由父组件持有（同一时刻只允许编辑一个项目）。
 */
import { Archive, Check, Pencil, Play, Trash2 } from 'lucide-react'
import { OrderControls } from '../../components/ui/OrderControls'
import { ProgressSlider } from '../../components/ui/ProgressSlider'
import type { OrderDirection, Project } from '../../types'

export function ProjectCard({
  project,
  isEditing,
  orderMoveDirection,
  canMoveUp,
  canMoveDown,
  onStartEdit,
  onFinishEdit,
  onChange,
  onProgressChange,
  onRemove,
  onComplete,
  onStartFocus,
  onMoveUp,
  onMoveDown,
}: {
  project: Project
  isEditing: boolean
  orderMoveDirection?: OrderDirection
  canMoveUp: boolean
  canMoveDown: boolean
  onStartEdit: () => void
  onFinishEdit: () => void
  onChange: (patch: Partial<Project>) => void
  onProgressChange: (value: number) => void
  onRemove: () => void
  onComplete: () => void
  onStartFocus: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const orderControls = (
    <OrderControls
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
    />
  )

  return (
    <div
      className={[
        'project-card',
        isEditing ? 'editing' : '',
        orderMoveDirection ? `order-moved move-${orderMoveDirection}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isEditing ? (
        <>
          <div className="project-card-header">
            <input
              value={project.name}
              aria-label="项目名称"
              onChange={(event) => onChange({ name: event.target.value })}
            />
            <button
              type="button"
              className="icon-button danger"
              title="删除项目"
              onClick={onRemove}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <textarea
            value={project.nextAction}
            aria-label={`${project.name} 的下一步动作`}
            onChange={(event) => onChange({ nextAction: event.target.value })}
          />
          <div className="project-meta">
            <span>{project.minutes} 分钟已记录</span>
            <div className="project-actions project-actions-editing">
              {orderControls}
              <button
                type="button"
                className="secondary-action project-complete-action"
                onClick={onComplete}
              >
                <Archive size={14} />
                结项
              </button>
              <button type="button" onClick={onFinishEdit}>
                <Check size={14} />
                完成
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="project-readout">
            <span>下一步</span>
            <h3>{project.name}</h3>
            <p>{project.nextAction}</p>
          </div>
          <div className="project-progress">
            <span>完成度</span>
            <ProgressSlider
              value={project.progress ?? 0}
              ariaLabel={`${project.name} 完成度`}
              onChange={onProgressChange}
            />
            <strong>{project.progress ?? 0}%</strong>
          </div>
          <div className="project-meta">
            <span>{project.minutes} 分钟已记录</span>
            <div className="project-actions">
              {/* 排序和编辑属于低频操作，收在一组弱化样式里。 */}
              <div className="quiet-actions" aria-label="项目管理">
                {orderControls}
                <button
                  type="button"
                  className="secondary-action compact-action"
                  title="编辑项目"
                  aria-label={`编辑 ${project.name}`}
                  onClick={onStartEdit}
                >
                  <Pencil size={14} />
                </button>
              </div>
              <button
                type="button"
                className="secondary-action project-complete-action"
                title="结项"
                onClick={onComplete}
              >
                <Archive size={14} />
                结项
              </button>
              <button
                type="button"
                className="primary-action project-focus-action"
                onClick={onStartFocus}
              >
                <Play size={14} />
                专注
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
