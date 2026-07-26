/**
 * Open-Meteo 天气代码对照表。
 *
 * 重构前这张表被拆成了两份：`weather.ts` 里是 `代码 -> {emoji, 中文}`，
 * `weatherIcon.tsx` 里是 `中文 -> 矢量图标名`，加一种天气要改两个文件且容易漏。
 * 现在统一成一张表，另外两份映射由它派生。
 *
 * 天气代码含义见 https://open-meteo.com/en/docs（WMO Weather interpretation codes）。
 */
import type { WeatherIconName } from '../types'

export type WeatherCondition = {
  /** 兜底 emoji：矢量图标缺失时直接显示它。 */
  emoji: string
  /** 中文描述，同时会作为 `weather.condition` 存进本地数据。 */
  label: string
  /** 对应 components/WeatherIcon 里的矢量图标。 */
  icon: WeatherIconName
}

export const weatherConditions: Record<number, WeatherCondition> = {
  0: { emoji: '☀', label: '晴', icon: 'sun' },
  1: { emoji: '🌤', label: '大致晴朗', icon: 'cloud-sun' },
  2: { emoji: '⛅', label: '局部多云', icon: 'cloud-sun' },
  3: { emoji: '☁', label: '阴', icon: 'cloudy' },
  45: { emoji: '🌫', label: '雾', icon: 'fog' },
  48: { emoji: '🌫', label: '雾凇', icon: 'fog' },
  51: { emoji: '🌦', label: '小毛毛雨', icon: 'drizzle' },
  53: { emoji: '🌦', label: '毛毛雨', icon: 'drizzle' },
  55: { emoji: '🌧', label: '大毛毛雨', icon: 'rain' },
  61: { emoji: '🌧', label: '小雨', icon: 'rain' },
  63: { emoji: '🌧', label: '中雨', icon: 'rain' },
  65: { emoji: '🌧', label: '大雨', icon: 'rain' },
  71: { emoji: '🌨', label: '小雪', icon: 'snow' },
  73: { emoji: '🌨', label: '中雪', icon: 'snow' },
  75: { emoji: '❄', label: '大雪', icon: 'snow' },
  80: { emoji: '🌦', label: '阵雨', icon: 'sun-rain' },
  81: { emoji: '🌧', label: '强阵雨', icon: 'rain' },
  82: { emoji: '⛈', label: '暴雨', icon: 'storm' },
  95: { emoji: '⛈', label: '雷暴', icon: 'storm' },
  96: { emoji: '⛈', label: '雷暴冰雹', icon: 'storm' },
  99: { emoji: '⛈', label: '强雷暴冰雹', icon: 'storm' },
}

/** 表里没有的天气代码（Open-Meteo 偶尔会返回新代码）走这个兜底。 */
export const unknownWeatherCondition = { emoji: '🌡', label: '实时天气' }

/**
 * 中文描述 -> 矢量图标名。
 * 之所以按描述而不是代码索引：本地只存了 `condition` 文案，没存原始代码。
 */
export const weatherIconByLabel: Record<string, WeatherIconName> = Object.fromEntries(
  Object.values(weatherConditions).map((condition) => [condition.label, condition.icon]),
)
