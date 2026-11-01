import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteEditor } from './noteEditor'
import { createDesktopNote } from '../domain/desktopNotes'
import type { NoteResult } from '../domain/desktopNoteCommands'
const deferred = () => {
  let resolve!: (value: NoteResult) => void
  const promise = new Promise<NoteResult>(done => { resolve = done })
  return { promise, resolve }
}
afterEach(() => vi.useRealTimers())
describe('confirmed note editor', () => {
  it('keeps newer drafts during delayed saves and rejects out-of-order snapshots', async () => {
    const first = deferred(); const second = deferred()
    const transport = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const editor = new NoteEditor(transport)
    const note = { ...createDesktopNote('original'), version: 1 }
    editor.receive(note)
    editor.edit({ content: 'first' })
    const saving = editor.flush()
    editor.edit({ content: 'newest', color: 'blue' })
    editor.receive({ ...note, content: 'first', version: 2 })
    expect(editor.state.note?.content).toBe('newest')
    expect(editor.state.status).toBe('saving')
    expect(transport).toHaveBeenCalledTimes(1)
    first.resolve({ requestId: '1', accepted: true, version: 2 })
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2))
    second.resolve({ requestId: '2', accepted: true, version: 3 })
    await saving
    editor.receive({ ...note, content: 'stale', version: 2 })
    expect(editor.state.note?.content).toBe('newest')
    expect(editor.state.note?.color).toBe('blue')
    expect(editor.state.status).toBe('saved')
  })
  it('preserves failed drafts and reuses the request id on retry', async () => {
    const transport = vi.fn().mockResolvedValueOnce({ accepted: false, error: 'disk full' })
      .mockResolvedValueOnce({ accepted: true, version: 2 })
    const editor = new NoteEditor(transport)
    editor.receive({ ...createDesktopNote(), version: 1 })
    editor.edit({ content: 'keep me' })
    await expect(editor.flush()).rejects.toThrow('disk full')
    expect(editor.state.status).toBe('failed')
    expect(editor.state.note?.content).toBe('keep me')
    await editor.flush()
    expect(transport.mock.calls[0][1]).toBe(transport.mock.calls[1][1])
    expect(editor.state.status).toBe('saved')
  })
  it('times out without letting a late reply clear a newer draft', async () => {
    vi.useFakeTimers()
    const pending = deferred()
    const editor = new NoteEditor(() => pending.promise)
    editor.receive({ ...createDesktopNote(), version: 1 })
    editor.edit({ content: 'unsaved' })
    const result = expect(editor.flush()).rejects.toThrow('保存超时')
    await vi.advanceTimersByTimeAsync(5000); await result
    pending.resolve({ requestId: '1', accepted: true, version: 2 })
    await Promise.resolve()
    expect(editor.state.status).toBe('failed')
    expect(editor.state.note?.content).toBe('unsaved')
  })
})

it('keeps a newer confirmed remote edit when an older acknowledgement arrives last', async () => {
  const pending = deferred()
  const editor = new NoteEditor(() => pending.promise)
  const note = { ...createDesktopNote('original'), version: 1 }
  editor.receive(note)
  editor.edit({ content: 'local edit' })
  const saved = editor.flush()
  editor.receive({ ...note, content: 'newer remote edit', version: 3 })
  pending.resolve({ requestId: '1', accepted: true, version: 2 })
  await saved
  expect(editor.state.note?.content).toBe('newer remote edit')
})
