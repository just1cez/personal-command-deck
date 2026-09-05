// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Dialog } from './components/ui/Dialog'
import { defaultState } from './state/defaults'
import { STORAGE_KEY } from './config/constants'
import { notifyFocusComplete } from './services/notifications'
import { DeckProvider } from './state/DeckProvider'
import { useDashboardStore } from './state/deckContext'
import { useAiSummary } from './actions/useAiSummary'

vi.mock('./services/notifications', () => ({
  notifyFocusComplete: vi.fn(), requestWebNotificationPermission: vi.fn(),
}))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-05T10:00:00Z'))
  localStorage.clear()
  const state = structuredClone(defaultState)
  state.dailyCarryoverDate = '2026-09-05'
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks()
})

const button = (text: string) => {
  const found = [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))
  if (!found) throw new Error(`Missing button: ${text}`)
  return found
}
const click = async (element: HTMLElement) => { await act(async () => element.click()) }
const input = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function AiHarness() {
  const ai = useAiSummary()
  const { dashboard, updateDashboard } = useDashboardStore()
  return <>
    <button onClick={() => void ai.generateSummary()}>generate</button>
    <button onClick={ai.cancelGeneration}>cancel</button>
    <button onClick={() => updateDashboard(current => ({ ...current, review: { ...current.review, did: 'new input' }, reviewSummary: 'new summary' }), 'test edit')}>edit</button>
    <output>{dashboard.reviewSummary}</output>
  </>
}

const mountAi = async () => {
  const state = structuredClone(defaultState)
  state.ai = { ...state.ai, enabled: true, apiKey: 'synthetic-key', baseUrl: 'https://example.invalid/v1', model: 'test' }
  state.reviewSummary = ''
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  await act(async () => root.render(<DeckProvider><AiHarness /></DeckProvider>))
}

const aiResponse = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }))

describe('headless UI regressions (no desktop input)', () => {
  it('preserves an unsubmitted task draft across main-view switches', async () => {
    await act(async () => root.render(<App />))
    await click(button('推进'))
    await click(button('添加普通待办'))
    const composer = container.querySelector<HTMLInputElement>('input[placeholder="添加一个次要任务"]')!
    await input(composer, 'draft remains across views')
    await click(button('复盘'))
    await click(button('推进'))
    expect(container.querySelector<HTMLInputElement>('input[placeholder="添加一个次要任务"]')?.value).toBe('draft remains across views')
  })
  it('updates the visible countdown without writing dashboard state each second', async () => {
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    await click(button('开始专注'))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(container.querySelector('.timer-readout strong')?.textContent).toBe('24:50')
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(0)
  })
  it('settles once and emits one completion notification under StrictMode', async () => {
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    await click(button('开始专注'))
    await act(async () => { await vi.advanceTimersByTimeAsync(25 * 60 * 1000) })
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(state.focus.running).toBe(false)
    expect(state.focusRecords).toHaveLength(1)
    expect(state.focusRecords[0].actualSeconds).toBe(1500)
    expect(notifyFocusComplete).toHaveBeenCalledTimes(1)
  })
  it('contains dialog focus, closes on Escape, and restores the trigger', async () => {
    const trigger = document.createElement('button')
    container.before(trigger); trigger.focus()
    const close = vi.fn()
    await act(async () => root.render(<Dialog label="test dialog" onClose={close}><button>first</button><button>last</button></Dialog>))
    expect(document.activeElement?.textContent).toBe('first')
    await act(async () => trigger.focus())
    expect(document.activeElement?.textContent).toBe('first')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
    expect(document.activeElement?.textContent).toBe('last')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(close).toHaveBeenCalledOnce()
    await act(async () => root.render(null))
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
  it('does not overwrite edited review content with an outdated AI response', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    await mountAi()
    await click(button('generate'))
    await click(button('edit'))
    await act(async () => finish(aiResponse('outdated result')))
    expect(container.querySelector('output')?.textContent).toBe('new summary')
  })
  it('ignores cancelled AI responses even if the transport finishes later', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    await mountAi()
    await click(button('generate'))
    await click(button('cancel'))
    await act(async () => finish(aiResponse('cancelled result')))
    expect(container.querySelector('output')?.textContent).toBe('')
  })
  it('keeps the latest request when AI responses arrive out of order', async () => {
    const finishes: Array<(response: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finishes.push(resolve) })))
    await mountAi()
    await click(button('generate'))
    await click(button('generate'))
    await act(async () => finishes[1](aiResponse('latest result')))
    await act(async () => finishes[0](aiResponse('older result')))
    expect(container.querySelector('output')?.textContent).toBe('latest result')
  })
})
