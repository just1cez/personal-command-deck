import { useEffect, useRef, useState } from 'react'
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
import type { DesktopNote, DesktopNoteColor } from '../types'
import './DesktopNoteWindow.css'

const params = new URLSearchParams(window.location.search)
const noteId = params.get('noteId') ?? ''

export function DesktopNoteWindow() {
  const [note, setNote] = useState<DesktopNote | null>(null)
  const [loadError, setLoadError] = useState(() =>
    noteId && getDesktopBridge()?.getDesktopNote
      ? ''
      : '桌面便笺窗口仅在桌面版可用',
  )
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [feedback, setFeedback] = useState<{
    message: string
    kind: 'success' | 'prompt' | 'error'
  } | null>(null)
  const saveTimer = useRef<number | null>(null)
  const latestContent = useRef('')
  const feedbackTimer = useRef<number | null>(null)

  useEffect(() => {
    document.title = '桌面便笺'
    const bridge = getDesktopBridge()
    if (!noteId || !bridge?.getDesktopNote) return
    void bridge
      .getDesktopNote(noteId)
      .then((snapshot) => {
        if (!snapshot) {
          setLoadError('便笺不存在或已经被删除')
          return
        }
        latestContent.current = snapshot.content
        setNote(snapshot)
      })
      .catch(() => setLoadError('便笺加载失败，请重新打开'))
    if (!bridge.onDesktopNoteSnapshot) return
    return bridge.onDesktopNoteSnapshot((snapshot) => {
      if (snapshot.id !== noteId) return
      // 主窗口可能只改了颜色或置顶；本地仍有待保存文字时不能被旧快照覆盖。
      if (saveTimer.current) {
        setNote({ ...snapshot, content: latestContent.current })
        return
      }
      latestContent.current = snapshot.content
      setNote(snapshot)
      setSaveState('saved')
    })
  }, [])

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    },
    [],
  )

  useEffect(() => {
    const flushBeforeClose = () => {
      getDesktopBridge()?.flushDesktopNote?.(noteId, latestContent.current)
    }
    window.addEventListener('beforeunload', flushBeforeClose)
    return () => window.removeEventListener('beforeunload', flushBeforeClose)
  }, [])

  const patch = (value: Partial<Pick<DesktopNote, 'content' | 'color' | 'alwaysOnTop'>>) => {
    const bridge = getDesktopBridge()
    if (!bridge?.patchDesktopNote || !note) return
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const nextPatch = { ...value, content: latestContent.current }
    setNote({ ...note, ...nextPatch })
    setSaveState('saving')
    void bridge
      .patchDesktopNote(note.id, nextPatch)
      .then(() => setSaveState('saved'))
      .catch(() => {
        setSaveState('saved')
        showFeedback('保存失败，请重试', 'error')
      })
  }

  const changeContent = (content: string) => {
    if (!note) return
    latestContent.current = content
    setNote({ ...note, content })
    setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      const bridge = getDesktopBridge()
      if (!bridge?.patchDesktopNote) return
      void bridge
        .patchDesktopNote(note.id, { content })
        .then(() => setSaveState('saved'))
        .catch(() => {
          setSaveState('saved')
          showFeedback('保存失败，请重试', 'error')
        })
    }, 280)
  }

  const flushContent = () => {
    if (!saveTimer.current) return
    patch({ content: latestContent.current })
  }

  const showFeedback = (
    message: string,
    kind: 'success' | 'prompt' | 'error' = 'success',
  ) => {
    setFeedback({ message, kind })
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1_800)
  }

  const runAction = async (action: 'close' | 'delete' | 'add-today' | 'add-tomorrow') => {
    if (!note) return
    const bridge = getDesktopBridge()
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const isTaskAction = action === 'add-today' || action === 'add-tomorrow'
    if (isTaskAction && !latestContent.current.split(/\r?\n/).some((line) => line.trim())) {
      showFeedback('请先写下便笺内容', 'prompt')
      return
    }

    try {
      if (action !== 'delete' && bridge?.patchDesktopNote) {
        await bridge.patchDesktopNote(note.id, { content: latestContent.current })
      }
      const result = await bridge?.runDesktopNoteAction?.(note.id, action)
      if (isTaskAction) {
        showFeedback(
          result?.accepted
            ? action === 'add-today'
              ? '已添加到今日任务'
              : '已添加到明日任务'
            : '添加失败，请重试',
          result?.accepted ? 'success' : 'error',
        )
      }
    } catch {
      if (isTaskAction) showFeedback('添加失败，请重试', 'error')
    }
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
              showFeedback(alwaysOnTop ? '已保持在最前' : '已取消置顶')
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
            setSaveState('saved')
          }
        }}
      />

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
          {saveState === 'saving' ? '保存中' : '已保存'}
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
