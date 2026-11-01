import type { NoteResult } from '../domain/desktopNoteCommands'
import type { NoteSnapshot } from './desktopBridge'

type Patch = Partial<Pick<NoteSnapshot, 'content' | 'color' | 'alwaysOnTop'>>
type Transport = (patch: Patch, requestId: string) => Promise<NoteResult>
export type EditorState = { note: NoteSnapshot | null; status: 'saved' | 'saving' | 'failed'; error: string }

const timeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('保存超时，请重试')), 5_000)
  })]) } finally { clearTimeout(timer) }
}

/** 保留未确认草稿，串行保存；超时重试沿用请求 ID，迟到快照不能覆盖新输入。 */
export class NoteEditor {
  state: EditorState = { note: null, status: 'saved', error: '' }
  private listeners = new Set<() => void>()
  private dirty: Patch = {}
  private generation = 0
  private version = -1
  private confirmed: NoteSnapshot | null = null
  private pending?: { patch: Patch; requestId: string; generation: number }
  private flight?: Promise<void>
  private timer?: ReturnType<typeof setTimeout>
  private transport: Transport
  constructor(transport: Transport) { this.transport = transport }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private publish(state: EditorState) { this.state = state; this.listeners.forEach(listener => listener()) }
  receive = (note: NoteSnapshot) => {
    if (note.version <= this.version) return
    this.version = note.version
    this.confirmed = note
    const clean = !this.pending && !Object.keys(this.dirty).length
    this.publish({ ...this.state, note: { ...note, ...this.dirty },
      status: clean ? 'saved' : this.state.status, error: clean ? '' : this.state.error })
  }
  edit = (patch: Patch, immediate = false) => {
    if (!this.state.note) return
    this.generation += 1
    this.dirty = { ...this.dirty, ...patch }
    this.publish({ note: { ...this.state.note, ...patch }, status: 'saving', error: '' })
    clearTimeout(this.timer)
    if (immediate) void this.flush().catch(() => undefined)
    else this.timer = setTimeout(() => { void this.flush().catch(() => undefined) }, 280)
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer)
    if (this.flight) return this.flight
    const save = async () => {
      while (this.pending || Object.keys(this.dirty).length) {
        if (!this.pending) this.pending = { patch: { ...this.dirty }, requestId: crypto.randomUUID(), generation: this.generation }
        const pending = this.pending
        this.publish({ ...this.state, status: 'saving', error: '' })
        const result = await timeout(this.transport(pending.patch, pending.requestId))
        if (!result.accepted) throw new Error(result.error || '保存失败，请重试')
        if (this.state.note && result.version >= this.version) {
          this.confirmed = { ...(this.confirmed ?? this.state.note), ...pending.patch, version: result.version }
        }
        this.version = Math.max(this.version, result.version)
        if (pending.generation === this.generation) this.dirty = {}
        this.pending = undefined
      }
      this.publish({ ...this.state, note: this.confirmed ?? this.state.note, status: 'saved', error: '' })
    }
    this.flight = save().catch(error => {
      this.publish({ ...this.state, status: 'failed', error: error.message })
      throw error
    }).finally(() => { this.flight = undefined })
    return this.flight
  }
  cancelTimer = () => clearTimeout(this.timer)
}

const editors = new Set<() => Promise<void>>()
export const registerNoteEditor = (flush: () => Promise<void>) => {
  editors.add(flush)
  return () => { editors.delete(flush) }
}
export const prepareNoteEditors = async () => {
  document.getElementById('root')?.setAttribute('inert', '')
  await Promise.all([...editors].map(flush => flush()))
}
export const releaseNoteEditors = () => document.getElementById('root')?.removeAttribute('inert')
