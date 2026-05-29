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
} from 'lucide-react'
import type { WeatherIconName } from './types'

const weatherIconByLabel: Record<string, WeatherIconName> = {
  晴: 'sun',
  大致晴朗: 'cloud-sun',
  局部多云: 'cloud-sun',
  阴: 'cloudy',
  雾: 'fog',
  雾凇: 'fog',
  小毛毛雨: 'drizzle',
  毛毛雨: 'drizzle',
  大毛毛雨: 'rain',
  小雨: 'rain',
  中雨: 'rain',
  大雨: 'rain',
  小雪: 'snow',
  中雪: 'snow',
  大雪: 'snow',
  阵雨: 'sun-rain',
  强阵雨: 'rain',
  暴雨: 'storm',
  雷暴: 'storm',
  雷暴冰雹: 'storm',
  强雷暴冰雹: 'storm',
}

export function WeatherIcon({
  condition,
  fallback,
}: {
  condition?: string
  fallback: string
}) {
  const iconName = condition ? weatherIconByLabel[condition] : undefined
  const props = { size: 30, strokeWidth: 2.2 }

  if (iconName === 'sun') return <Sun {...props} />
  if (iconName === 'cloud-sun') return <CloudSun {...props} />
  if (iconName === 'cloudy') return <Cloudy {...props} />
  if (iconName === 'fog') return <CloudFog {...props} />
  if (iconName === 'drizzle') return <CloudDrizzle {...props} />
  if (iconName === 'rain') return <CloudRain {...props} />
  if (iconName === 'sun-rain') return <CloudSunRain {...props} />
  if (iconName === 'snow') return <CloudSnow {...props} />
  if (iconName === 'storm') return <CloudLightning {...props} />

  return <span>{fallback}</span>
}
