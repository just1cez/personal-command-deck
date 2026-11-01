import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  CalendarPlus,
  Check,
  ListPlus,
  PencilLine,
  Pin,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { DESKTOP_NOTE_CONTENT_MAX_LENGTH } from '../config/constants'
import { desktopNoteColorOptions } from '../config/options'
import { getDesktopBridge } from '../services/desktopBridge'
import { NoteEditor, prepareNoteEditors, releaseNoteEditors, registerNoteEditor } from '../services/noteEditor'
import type { DesktopNoteColor } from '../types'
import './DesktopNoteWindow.css'

const params = new URLSearchParams(window.location.search)
const noteId = params.get('noteId') ?? ''

export function DesktopNoteWindow() {
  const [editor] = useState(() => new NoteEditor(async (patch, requestId) => {
    const save = getDesktopBridge()?.patchDesktopNote
    if (!save) throw new Error('保存服务不可用')
    return save(noteId, patch, requestId)
  }))
  const { note, status: saveState, error: saveError } = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const [loadError, setLoadError] = useState(() => getDesktopBridge()?.getDesktopNote ? '' : '桌面便笺窗口仅在桌面版可用')
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'prompt' | 'error' } | null>(null)
  const feedbackTimer = useRef<number | null>(null)
  const taskRequest = useRef<{ action: string; id: string } | null>(null)
  const actionFlight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    document.title = '桌面便笺'
    const bridge = getDesktopBridge()
    let mounted = true
    void bridge?.getDesktopNote?.(noteId).then(snapshot => {
      if (!mounted) return
      if (snapshot) editor.receive(snapshot)
      else setLoadError('便笺不存在或已经被删除')
    }).catch(() => { if (mounted) setLoadError('便笺加载失败，请重新打开') })
    const unsubscribe = bridge?.onDesktopNoteSnapshot?.(snapshot => {
      if (snapshot.id === noteId) editor.receive(snapshot)
    })
    const unregister = registerNoteEditor(async () => {
      if (!editor.state.note) throw new Error('便笺尚未加载，请稍后重试')
      await editor.flush()
      await actionFlight.current
    })
    const unprepare = bridge?.onNotePrepare?.(prepareNoteEditors)
    const unrelease = bridge?.onNoteRelease?.(releaseNoteEditors)
    return () => {
      mounted = false; unsubscribe?.(); unregister(); unprepare?.(); unrelease?.(); editor.cancelTimer()
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [editor])

  const patch = (value: Parameters<NoteEditor['edit']>[0]) => editor.edit(value, true)
  const changeContent = (content: string) => editor.edit({ content })
  const flushContent = () => { void editor.flush().catch(() => undefined) }

  const showFeedback = (
    message: string,
    kind: 'success' | 'prompt' | 'error' = 'success',
  ) => {
    setFeedback({ message, kind })
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1_800)
  }

  const runAction = async (action: 'close' | 'delete' | 'add-today' | 'add-tomorrow') => {
    if (!note || actionFlight.current) return
    const bridge = getDesktopBridge()
    if (action === 'close') {
      try { await bridge?.runDesktopNoteAction?.(noteId, action) }
      catch { showFeedback('关闭失败，草稿已保留，请重试', 'error') }
      return
    }
    const perform = async () => {
      try {
        if (action !== 'delete') await editor.flush()
        else editor.cancelTimer()
        if (taskRequest.current?.action !== action) taskRequest.current = { action, id: crypto.randomUUID() }
        const result = await bridge?.runDesktopNoteAction?.(noteId, action, taskRequest.current.id)
        if (!result?.accepted) throw new Error(result?.error || '操作失败，请重试')
        taskRequest.current = null
        if (action !== 'delete') showFeedback(action === 'add-today' ? '已添加到今日任务' : '已添加到明日任务')
      } catch (error) {
        showFeedback(error instanceof Error ? error.message : '操作失败，请重试', 'error')
        throw error
      }
    }
    actionFlight.current = perform()
    try { await actionFlight.current } catch { /* 草稿和请求 ID 保留供重试。 */ }
    finally { actionFlight.current = null }
  }

  if (!note) {
    return (
      <main className="desktop-note-shell desktop-note-yellow">
        <header className="desktop-note-toolbar">
          <span className="desktop-note-drag-title">桌面便笺</span>
          <div className="desktop-note-window-actions">
            <button type="button" title="关闭便笺" onClick={() => window.close()}>
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="desktop-note-load-message">
          {loadError || '正在加载便笺…'}
        </div>
      </main>
    )
  }

  return (
    <main className={`desktop-note-shell desktop-note-${note.color}`}>
      <header className="desktop-note-toolbar">
        <span className="desktop-note-drag-title">桌面便笺</span>
        <div className="desktop-note-window-actions">
          <button
            type="button"
            className={note.alwaysOnTop ? 'is-active' : ''}
            title={note.alwaysOnTop ? '已置顶，点击取消' : '保持在其他窗口上方'}
            onClick={() => {
              const alwaysOnTop = !note.alwaysOnTop
              patch({ alwaysOnTop })
            }}
          >
            <Pin size={15} fill={note.alwaysOnTop ? 'currentColor' : 'none'} />
          </button>
          <button type="button" title="关闭便笺" onClick={() => void runAction('close')}>
            <X size={17} />
          </button>
        </div>
      </header>

      <textarea
        className="desktop-note-editor"
        value={note.content}
        maxLength={DESKTOP_NOTE_CONTENT_MAX_LENGTH}
        placeholder="写下现在不想忘记的事…"
        autoFocus
        spellCheck={false}
        onChange={(event) => changeContent(event.target.value)}
        onBlur={flushContent}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault()
            void runAction('add-today')
          }
        }}
      />

      {saveError && <p role="alert" className="desktop-note-feedback desktop-note-feedback-error">{saveError}</p>}
      {feedback && (
        <div
          className={`desktop-note-feedback desktop-note-feedback-${feedback.kind}`}
          role="status"
          aria-live="polite"
        >
          {feedback.kind === 'prompt' ? (
            <PencilLine size={14} />
          ) : feedback.kind === 'error' ? (
            <TriangleAlert size={14} />
          ) : (
            <Check size={14} />
          )}
          {feedback.message}
        </div>
      )}

      <footer className="desktop-note-footer">
        <div className="desktop-note-colors" aria-label="便笺颜色">
          {desktopNoteColorOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`desktop-note-color desktop-note-color-${option.value} ${
                note.color === option.value ? 'is-selected' : ''
              }`}
              title={option.label}
              aria-label={option.label}
              onClick={() => patch({ color: option.value as DesktopNoteColor })}
            />
          ))}
        </div>

        <span className="desktop-note-save-state">
          <Check size={12} />
          {saveState === 'saving' ? '保存中' : saveState === 'failed' ? '保存失败' : '已保存'}
          {saveState === 'failed' && <button type="button" title={saveError} onClick={flushContent}>重试保存</button>}
        </span>

        <div className="desktop-note-actions">
          <button type="button" title="添加到今日任务" onClick={() => void runAction('add-today')}>
            <ListPlus size={15} />
          </button>
          <button type="button" title="添加到明日任务" onClick={() => void runAction('add-tomorrow')}>
            <CalendarPlus size={15} />
          </button>
          <button
            type="button"
            className="danger"
            title="删除便笺"
            onClick={() => {
              if (window.confirm('确定删除这张桌面便笺吗？')) void runAction('delete')
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </footer>
    </main>
  )
}
