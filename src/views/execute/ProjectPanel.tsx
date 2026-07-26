/**
 * 项目推进面板：进行中的项目卡片、已结项折叠区、新增表单。
 */
import { useState } from 'react'
import { Archive, Flame, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useFocusActions } from '../../actions/useFocusActions'
import { useProjectActions } from '../../actions/useProjectActions'
import { useReviewActions } from '../../actions/useReviewActions'
import { RetentionControls } from '../../components/RetentionControls'
import { EditorCardTitle, EditorField } from '../../components/ui/EditorField'
import { ActionPanelTitle } from '../../components/ui/PanelTitle'
import { getRetentionLabel } from '../../domain/retention'
import { useDashboardStore, useDeckUi } from '../../state/deckContext'
import { ProjectCard } from './ProjectCard'

export function ProjectPanel() {
  const { dashboard, stats } = useDashboardStore()
  const { orderMoveHighlight } = useDeckUi()
  const {
    addProject,
    updateProject,
    setProjectProgress,
    removeProject,
    completeProject,
    restoreProject,
    moveProject,
  } = useProjectActions()
  const { openProjectFocusDialog } = useFocusActions()
  const { saveRetention } = useReviewActions()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAction, setNewAction] = useState('')
  /** 同一时刻只允许编辑一个项目。 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const { activeProjects, completedProjects } = stats

  const submitNewProject = () => {
    if (!addProject(newName, newAction)) return
    setNewName('')
    setNewAction('')
    setAdding(false)
  }

  /** 结项后收起编辑态并自动展开已结项列表，让用户看到项目"去哪了"。 */
  const handleComplete = (id: string) => {
    completeProject(id)
    setEditingId((current) => (current === id ? null : current))
    setShowCompleted(true)
  }

  return (
    <article className="panel project-panel">
      <ActionPanelTitle
        icon={<Flame size={20} />}
        title="项目推进"
        actionLabel="新项目"
        onAction={() => setAdding((current) => !current)}
      />

      <div className="project-stack">
        {activeProjects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            isEditing={editingId === project.id}
            orderMoveDirection={
              orderMoveHighlight?.id === project.id ? orderMoveHighlight.direction : undefined
            }
            canMoveUp={index > 0}
            canMoveDown={index < activeProjects.length - 1}
            onStartEdit={() => setEditingId(project.id)}
            onFinishEdit={() => setEditingId(null)}
            onChange={(patch) => updateProject(project.id, patch)}
            onProgressChange={(value) => setProjectProgress(project.id, value)}
            onRemove={() => removeProject(project.id)}
            onComplete={() => handleComplete(project.id)}
            onStartFocus={() => openProjectFocusDialog(project)}
            onMoveUp={() => moveProject(project.id, 'up')}
            onMoveDown={() => moveProject(project.id, 'down')}
          />
        ))}
        {!activeProjects.length && (
          <div className="project-empty">没有进行中的项目，新增一个下一步动作开始推进。</div>
        )}
      </div>

      {completedProjects.length > 0 && (
        <div className="completed-projects">
          <button
            type="button"
            className="completed-projects-toggle"
            onClick={() => setShowCompleted((current) => !current)}
          >
            <Archive size={14} />
            <span>已结项 {completedProjects.length}</span>
            <small>{showCompleted ? '收起' : '展开'}</small>
          </button>

          <div className="retention-settings compact" aria-label="已结项项目清理设置">
            <div>
              <span>本机清理</span>
              <strong>
                已结项项目 {getRetentionLabel(dashboard.retention.completedProjectDays)}
              </strong>
            </div>
            <RetentionControls
              label="保留"
              value={dashboard.retention.completedProjectDays}
              onChange={(value) => saveRetention('completedProjectDays', value)}
            />
          </div>

          {showCompleted && (
            <div className="completed-project-list">
              {completedProjects.map((project) => (
                <div className="completed-project-row" key={project.id}>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.nextAction || '没有记录下一步动作'}</span>
                    <small>
                      {project.minutes} 分钟已记录
                      {project.completedAt
                        ? ` · ${new Date(project.completedAt).toLocaleDateString('zh-Hans-CN')} 结项`
                        : ''}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => restoreProject(project.id)}
                  >
                    <RefreshCw size={13} />
                    恢复
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="删除已结项项目"
                    onClick={() => removeProject(project.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adding && (
        <div className="field-form project-form">
          <EditorCardTitle action="新增项目" preview={newName || '把长期目标变成下一步动作'} />
          <EditorField label="项目名称">
            <input
              value={newName}
              placeholder="例如 个人网站"
              onChange={(event) => setNewName(event.target.value)}
            />
          </EditorField>
          <EditorField label="下一步动作">
            <input
              value={newAction}
              placeholder="例如 写 About 页面初稿"
              onChange={(event) => setNewAction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitNewProject()
              }}
            />
          </EditorField>
          <div className="quick-link-editor-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setAdding(false)}
            >
              取消
            </button>
            <button type="button" className="done-action" onClick={submitNewProject}>
              <Plus size={16} />
              添加
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
