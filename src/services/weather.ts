/**
 * 天气与定位。
 *
 * 数据源全部是免费、免鉴权的公开接口：
 * - Open-Meteo：天气实况与城市地理编码；
 * - ipapi.co：浏览器拒绝定位时的兜底 IP 定位。
 *
 * 这一层只负责"发请求 + 把结果整形成应用的数据结构"，
 * 请求竞态、加载态、错误提示由 hooks/useWeather.ts 处理。
 */
import { ERROR_TEXT } from '../config/constants'
import { unknownWeatherCondition, weatherConditions } from '../config/weatherConditions'
import type { Weather, WeatherPosition } from '../types'

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const IP_LOCATION_ENDPOINT = 'https://ipapi.co/json/'

/* -------------------------------------------------------------------------- */
/* 定位                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 浏览器定位。
 * 刻意不要求高精度：天气只需要城市级别，低精度更快也更省电。
 */
export const getPosition = () =>
  new Promise<WeatherPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器没有开放定位能力'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10_000,
      },
    )
  })

/** IP 定位兜底：用户拒绝授权或系统定位不可用时使用。 */
export const getIpPosition = async (): Promise<WeatherPosition> => {
  const response = await fetch(IP_LOCATION_ENDPOINT)
  if (!response.ok) throw new Error('无法获取当前位置')

  const data = (await response.json()) as {
    latitude?: number
    longitude?: number
    city?: string
    region?: string
  }
  if (data.latitude == null || data.longitude == null) {
    throw new Error('定位数据不完整')
  }

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    label: data.city || data.region,
  }
}

/** 城市名 -> 经纬度。取第一个匹配结果。 */
export const geocodeCity = async (city: string): Promise<WeatherPosition> => {
  const params = new URLSearchParams({
    name: city,
    count: '1',
    language: 'zh',
    format: 'json',
  })

  const response = await fetch(`${GEOCODING_ENDPOINT}?${params}`)
  if (!response.ok) throw new Error('城市查询失败')

  const data = (await response.json()) as {
    results?: Array<{
      name: string
      latitude: number
      longitude: number
      country?: string
      admin1?: string
    }>
  }
  const result = data.results?.[0]
  if (!result) throw new Error('没找到这个城市')

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    // 只取前两级（城市 + 省/国家），太长的名字会撑破顶栏。
    label: [result.name, result.admin1, result.country].filter(Boolean).slice(0, 2).join(' · '),
  }
}

/* -------------------------------------------------------------------------- */
/* 实况天气                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 查询实况天气并整形成可直接存入状态的 `Weather`。
 *
 * `label` 的取值优先级：调用方给的城市名 > 接口返回时区的最后一段 > 兜底文案。
 */
export const fetchCurrentWeather = async (position: WeatherPosition): Promise<Weather> => {
  const { latitude, longitude } = position
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,weather_code',
    timezone: 'auto',
  })

  const response = await fetch(`${FORECAST_ENDPOINT}?${params}`)
  if (!response.ok) throw new Error(ERROR_TEXT.weatherUnavailable)

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number
      relative_humidity_2m?: number
      weather_code?: number
    }
    timezone?: string
  }

  const current = data.current
  if (!current || current.temperature_2m == null) {
    throw new Error(ERROR_TEXT.weatherIncomplete)
  }

  const condition = weatherConditions[current.weather_code ?? 0] ?? unknownWeatherCondition

  return {
    icon: condition.emoji,
    temp: `${Math.round(current.temperature_2m)}°`,
    label:
      position.label ??
      data.timezone?.split('/').pop()?.replaceAll('_', ' ') ??
      '当前位置',
    condition: condition.label,
    humidity:
      current.relative_humidity_2m == null
        ? undefined
        : `${Math.round(current.relative_humidity_2m)}%`,
    updatedAt: new Date().toISOString(),
    latitude,
    longitude,
  }
}
