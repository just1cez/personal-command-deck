import type { WeatherPosition } from './types'

export const weatherCodeMap: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀', label: '晴' },
  1: { icon: '🌤', label: '大致晴朗' },
  2: { icon: '⛅', label: '局部多云' },
  3: { icon: '☁', label: '阴' },
  45: { icon: '🌫', label: '雾' },
  48: { icon: '🌫', label: '雾凇' },
  51: { icon: '🌦', label: '小毛毛雨' },
  53: { icon: '🌦', label: '毛毛雨' },
  55: { icon: '🌧', label: '大毛毛雨' },
  61: { icon: '🌧', label: '小雨' },
  63: { icon: '🌧', label: '中雨' },
  65: { icon: '🌧', label: '大雨' },
  71: { icon: '🌨', label: '小雪' },
  73: { icon: '🌨', label: '中雪' },
  75: { icon: '❄', label: '大雪' },
  80: { icon: '🌦', label: '阵雨' },
  81: { icon: '🌧', label: '强阵雨' },
  82: { icon: '⛈', label: '暴雨' },
  95: { icon: '⛈', label: '雷暴' },
  96: { icon: '⛈', label: '雷暴冰雹' },
  99: { icon: '⛈', label: '强雷暴冰雹' },
}

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

export const getIpPosition = async () => {
  const response = await fetch('https://ipapi.co/json/')
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

export const geocodeCity = async (city: string) => {
  const params = new URLSearchParams({
    name: city,
    count: '1',
    language: 'zh',
    format: 'json',
  })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
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
    label: [result.name, result.admin1, result.country].filter(Boolean).slice(0, 2).join(' · '),
  }
}
