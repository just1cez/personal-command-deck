import { useCallback } from 'react'
import { DESKTOP_NOTE_LIMIT, DESKTOP_NOTE_OPEN_LIMIT } from '../config/constants'
import {
  createDesktopNote,
  desktopNoteTaskTitle,
  patchDesktopNote,
} from '../domain/desktopNotes'
import { createTask } from '../domain/tasks'
import { useDashboardStore } from '../state/deckContext'
import type { DesktopNote } from '../types'

export type DesktopNotePatch = Partial<
  Pick<DesktopNote, 'content' | 'color' | 'isOpen' | 'alwaysOnTop' | 'bounds'>
>

export const useDesktopNoteActions = () => {
  const { dashboard, updateDashboard, showNotice } = useDashboardStore()

  const createNote = useCallback(
    (content = '', isOpen = true) => {
      if (dashboard.desktopNotes.length >= DESKTOP_NOTE_LIMIT) {
        showNotice(`桌面便笺最多保留 ${DESKTOP_NOTE_LIMIT} 张`)
        return null
      }
      const canOpen =
        !isOpen ||
        dashboard.desktopNotes.filter((note) => note.isOpen).length < DESKTOP_NOTE_OPEN_LIMIT
      if (isOpen && !canOpen) showNotice(`同时打开的便笺最多 ${DESKTOP_NOTE_OPEN_LIMIT} 张`)
      const note = { ...createDesktopNote(content), isOpen: isOpen && canOpen }
      updateDashboard(
        (current) =>
          current.desktopNotes.length >= DESKTOP_NOTE_LIMIT
            ? current
            : { ...current, desktopNotes: [note, ...current.desktopNotes] },
        '新建桌面便笺',
      )
      return note.id
    },
    [dashboard.desktopNotes, showNotice, updateDashboard],
  )

  const createFromInbox = useCallback(
    (inboxId: string, isOpen = true) => {
      if (dashboard.desktopNotes.length >= DESKTOP_NOTE_LIMIT) {
        showNotice(`桌面便笺最多保留 ${DESKTOP_NOTE_LIMIT} 张`)
        return false
      }
      const canOpen =
        !isOpen ||
        dashboard.desktopNotes.filter((note) => note.isOpen).length < DESKTOP_NOTE_OPEN_LIMIT
      if (isOpen && !canOpen) showNotice(`同时打开的便笺最多 ${DESKTOP_NOTE_OPEN_LIMIT} 张`)

      let created = false
      updateDashboard(
        (current) => {
          const item = current.inbox.find((candidate) => candidate.id === inboxId)
          if (!item || current.desktopNotes.length >= DESKTOP_NOTE_LIMIT) return current
          created = true
          return {
            ...current,
            inbox: current.inbox.filter((candidate) => candidate.id !== inboxId),
            desktopNotes: [
              { ...createDesktopNote(item.text), isOpen: isOpen && canOpen },
              ...current.desktopNotes,
            ],
          }
        },
        '灵感转为桌面便笺',
      )
      return created
    },
    [dashboard.desktopNotes, showNotice, updateDashboard],
  )

  const updateNote = useCallback(
    (id: string, patch: DesktopNotePatch, action = '编辑桌面便笺') => {
      updateDashboard(
        (current) => {
          let changed = false
          const desktopNotes = current.desktopNotes.map((note) => {
            if (note.id !== id) return note
            const next = patchDesktopNote(note, patch)
            changed ||= next !== note
            return next
          })
          return changed ? { ...current, desktopNotes } : current
        },
        action,
      )
    },
    [updateDashboard],
  )

  const openNote = useCallback(
    (id: string) => {
      const target = dashboard.desktopNotes.find((note) => note.id === id)
      if (!target || target.isOpen) return
      if (dashboard.desktopNotes.filter((note) => note.isOpen).length >= DESKTOP_NOTE_OPEN_LIMIT) {
        showNotice(`同时打开的便笺最多 ${DESKTOP_NOTE_OPEN_LIMIT} 张`)
        return
      }
      updateNote(id, { isOpen: true }, '打开桌面便笺')
    },
    [dashboard.desktopNotes, showNotice, updateNote],
  )

  const closeNote = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => {
          const note = current.desktopNotes.find((candidate) => candidate.id === id)
          if (!note) return current
          // 空白便笺关闭后没有保留价值，直接清理，避免下次新建时出现两张空白卡片。
          if (!note.content.trim()) {
            return {
              ...current,
              desktopNotes: current.desktopNotes.filter((candidate) => candidate.id !== id),
            }
          }
          return {
            ...current,
            desktopNotes: current.desktopNotes.map((candidate) =>
              candidate.id === id
                ? patchDesktopNote(candidate, { isOpen: false })
                : candidate,
            ),
          }
        },
        '关闭桌面便笺',
      )
    },
    [updateDashboard],
  )

  const deleteNote = useCallback(
    (id: string) => {
      updateDashboard(
        (current) => ({
          ...current,
          desktopNotes: current.desktopNotes.filter((note) => note.id !== id),
        }),
        '删除桌面便笺',
      )
    },
    [updateDashboard],
  )

  const addToToday = useCallback(
    (id: string) => {
      const target = dashboard.desktopNotes.find((note) => note.id === id)
      const title = target ? desktopNoteTaskTitle(target) : ''
      if (!title) return false

      updateDashboard(
        (current) => {
          const note = current.desktopNotes.find((candidate) => candidate.id === id)
          const currentTitle = note ? desktopNoteTaskTitle(note) : ''
          return currentTitle
            ? { ...current, tasks: [...current.tasks, createTask(currentTitle, 'todo')] }
            : current
        },
        '便笺添加到今日任务',
      )
      showNotice('已从便笺添加到今日任务')
      return true
    },
    [dashboard.desktopNotes, showNotice, updateDashboard],
  )

  const addToTomorrow = useCallback(
    (id: string) => {
      const target = dashboard.desktopNotes.find((note) => note.id === id)
      const title = target ? desktopNoteTaskTitle(target) : ''
      if (!title) return false

      updateDashboard(
        (current) => {
          const note = current.desktopNotes.find((candidate) => candidate.id === id)
          const currentTitle = note ? desktopNoteTaskTitle(note) : ''
          return currentTitle
            ? {
                ...current,
                tomorrowTasks: [...current.tomorrowTasks, createTask(currentTitle, 'todo')],
              }
            : current
        },
        '便笺添加到明日任务',
      )
      showNotice('已从便笺添加到明日任务')
      return true
    },
    [dashboard.desktopNotes, showNotice, updateDashboard],
  )

  return {
    createNote,
    createFromInbox,
    updateNote,
    openNote,
    closeNote,
    deleteNote,
    addToToday,
    addToTomorrow,
  }
}
