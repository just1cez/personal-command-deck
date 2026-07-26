/**
 * 天气图标。
 *
 * 认不出天气描述（例如"手动天气"、接口返回了未知代码）时，
 * 退回显示存下来的 emoji，保证顶栏永远不会空一块。
 */
import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { weatherIconByLabel } from '../config/weatherConditions'
import type { WeatherIconName } from '../types'

const weatherIconComponents: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloudy: Cloudy,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  'sun-rain': CloudSunRain,
  snow: CloudSnow,
  storm: CloudLightning,
}

export function WeatherIcon({
  condition,
  fallback,
}: {
  condition?: string
  /** 认不出 condition 时显示的 emoji。 */
  fallback: string
}) {
  const iconName = condition ? weatherIconByLabel[condition] : undefined
  const Icon = iconName ? weatherIconComponents[iconName] : undefined

  if (!Icon) return <span>{fallback}</span>
  return <Icon size={30} strokeWidth={2.2} />
}
