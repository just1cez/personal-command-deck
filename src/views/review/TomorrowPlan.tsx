/**
 * 布置第二天任务。
 *
 * 这些任务会在跨天时自动搬进今日任务（见 domain/tasks.carryTomorrowTasksIntoToday），
 * 前几条会填进 Top 3 的空位，所以列表顺序是有意义的，提供了上移/下移。
 */
import { useState } from 'react'
import { CalendarClock, Plus, SquareCheckBig } from 'lucide-react'
import { useTaskActions } from '../../actions/useTaskActions'
import { TaskRow } from '../../components/TaskRow'
import { ReviewSectionHeading } from '../../components/ui/PanelTitle'
import { useDashboardStore, useDeckUi } from '../../state/deckContext'

export function TomorrowPlan() {
  const { dashboard } = useDashboardStore()
  const { orderMoveHighlight } = useDeckUi()
  const {
    addTomorrowTask,
    toggleTomorrowTask,
    removeTomorrowTask,
    moveTomorrowTask,
    promoteTomorrowTasks,
  } = useTaskActions()

  const [draft, setDraft] = useState('')

  const submit = () => {
    if (!addTomorrowTask(draft)) return
    setDraft('')
  }

  const tomorrowTasks = dashboard.tomorrowTasks

  return (
    <section className="tomorrow-plan" aria-label="布置第二天任务">
      <ReviewSectionHeading
        icon={<CalendarClock size={17} />}
        title="布置第二天任务"
        aside={tomorrowTasks.length ? `${tomorrowTasks.length} 项` : '归档时会一起保存'}
      />

      <form
        className="tomorrow-task-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <input
          value={draft}
          placeholder="写下明天打开后先处理的任务"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          <Plus size={15} />
          添加
        </button>
      </form>

      {tomorrowTasks.length ? (
        <>
          <ul className="tomorrow-task-list">
            {tomorrowTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                orderMoveDirection={
                  orderMoveHighlight?.id === task.id ? orderMoveHighlight.direction : undefined
                }
                onToggle={() => toggleTomorrowTask(task.id)}
                onRemove={() => removeTomorrowTask(task.id)}
                onMoveUp={() => moveTomorrowTask(task.id, 'up')}
                onMoveDown={() => moveTomorrowTask(task.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < tomorrowTasks.length - 1}
              />
            ))}
          </ul>
          <div className="tomorrow-plan-actions">
            <span>第二天会自动带入今日任务，也可以现在手动整理。</span>
            <button type="button" className="secondary-action" onClick={promoteTomorrowTasks}>
              <SquareCheckBig size={15} />
              带入今日任务
            </button>
          </div>
        </>
      ) : (
        <p className="archive-empty">不需要排满，留一两件醒来就能开始的事。</p>
      )}
    </section>
  )
}
