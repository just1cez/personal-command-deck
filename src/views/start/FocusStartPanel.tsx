/**
 * 聚焦页主面板：本轮目标 + 计时器 + 三个信号灯。
 *
 * "本轮目标"的取值有一条明确的优先级链（见 domain/focus.ts）：
 * 正在专注 > 手动选择 > 暂停可继续 > 自动推荐。
 * 界面上只显示最终结果，但开始专注时要按同一条链决定把时间记到哪里，
 * 所以这里把三种情况都显式列出来，而不是塞进一个三目表达式。
 */
import { useState } from 'react'
import { Check, Flame, Focus, Sparkles, SquareCheckBig } from 'lucide-react'
import { FocusControls } from '../../components/FocusControls'
import { PanelTitle } from '../../components/ui/PanelTitle'
import { ThemedSelect } from '../../components/ui/ThemedSelect'
import { NOTICE } from '../../config/constants'
import { useFocusActions } from '../../actions/useFocusActions'
import {
  isPausedFocusSession,
  projectFocusChoice,
  resolveAutoFocusTarget,
  resolveManualFocusTarget,
  resolveVisibleFocusTarget,
  taskFocusChoice,
} from '../../domain/focus'
import { resolveDefaultFocusProject, resolveSuggestedProject } from '../../domain/projects'
import { useDashboardStore } from '../../state/deckContext'
import type { SelectOption } from '../../types'

/** 自动推荐对应的下拉项值（空串）。 */
const AUTO_CHOICE = ''
const RUNNING_CHOICE = 'running'

export function FocusStartPanel() {
  const { dashboard, stats, notice } = useDashboardStore()
  const { startFocus, pauseFocus, resetFocus, setFocusDuration } = useFocusActions()

  /** 用户在下拉框里手动选的目标；空串表示交给自动推荐。 */
  const [focusChoice, setFocusChoice] = useState(AUTO_CHOICE)

  const { topTasks, todos, activeProjects } = stats

  const focusedProject = activeProjects.find(
    (project) => project.id === dashboard.focus.projectId,
  )
  const defaultFocusProject = resolveDefaultFocusProject(activeProjects)
  const autoTarget = resolveAutoFocusTarget(
    topTasks,
    todos,
    resolveSuggestedProject(activeProjects, focusedProject),
  )

  // 选中的任务/项目可能已经被完成或删除，这时 manualTarget 为 null，自动回退到推荐目标。
  const manualTarget = focusChoice
    ? resolveManualFocusTarget(
        focusChoice,
        dashboard.tasks,
        activeProjects,
        defaultFocusProject?.id ?? '',
      )
    : null

  const visibleTarget = resolveVisibleFocusTarget(dashboard, {
    manualTarget,
    autoTarget,
    activeProject: focusedProject,
  })
  const resumable = isPausedFocusSession(dashboard.focus)

  const focusChoiceOptions: SelectOption[] = [
    ...(dashboard.focus.running
      ? [{ value: RUNNING_CHOICE, label: '专注进行中', icon: <Focus size={15} /> }]
      : []),
    { value: AUTO_CHOICE, label: '自动推荐', icon: <Sparkles size={15} /> },
    ...topTasks
      .filter((task) => !task.done)
      .map((task) => ({
        value: taskFocusChoice(task.id),
        label: `Top · ${task.title}`,
        icon: <Focus size={15} />,
      })),
    ...todos
      .filter((task) => !task.done)
      .map((task) => ({
        value: taskFocusChoice(task.id),
        label: task.title,
        icon: <SquareCheckBig size={15} />,
      })),
    ...activeProjects.map((project) => ({
      value: projectFocusChoice(project.id),
      label: `项目 · ${project.name}`,
      icon: <Flame size={15} />,
    })),
  ]

  const handleStart = () => {
    if (manualTarget) {
      startFocus(manualTarget.projectId, manualTarget.label, manualTarget.taskId)
      // 这一轮已经启动，下拉框回到"自动推荐"，避免下次又沿用旧选择。
      setFocusChoice(AUTO_CHOICE)
      return
    }
    if (resumable) {
      startFocus(dashboard.focus.projectId, dashboard.focus.taskLabel, dashboard.focus.taskId)
      return
    }
    startFocus(defaultFocusProject?.id, autoTarget.label)
  }

  return (
    <article className="panel focus-start-panel">
      <PanelTitle
        icon={<Focus size={20} />}
        title="今日专注"
        aside={`${stats.completionRate}%`}
      />

      <div className="focus-priority">
        <div className="focus-priority-head">
          <span>本轮目标</span>
          {/* 运行中保留同尺寸的禁用控件，避免面板高度和页面滚动条发生跳变。 */}
          <ThemedSelect
            compact
            disabled={dashboard.focus.running}
            className="focus-target-select"
            aria-label="选择本轮专注目标"
            value={dashboard.focus.running ? RUNNING_CHOICE : focusChoice}
            options={focusChoiceOptions}
            onChange={setFocusChoice}
          />
        </div>
        <strong>{visibleTarget.label}</strong>
        <small className="focus-source">{visibleTarget.source}</small>
      </div>

      <FocusControls
        running={dashboard.focus.running}
        secondsLeft={dashboard.focus.secondsLeft}
        durationMinutes={dashboard.focus.durationMinutes}
        focusLabel={visibleTarget.label}
        onDurationChange={setFocusDuration}
        onStart={handleStart}
        onPause={pauseFocus}
        onReset={resetFocus}
      />

      <div className="focus-signals">
        <div className="focus-signal">
          <span>今日完成</span>
          <strong>
            {stats.completedTaskCount}/{dashboard.tasks.length}
          </strong>
        </div>
        <div className="focus-signal">
          <span>专注累计</span>
          <strong>{stats.totalFocusMinutes} 分钟</strong>
        </div>
        <div className="focus-signal">
          <span>临近提醒</span>
          <strong>{stats.urgentReminderCount} 个</strong>
        </div>
      </div>

      {/* 没有提示时显示计时规则说明，这一行永远不会空着。 */}
      <div className="focus-record-hint">
        <Check size={15} />
        <span>{notice || NOTICE.focusRecordHint}</span>
      </div>
    </article>
  )
}
