/**
 * 今日面板：Top 3 与普通待办。
 *
 * 两段列表的结构完全一样，差别只在"是否有数量上限"，
 * 因此添加表单抽成了下面的 TaskComposer，避免两份几乎相同的 JSX。
 */
import { useState } from 'react'
import { Plus, SquareCheckBig, X } from 'lucide-react'
import { useTaskActions } from '../../actions/useTaskActions'
import { TaskRow } from '../../components/TaskRow'
import { PanelTitle } from '../../components/ui/PanelTitle'
import {
  TODO_TITLE_MAX_LENGTH,
  TOP_TASK_LIMIT,
  TOP_TASK_TITLE_MAX_LENGTH,
} from '../../config/constants'
import { secondsToDisplayMinutes } from '../../domain/focus'
import { useDashboardStore, useDeckUi } from '../../state/deckContext'

/**
 * 添加任务的行内表单。
 * 收起时是一个"+ 添加…"的按钮，展开后变成输入框，回车或点 + 提交。
 */
function TaskComposer({
  open,
  value,
  placeholder,
  maxLength,
  disabled = false,
  submitTitle,
  collapsedLabel,
  collapsedClassName,
  onOpen,
  onChange,
  onSubmit,
  onCancel,
}: {
  open: boolean
  value: string
  placeholder: string
  maxLength: number
  disabled?: boolean
  submitTitle: string
  collapsedLabel: string
  collapsedClassName: string
  onOpen: () => void
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  if (!open) {
    return (
      <button
        type="button"
        className={collapsedClassName}
        disabled={disabled}
        onClick={onOpen}
      >
        <Plus size={15} />
        {collapsedLabel}
      </button>
    )
  }

  return (
    <div className="inline-form">
      <input
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit()
        }}
      />
      <button type="button" className="inline-cancel" title="取消添加" onClick={onCancel}>
        <X size={16} />
      </button>
      <button type="button" disabled={disabled} title={submitTitle} onClick={onSubmit}>
        <Plus size={17} />
      </button>
    </div>
  )
}

export function TodayPanel() {
  const { dashboard, stats } = useDashboardStore()
  const { orderMoveHighlight } = useDeckUi()
  const { addTask, toggleTask, removeTask, renameTask, setTaskProgress, moveTask } =
    useTaskActions()

  const [addingTopTask, setAddingTopTask] = useState(false)
  const [newTopTask, setNewTopTask] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)
  const [newTodo, setNewTodo] = useState('')

  const { topTasks, todos, completedTaskCount } = stats
  const topTaskLimitReached = topTasks.length >= TOP_TASK_LIMIT

  const submitTopTask = () => {
    if (!addTask('top', newTopTask)) return
    setNewTopTask('')
    setAddingTopTask(false)
  }

  const submitTodo = () => {
    if (!addTask('todo', newTodo)) return
    setNewTodo('')
    setAddingTodo(false)
  }

  /** 任务行的公共属性；两段列表只有长度上限不同。 */
  const taskRowProps = (task: (typeof dashboard.tasks)[number], index: number, total: number) => ({
    task,
    orderMoveDirection:
      orderMoveHighlight?.id === task.id ? orderMoveHighlight.direction : undefined,
    onToggle: () => toggleTask(task.id),
    onRemove: () => removeTask(task.id),
    onRename: (title: string) => renameTask(task.id, title),
    onProgressChange: (value: number) => setTaskProgress(task.id, value),
    focusMinutes: secondsToDisplayMinutes(task.focusSeconds ?? 0),
    onMoveUp: () => moveTask(task.id, 'up' as const),
    onMoveDown: () => moveTask(task.id, 'down' as const),
    canMoveUp: index > 0,
    canMoveDown: index < total - 1,
  })

  return (
    <article className="panel today-panel">
      <PanelTitle
        icon={<SquareCheckBig size={20} />}
        title="今日面板"
        aside={`${completedTaskCount}/${dashboard.tasks.length} 完成`}
      />

      <div className="progress-track">
        <span
          style={{
            width: `${
              dashboard.tasks.length ? (completedTaskCount / dashboard.tasks.length) * 100 : 0
            }%`,
          }}
        />
      </div>

      <div className="section-heading">
        <span>Top 3</span>
        <small>
          {topTasks.length}/{TOP_TASK_LIMIT}
        </small>
      </div>
      <ul className="task-list top-task-list">
        {topTasks.map((task, index) => (
          <TaskRow
            key={task.id}
            {...taskRowProps(task, index, topTasks.length)}
            maxLength={TOP_TASK_TITLE_MAX_LENGTH}
          />
        ))}
      </ul>
      <TaskComposer
        open={addingTopTask}
        value={newTopTask}
        maxLength={TOP_TASK_TITLE_MAX_LENGTH}
        disabled={topTaskLimitReached}
        placeholder={topTaskLimitReached ? 'Top 3 已满' : '添加今天最重要的事'}
        submitTitle="添加 Top 3"
        collapsedLabel={topTaskLimitReached ? 'Top 3 已满' : '添加最重要的事'}
        collapsedClassName="add-row-button"
        onOpen={() => setAddingTopTask(true)}
        onChange={setNewTopTask}
        onSubmit={submitTopTask}
        onCancel={() => {
          setNewTopTask('')
          setAddingTopTask(false)
        }}
      />

      <div className="section-heading">
        <span>普通待办</span>
        <small>
          {todos.filter((todo) => todo.done).length}/{todos.length}
        </small>
      </div>
      <ul className="task-list">
        {todos.map((task, index) => (
          <TaskRow
            key={task.id}
            {...taskRowProps(task, index, todos.length)}
            maxLength={TODO_TITLE_MAX_LENGTH}
          />
        ))}
      </ul>
      <TaskComposer
        open={addingTodo}
        value={newTodo}
        maxLength={TODO_TITLE_MAX_LENGTH}
        placeholder="添加一个次要任务"
        submitTitle="添加待办"
        collapsedLabel="添加普通待办"
        collapsedClassName="add-row-button subtle"
        onOpen={() => setAddingTodo(true)}
        onChange={setNewTodo}
        onSubmit={submitTodo}
        onCancel={() => {
          setNewTodo('')
          setAddingTodo(false)
        }}
      />
    </article>
  )
}
