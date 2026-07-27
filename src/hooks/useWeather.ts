/**
 * 天气查询的加载态、错误态与**请求竞态**处理。
 *
 * 竞态是这里唯一复杂的地方：用户可能连点刷新、或者刷新后马上改城市。
 * 做法是给每次请求发一个自增的编号，只有"最后一次"发出的请求才有权
 * 写状态、写错误、关闭加载态；旧请求的结果一律丢弃。
 */
import { useCallback, useRef, useState } from 'react'
import { ERROR_TEXT } from '../config/constants'
import {
  fetchCurrentWeather,
  geocodeCity,
  getIpPosition,
  getPosition,
} from '../services/weather'
import { useDashboardStore } from '../state/deckContext'
import type { WeatherPosition } from '../types'

export const useWeather = () => {
  const { dashboard, updateDashboard } = useDashboardStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** 最后一次发出的请求编号。 */
  const requestIdRef = useRef(0)

  const runWeatherRequest = useCallback(
    async (resolvePosition: () => Promise<WeatherPosition>, fallbackError: string) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      setLoading(true)
      setError('')

      try {
        const position = await resolvePosition()
        if (requestId !== requestIdRef.current) return

        const weather = await fetchCurrentWeather(position)
        if (requestId !== requestIdRef.current) return

        updateDashboard((current) => ({ ...current, weather }), '更新天气')
      } catch (requestError) {
        if (requestId === requestIdRef.current) {
          setError(requestError instanceof Error ? requestError.message : fallbackError)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [updateDashboard],
  )

  const { latitude, longitude, label } = dashboard.weather

  /**
   * 刷新当前位置的天气。
   * 已经固定过城市（有经纬度）就直接用它，否则先请求浏览器定位，
   * 被拒绝再退到 IP 定位。
   */
  const refresh = useCallback(
    () =>
      runWeatherRequest(
        async () =>
          latitude != null && longitude != null
            ? { latitude, longitude, label }
            : await getPosition().catch(() => getIpPosition()),
        ERROR_TEXT.weatherFailed,
      ),
    [label, latitude, longitude, runWeatherRequest],
  )

  /** 按城市名查询并固定到该城市。 */
  const setCity = useCallback(
    (city: string) => {
      const trimmed = city.trim()
      if (!trimmed) return
      void runWeatherRequest(() => geocodeCity(trimmed), ERROR_TEXT.weatherCityFailed)
    },
    [runWeatherRequest],
  )

  return { loading, error, refresh, setCity }
}
