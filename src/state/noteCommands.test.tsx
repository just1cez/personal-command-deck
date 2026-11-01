// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost/"}
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { DeckProvider } from './DeckProvider'
import { defaultState } from './defaults'
import { STORAGE_KEY } from '../config/constants'
import { createDesktopNote } from '../domain/desktopNotes'
import type { NoteCommand, NoteResult } from '../domain/desktopNoteCommands'
import { DesktopNoteWindow } from '../desktop-note/DesktopNoteWindow'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage?.clear() })
it('acknowledges after persistence and retries a failed task command exactly once under StrictMode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const note = createDesktopNote('task from note')
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState, desktopNotes: [note] }))
  let command!: (value: NoteCommand) => void
  const results: NoteResult[] = []
  vi.stubGlobal('commandDeck', undefined)
  window.commandDeck = {
    onDesktopNoteCommand: callback => { command = callback; return () => undefined },
    acknowledgeNoteCommand: result => {
      if (result.accepted) expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).tasks.some((item: { title: string }) => item.title === note.content)).toBe(true)
      results.push(result)
    },
  }
  const host = document.createElement('div'); const root = createRoot(host)
  await act(async () => root.render(<StrictMode><DeckProvider><div /></DeckProvider></StrictMode>))
  const failure = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('full') })
  const request: NoteCommand = { requestId: 'task-request', id: note.id, type: 'add-today' }
  await act(async () => command(request))
  expect(results.at(-1)?.accepted).toBe(false)
  failure.mockRestore()
  await act(async () => command(request))
  expect(results.at(-1)?.accepted).toBe(true)
  await act(async () => command(request))
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).tasks.filter((item: { title: string }) => item.title === note.content)).toHaveLength(1)
  await act(async () => root.unmount())
})
it('renders a failed save without discarding text and allows retry', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const note = { ...createDesktopNote('initial'), id: '', version: 1 }
  const patch = vi.fn().mockResolvedValueOnce({ accepted: false, error: 'save failed' }).mockResolvedValueOnce({ accepted: true, version: 2 })
  vi.stubGlobal('commandDeck', undefined)
  window.commandDeck = { getDesktopNote: async () => note, patchDesktopNote: patch }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<DesktopNoteWindow />))
  const textarea = host.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'keep draft')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('save failed')
  expect(textarea.value).toBe('keep draft')
  const retry = [...host.querySelectorAll('button')].find(button => button.textContent === '重试保存')!
  await act(async () => retry.click())
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(host.querySelector('.desktop-note-save-state')?.textContent).toContain('已保存')
  await act(async () => root.unmount()); host.remove()
})
