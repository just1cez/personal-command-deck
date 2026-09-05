import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestAiSummary } from './aiSummary'
import { fetchCurrentWeather, geocodeCity, getIpPosition } from './weather'
import { defaultState } from '../state/defaults'
import { saveDashboardState } from '../state/storage'

const settings = { ...defaultState.ai, apiKey: 'synthetic-test-key', baseUrl: 'https://example.invalid/v1/', model: 'test' }
beforeEach(() => vi.stubGlobal('window', {}))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('verification: service responses, all network calls mocked', () => {
  it('fails validation before sending a request', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(requestAiSummary({ ...settings, apiKey: '' }, 'test')).rejects.toThrow('API Key')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('normalizes endpoint and trims valid AI output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: ' summary ' } }] })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await requestAiSummary(settings, 'test prompt')).toBe('summary')
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.invalid/v1/chat/completions')
  })
  it('uses the desktop proxy when available', async () => {
    const proxy = vi.fn().mockResolvedValue({ content: ' proxy result ' })
    vi.stubGlobal('window', { commandDeck: { generateAiSummary: proxy } })
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    expect(await requestAiSummary(settings, 'test')).toBe('proxy result')
    expect(proxy).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('reports non-JSON server errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))
    await expect(requestAiSummary(settings, 'test')).rejects.toThrow('503')
  })
  it('rejects empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(requestAiSummary(settings, 'test')).rejects.toThrow('没有返回总结')
  })
  it('surfaces network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(requestAiSummary(settings, 'test')).rejects.toThrow('offline')
  })
  it('reports missing cities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(geocodeCity('test')).rejects.toThrow('没找到')
  })
  it('rejects incomplete IP location', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"latitude":1}')))
    await expect(getIpPosition()).rejects.toThrow('不完整')
  })
  it('rejects missing weather data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(fetchCurrentWeather({ latitude: 1, longitude: 1 })).rejects.toThrow()
  })
  it('formats valid weather and handles unknown weather codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ current: { temperature_2m: 23.6, relative_humidity_2m: 70, weather_code: 999 } }))))
    expect(await fetchCurrentWeather({ latitude: 1, longitude: 1, label: 'test city' })).toMatchObject({ temp: '24°', humidity: '70%', label: 'test city' })
  })
  it('reports storage quota errors without throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('QuotaExceededError') } })
    expect(saveDashboardState(defaultState)).toBe(false)
  })
})
