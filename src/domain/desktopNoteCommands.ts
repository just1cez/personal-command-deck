import type { DashboardState, DesktopNote } from '../types'
import { desktopNoteTaskTitle, patchDesktopNote } from './desktopNotes'

export type NoteCommand = {
  requestId: string
  id: string
  type: 'patch' | 'closed' | 'delete' | 'add-today' | 'add-tomorrow' | 'barrier'
  patch?: Partial<DesktopNote>
}
export type NoteResult = { requestId: string; accepted: boolean; version: number; error?: string }

/** 只计算状态。重放相同任务请求也不会创建第二条任务。 */
export const applyNoteCommand = (state: DashboardState, command: NoteCommand) => {
  if (command.type === 'barrier') return { dashboard: state }
  const note = state.desktopNotes.find(item => item.id === command.id)
  if (!note) return { dashboard: state, error: '便笺不存在或已删除' }
  if (command.type === 'patch') return { dashboard: { ...state,
    desktopNotes: state.desktopNotes.map(item => item.id === note.id ? patchDesktopNote(item, command.patch ?? {}) : item),
  } }
  if (command.type === 'delete' || command.type === 'closed') return { dashboard: { ...state,
    desktopNotes: command.type === 'delete' || !note.content.trim()
      ? state.desktopNotes.filter(item => item.id !== note.id)
      : state.desktopNotes.map(item => item.id === note.id ? patchDesktopNote(item, { isOpen: false }) : item),
  } }
  const title = desktopNoteTaskTitle(note)
  if (!title) return { dashboard: state, error: '请先写下便笺内容' }
  const id = `note-task:${command.requestId}`
  const exists = [...state.tasks, ...state.tomorrowTasks,
    ...state.archives.flatMap(item => [...item.completedTasks, ...item.openTasks, ...item.tomorrowTasks]),
  ].some(item => item.id === id)
  if (exists) return { dashboard: state }
  const key = command.type === 'add-today' ? 'tasks' : 'tomorrowTasks'
  return { dashboard: { ...state, [key]: [...state[key], { id, title, done: false, kind: 'todo' as const }] } }
}
