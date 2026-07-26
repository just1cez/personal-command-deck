/**
 * 快捷入口面板。
 *
 * 同一时刻最多只有一个编辑器展开：要么在编辑某个入口，要么在新增。
 * 链接的合法性由 utils.normalizeHttpUrl 把关，非法链接不允许保存，
 * 已存在的非法链接（老数据）会被标成 aria-disabled 并在点击时给出提示。
 */
import { useState } from 'react'
import { Check, ExternalLink, Link, Pencil, Plus, Trash2 } from 'lucide-react'
import { useQuickLinkActions } from '../../actions/useCaptureActions'
import { EditorCardTitle, EditorField } from '../../components/ui/EditorField'
import { LinkIcon } from '../../components/ui/LinkIcon'
import { ActionPanelTitle } from '../../components/ui/PanelTitle'
import { ThemedSelect } from '../../components/ui/ThemedSelect'
import { linkIconOptions } from '../../config/options'
import { useDashboardStore } from '../../state/deckContext'
import { normalizeHttpUrl } from '../../utils'

/** 新增入口时的默认图标。 */
const DEFAULT_LINK_ICON = 'link'

export function QuickLinksPanel() {
  const { dashboard } = useDashboardStore()
  const { addQuickLink, updateQuickLink, commitQuickLinkUrl, removeQuickLink, openQuickLink } =
    useQuickLinkActions()

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newIcon, setNewIcon] = useState(DEFAULT_LINK_ICON)

  const [editingId, setEditingId] = useState<string | null>(null)
  /** 编辑中的 URL 草稿：输入过程中不写回状态，失焦或回车时才规范化提交。 */
  const [editingUrl, setEditingUrl] = useState('')

  const editingLink = dashboard.quickLinks.find((item) => item.id === editingId)

  const closeEditor = () => {
    setEditingId(null)
    setEditingUrl('')
  }

  const toggleEditor = (id: string, url: string) => {
    const nextId = editingId === id ? null : id
    setEditingId(nextId)
    setEditingUrl(nextId ? url : '')
  }

  const submitNewLink = () => {
    if (!addQuickLink(newLabel, newUrl, newIcon)) return
    setNewLabel('')
    setNewUrl('')
    setNewIcon(DEFAULT_LINK_ICON)
    setAdding(false)
  }

  return (
    <article className="panel links-panel">
      <ActionPanelTitle
        icon={<Link size={20} />}
        title="快捷入口"
        actionLabel="新入口"
        onAction={() => setAdding((current) => !current)}
      />

      <div className="quick-grid">
        {dashboard.quickLinks.map((item) => {
          // 每次渲染都重新校验：老数据可能是在校验规则更严之前存进去的。
          const safeUrl = normalizeHttpUrl(item.url)
          return (
            <div
              className={editingId === item.id ? 'quick-link-shell editing' : 'quick-link-shell'}
              key={item.id}
            >
              <div className="quick-link-main">
                <a
                  href={safeUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  title={item.url}
                  aria-disabled={!safeUrl}
                  onClick={(event) => {
                    // 统一走 openQuickLink：它会再校验一次并补上 noopener。
                    event.preventDefault()
                    openQuickLink(item.url)
                  }}
                >
                  <LinkIcon name={item.icon} />
                  <span>{item.label}</span>
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  title="编辑入口"
                  onClick={() => toggleEditor(item.id, item.url)}
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editingLink && (
        <div className="quick-link-editor">
          <EditorCardTitle action="编辑入口" preview={editingLink.label} />
          <div className="quick-link-editor-main">
            <EditorField label="名称">
              <input
                value={editingLink.label}
                aria-label={`${editingLink.label} 名称`}
                onChange={(event) =>
                  updateQuickLink(editingLink.id, { label: event.target.value })
                }
              />
            </EditorField>
            <EditorField label="图标" className="quick-link-icon-field">
              <ThemedSelect
                compact
                className="quick-link-icon-select"
                value={editingLink.icon}
                aria-label={`${editingLink.label} 图标`}
                options={linkIconOptions}
                onChange={(icon) => updateQuickLink(editingLink.id, { icon })}
              />
            </EditorField>
          </div>
          <EditorField label="链接">
            <input
              value={editingUrl}
              aria-label={`${editingLink.label} URL`}
              onChange={(event) => setEditingUrl(event.target.value)}
              onBlur={(event) => {
                commitQuickLinkUrl(editingLink.id, event.target.value)
                // 把输入框同步成规范化后的地址；非法输入则还原成原来的链接。
                setEditingUrl(normalizeHttpUrl(event.target.value) || editingLink.url)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitQuickLinkUrl(editingLink.id, event.currentTarget.value)
                  event.currentTarget.blur()
                }
              }}
            />
          </EditorField>
          <div className="quick-link-editor-actions">
            <button
              type="button"
              className="danger-action"
              title="删除入口"
              onClick={() => {
                removeQuickLink(editingLink.id)
                closeEditor()
              }}
            >
              <Trash2 size={15} />
            </button>
            <button type="button" className="done-action" onClick={closeEditor}>
              <Check size={15} />
              完成
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="quick-link-editor link-form">
          <EditorCardTitle action="新增入口" preview={newLabel || '常用网站或文档'} />
          <div className="quick-link-editor-main">
            <EditorField label="名称">
              <input
                value={newLabel}
                placeholder="例如 Mail"
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </EditorField>
            <EditorField label="图标" className="quick-link-icon-field">
              <ThemedSelect
                compact
                className="quick-link-icon-select"
                value={newIcon}
                aria-label="入口图标"
                options={linkIconOptions}
                onChange={setNewIcon}
              />
            </EditorField>
          </div>
          <EditorField label="链接">
            <input
              value={newUrl}
              placeholder="https://example.com"
              onChange={(event) => setNewUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitNewLink()
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
            <button type="button" className="done-action" onClick={submitNewLink}>
              <Plus size={16} />
              添加
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
