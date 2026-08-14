import { useEffect, useRef, useState } from 'react'
import {
  CalendarPlus,
  ExternalLink,
  ListPlus,
  Pin,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useDesktopNoteActions } from '../../actions/useDesktopNoteActions'
import { DESKTOP_NOTE_CONTENT_MAX_LENGTH } from '../../config/constants'
import { desktopNoteColorOptions } from '../../config/options'
import { ActionPanelTitle } from '../../components/ui/PanelTitle'
import { desktopNotePreview } from '../../domain/desktopNotes'
import { getDesktopBridge, isDesktopRuntime } from '../../services/desktopBridge'
import { useDashboardStore } from '../../state/deckContext'
import type { DesktopNote } from '../../types'

function DesktopNoteCard({ note }: { note: DesktopNote }) {
  const { showNotice } = useDashboardStore()
  const {
    updateNote,
    openNote,
    deleteNote,
    addToToday,
    addToTomorrow,
  } = useDesktopNoteActions()
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const draftRef = useRef(note.content)
  const persistedContentRef = useRef(note.content)
  const saveTimer = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)

  const flushDraft = () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const content = draftRef.current
    if (content === persistedContentRef.current) {
      setSaving(false)
      return
    }
    persistedContentRef.current = content
    updateNote(note.id, { content }, '编辑桌面便笺')
    setSaving(false)
  }

  useEffect(() => {
    // 正在输入时以本地草稿为准；没有待保存内容时才接收独立窗口同步回来的文本。
    if (saveTimer.current || note.content === draftRef.current) {
      persistedContentRef.current = note.content
      return
    }
    persistedContentRef.current = note.content
    draftRef.current = note.content
    if (editorRef.current) editorRef.current.value = note.content
  }, [note.content])

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (draftRef.current !== persistedContentRef.current) {
        updateNote(note.id, { content: draftRef.current }, '保存桌面便笺草稿')
      }
    },
    [note.id, updateNote],
  )

  const scheduleSave = (content: string) => {
    draftRef.current = content
    setSaving(true)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      flushDraft()
    }, 320)
  }

  const openWindow = () => {
    flushDraft()
    if (!isDesktopRuntime()) {
      showNotice('独立桌面便笺窗口仅在桌面版可用')
      return
    }
    if (note.isOpen) {
      void getDesktopBridge()
        ?.showDesktopNote?.(note.id)
        .catch(() => showNotice('桌面便笺窗口打开失败'))
      return
    }
    openNote(note.id)
  }

  const addTask = (target: 'today' | 'tomorrow') => {
    if (!draftRef.current.split(/\r?\n/).some((line) => line.trim())) {
      showNotice('请先写下便笺内容')
      return
    }
    flushDraft()
    if (target === 'today') addToToday(note.id)
    else addToTomorrow(note.id)
  }

  return (
    <li className={`desktop-note-card desktop-note-card-${note.color}`}>
      <div className="desktop-note-card-heading">
        <strong title={desktopNotePreview(note)}>{desktopNotePreview(note)}</strong>
        <span>
          {saving ? '保存中' : note.isOpen && isDesktopRuntime() ? '窗口已打开' : '已保存'}
        </span>
      </div>

      <textarea
        ref={editorRef}
        defaultValue={note.content}
        maxLength={DESKTOP_NOTE_CONTENT_MAX_LENGTH}
        placeholder="写下现在不想忘记的事…"
        onChange={(event) => scheduleSave(event.target.value)}
        onBlur={flushDraft}
      />

      <div className="desktop-note-card-footer">
        <div className="desktop-note-card-colors" aria-label="便笺颜色">
          {desktopNoteColorOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`desktop-note-card-color note-color-${option.value} ${
                note.color === option.value ? 'is-selected' : ''
              }`}
              title={option.label}
              onClick={() => {
                flushDraft()
                updateNote(note.id, { color: option.value }, '修改便笺颜色')
              }}
            />
          ))}
        </div>

        <div className="desktop-note-card-actions">
          <button type="button" title="添加到今日任务" onClick={() => addTask('today')}>
            <ListPlus size={14} />
          </button>
          <button type="button" title="添加到明日任务" onClick={() => addTask('tomorrow')}>
            <CalendarPlus size={14} />
          </button>
          <button
            type="button"
            title={note.isOpen ? '显示桌面窗口' : '打开桌面窗口'}
            onClick={openWindow}
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            className={note.alwaysOnTop ? 'is-active' : ''}
            title={note.alwaysOnTop ? '已置顶，点击取消' : '打开后保持在其他窗口上方'}
            onClick={() => {
              flushDraft()
              updateNote(note.id, { alwaysOnTop: !note.alwaysOnTop }, '修改便笺置顶')
            }}
          >
            <Pin size={14} fill={note.alwaysOnTop ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="danger"
            title="删除便笺"
            onClick={() => {
              if (window.confirm('确定删除这张桌面便笺吗？')) deleteNote(note.id)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  )
}

export function DesktopNotesPanel() {
  const { dashboard, showNotice } = useDashboardStore()
  const { createNote, openNote } = useDesktopNoteActions()

  const createOrReuseBlankNote = () => {
    const emptyNote = dashboard.desktopNotes.find((note) => !note.content.trim())
    if (!emptyNote) {
      createNote('', isDesktopRuntime())
      return
    }

    if (!isDesktopRuntime()) {
      showNotice('已有一张空白便笺，请直接编辑')
      return
    }
    if (emptyNote.isOpen) {
      void getDesktopBridge()
        ?.showDesktopNote?.(emptyNote.id)
        .catch(() => showNotice('桌面便笺窗口打开失败'))
    } else {
      openNote(emptyNote.id)
    }
  }

  return (
    <article className="panel desktop-notes-panel">
      <ActionPanelTitle
        icon={<StickyNote size={20} />}
        title="桌面便笺"
        actionLabel="新建"
        onAction={createOrReuseBlankNote}
      />

      {dashboard.desktopNotes.length ? (
        <ul className="desktop-notes-list">
          {dashboard.desktopNotes.map((note) => (
            <DesktopNoteCard key={note.id} note={note} />
          ))}
        </ul>
      ) : (
        <p className="desktop-notes-empty">
          新建一张便笺，或把灵感暂存箱里的内容弹到桌面。
        </p>
      )}
    </article>
  )
}
