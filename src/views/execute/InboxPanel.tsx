/**
 * 灵感暂存箱。
 *
 * 定位是"先接住，别打断当下的事"：回车即收纳，不需要选分类、填标题。
 * Shift+Enter 保留换行，方便记稍长一点的想法。
 */
import { useState } from 'react'
import { Brain, Inbox, StickyNote, Trash2 } from 'lucide-react'
import { useInboxActions } from '../../actions/useCaptureActions'
import { useDesktopNoteActions } from '../../actions/useDesktopNoteActions'
import { PanelTitle } from '../../components/ui/PanelTitle'
import { isDesktopRuntime } from '../../services/desktopBridge'
import { useDashboardStore } from '../../state/deckContext'

export function InboxPanel() {
  const { dashboard } = useDashboardStore()
  const { addInboxItem, removeInboxItem } = useInboxActions()
  const { createFromInbox } = useDesktopNoteActions()
  const [draft, setDraft] = useState('')

  const submit = () => {
    if (!addInboxItem(draft)) return
    setDraft('')
  }

  return (
    <article className="panel inbox-panel">
      <PanelTitle
        icon={<Inbox size={20} />}
        title="灵感暂存箱"
        aside={`${dashboard.inbox.length} 条`}
      />

      <div className="brain-dump">
        <textarea
          value={draft}
          placeholder="想到什么先丢进来，回车收纳"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button type="button" onClick={submit}>
          <Brain size={17} />
          收纳
        </button>
      </div>

      <ul className="inbox-list">
        {dashboard.inbox.map((item) => (
          <li key={item.id}>
            <span>{item.text}</span>
            <div className="inbox-item-actions">
              <button
                type="button"
                className="icon-button"
                title="转为桌面便笺"
                onClick={() => createFromInbox(item.id, isDesktopRuntime())}
              >
                <StickyNote size={15} />
              </button>
              <button
                type="button"
                className="icon-button danger"
                title="删除灵感"
                onClick={() => removeInboxItem(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}
