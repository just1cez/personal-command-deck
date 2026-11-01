import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CalendarPlus, ExternalLink, ListPlus, Pin, Trash2 } from 'lucide-react'
import { NoteEditor, registerNoteEditor } from '../../services/noteEditor'
import { getDesktopBridge } from '../../services/desktopBridge'
import { useDesktopNoteActions } from '../../actions/useDesktopNoteActions'
import { useDashboardStore } from '../../state/deckContext'
import { desktopNotePreview } from '../../domain/desktopNotes'
import { desktopNoteColorOptions } from '../../config/options'
import { DESKTOP_NOTE_CONTENT_MAX_LENGTH } from '../../config/constants'
import type { DesktopNote } from '../../types'

/** 桌面主窗口里的编辑器与独立便笺使用同一套保存确认协议。 */
export function SavedDesktopNoteCard({ note: original }: { note: DesktopNote }) {
  const { openNote } = useDesktopNoteActions()
  const { showNotice } = useDashboardStore()
  const [editor] = useState(() => {
    const instance = new NoteEditor(async (patch, requestId) => {
      const save = getDesktopBridge()?.patchDesktopNote
      if (!save) throw new Error('保存服务不可用')
      return save(original.id, patch, requestId)
    })
    instance.state = { note: { ...original, version: -1 }, status: 'saving', error: '' }
    return instance
  })
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const note = state.note ?? original
  const pendingAction = useRef<Promise<void> | null>(null)
  const retry = useRef<{ action: string; requestId: string } | null>(null)
  useEffect(() => {
    const bridge = getDesktopBridge()
    let mounted = true
    void bridge?.getDesktopNote?.(original.id).then(snapshot => { if (mounted && snapshot) editor.receive(snapshot) }).catch(() => { if (mounted) showNotice('便笺读取失败，请重新打开') })
    const unsubscribe = bridge?.onDesktopNoteSnapshot?.(snapshot => { if (snapshot.id === original.id) editor.receive(snapshot) })
    const unregister = registerNoteEditor(async () => { await editor.flush(); await pendingAction.current })
    return () => { mounted = false; unsubscribe?.(); unregister(); editor.cancelTimer() }
  }, [editor, original.id, showNotice])
  const flush = () => { void editor.flush().catch(() => undefined) }
  const action = async (type: 'delete' | 'add-today' | 'add-tomorrow') => {
    if (pendingAction.current) return
    pendingAction.current = (async () => {
      if (type !== 'delete') await editor.flush()
      else editor.cancelTimer()
      if (retry.current?.action !== type) retry.current = { action: type, requestId: crypto.randomUUID() }
      const result = await getDesktopBridge()?.runDesktopNoteAction?.(note.id, type, retry.current.requestId)
      if (!result?.accepted) throw new Error(result?.error || '操作失败，请重试')
      retry.current = null
      if (type !== 'delete') showNotice(type === 'add-today' ? '已添加到今日任务' : '已添加到明日任务')
    })()
    try { await pendingAction.current } catch (error) { showNotice(error instanceof Error ? error.message : '保存失败') }
    finally { pendingAction.current = null }
  }
  const open = async () => {
    try {
      await editor.flush()
      if (original.isOpen) await getDesktopBridge()?.showDesktopNote?.(note.id)
      else openNote(note.id)
    } catch { showNotice('保存失败，请重试后打开窗口') }
  }
  return <li className={`desktop-note-card desktop-note-card-${note.color}`}>
    <div className="desktop-note-card-heading"><strong>{desktopNotePreview(note)}</strong><span>
      {state.status === 'saving' ? '保存中' : state.status === 'failed' ? '保存失败' : '已保存'}
    </span></div>
    <textarea value={note.content} maxLength={DESKTOP_NOTE_CONTENT_MAX_LENGTH} placeholder="写下现在不想忘记的事…"
      onChange={event => editor.edit({ content: event.target.value })} onBlur={flush} />
    {state.error && <div role="alert">{state.error}<button type="button" onClick={flush}>重试保存</button></div>}
    <div className="desktop-note-card-footer">
      <div className="desktop-note-card-colors" aria-label="便笺颜色">
        {desktopNoteColorOptions.map(option => <button type="button" key={option.value} title={option.label}
          className={`desktop-note-card-color note-color-${option.value} ${note.color === option.value ? 'is-selected' : ''}`}
          onClick={() => editor.edit({ color: option.value }, true)} />)}
      </div>
      <div className="desktop-note-card-actions">
        <button type="button" title="添加到今日任务" onClick={() => void action('add-today')}><ListPlus size={14} /></button>
        <button type="button" title="添加到明日任务" onClick={() => void action('add-tomorrow')}><CalendarPlus size={14} /></button>
        <button type="button" title={original.isOpen ? '显示桌面窗口' : '打开桌面窗口'} onClick={() => void open()}><ExternalLink size={14} /></button>
        <button type="button" title="切换置顶" className={note.alwaysOnTop ? 'is-active' : ''}
          onClick={() => editor.edit({ alwaysOnTop: !note.alwaysOnTop }, true)}><Pin size={14} /></button>
        <button type="button" className="danger" title="删除便笺" onClick={() => {
          if (window.confirm('确定删除这张桌面便笺吗？')) void action('delete')
        }}><Trash2 size={14} /></button>
      </div>
    </div>
  </li>
}
