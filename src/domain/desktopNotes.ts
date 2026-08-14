/**
 * 桌面便笺的纯业务规则。
 * Electron 窗口只负责展示，便笺数据始终由主窗口里的 DashboardState 持有。
 */
import {
  DESKTOP_NOTE_CONTENT_MAX_LENGTH,
  DESKTOP_NOTE_DEFAULT_HEIGHT,
  DESKTOP_NOTE_DEFAULT_WIDTH,
  DESKTOP_NOTE_MAX_HEIGHT,
  DESKTOP_NOTE_MAX_WIDTH,
  DESKTOP_NOTE_MIN_HEIGHT,
  DESKTOP_NOTE_MIN_WIDTH,
} from '../config/constants'
import { validDesktopNoteColors } from '../config/options'
import type {
  DesktopNote,
  DesktopNoteBounds,
  DesktopNoteColor,
} from '../types'
import { uid } from '../utils'

export const DEFAULT_DESKTOP_NOTE_COLOR: DesktopNoteColor = 'yellow'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)))

export const sanitizeDesktopNoteContent = (value: unknown) =>
  String(value ?? '').slice(0, DESKTOP_NOTE_CONTENT_MAX_LENGTH)

export const normalizeDesktopNoteBounds = (
  value: Partial<DesktopNoteBounds> | null | undefined,
): DesktopNoteBounds => ({
  x: typeof value?.x === 'number' && Number.isFinite(value.x) ? Math.round(value.x) : undefined,
  y: typeof value?.y === 'number' && Number.isFinite(value.y) ? Math.round(value.y) : undefined,
  width: clamp(
    typeof value?.width === 'number' ? value.width : DESKTOP_NOTE_DEFAULT_WIDTH,
    DESKTOP_NOTE_MIN_WIDTH,
    DESKTOP_NOTE_MAX_WIDTH,
  ),
  height: clamp(
    typeof value?.height === 'number' ? value.height : DESKTOP_NOTE_DEFAULT_HEIGHT,
    DESKTOP_NOTE_MIN_HEIGHT,
    DESKTOP_NOTE_MAX_HEIGHT,
  ),
})

export const createDesktopNote = (content = ''): DesktopNote => {
  const now = new Date().toISOString()
  return {
    id: uid(),
    content: sanitizeDesktopNoteContent(content),
    color: DEFAULT_DESKTOP_NOTE_COLOR,
    createdAt: now,
    updatedAt: now,
    isOpen: true,
    alwaysOnTop: false,
    bounds: normalizeDesktopNoteBounds(undefined),
  }
}

export const patchDesktopNote = (
  note: DesktopNote,
  patch: Partial<Pick<DesktopNote, 'content' | 'color' | 'isOpen' | 'alwaysOnTop' | 'bounds'>>,
): DesktopNote => {
  const nextContent =
    patch.content === undefined ? note.content : sanitizeDesktopNoteContent(patch.content)
  const nextColor =
    patch.color && validDesktopNoteColors.has(patch.color) ? patch.color : note.color

  const next: DesktopNote = {
    ...note,
    content: nextContent,
    color: nextColor,
    isOpen: patch.isOpen ?? note.isOpen,
    alwaysOnTop: patch.alwaysOnTop ?? note.alwaysOnTop,
    bounds: patch.bounds ? normalizeDesktopNoteBounds(patch.bounds) : note.bounds,
  }

  const changed =
    next.content !== note.content ||
    next.color !== note.color ||
    next.isOpen !== note.isOpen ||
    next.alwaysOnTop !== note.alwaysOnTop ||
    next.bounds.x !== note.bounds.x ||
    next.bounds.y !== note.bounds.y ||
    next.bounds.width !== note.bounds.width ||
    next.bounds.height !== note.bounds.height

  return changed ? { ...next, updatedAt: new Date().toISOString() } : note
}

/** 任务标题取第一条非空行，避免把一整段便笺塞进任务列表。 */
export const desktopNoteTaskTitle = (note: DesktopNote) =>
  note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 80) ?? ''

export const desktopNotePreview = (note: DesktopNote) =>
  desktopNoteTaskTitle(note) || '空白便笺'
