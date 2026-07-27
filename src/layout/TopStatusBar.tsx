/**
 * 顶栏：时间、天气、今日名言。
 *
 * 三块都是"看一眼就走"的信息，因此交互被压到最低：
 * 天气点一下就能改城市，名言点一下进管理面板，其余时候安静显示。
 */
import { useState } from 'react'
import { Check, Clock3, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import { WeatherIcon } from '../components/WeatherIcon'
import { useWeather } from '../hooks/useWeather'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import { fallbackQuote, getQuoteById } from '../state/quotes'
import { formatDate, formatTime } from '../utils'

export function TopStatusBar({ now }: { now: Date }) {
  const { dashboard, updateDashboard } = useDashboardStore()
  const { setQuoteManagerOpen } = useDeckUi()
  const weather = useWeather()

  const [editingWeather, setEditingWeather] = useState(false)

  // 名言可能已被停用或删除，取不到就显示兜底句。
  const todaysQuote =
    getQuoteById(dashboard.quotePool, dashboard.dailyQuote.quoteId) ?? fallbackQuote

  /**
   * 编辑城市名的同时清掉经纬度：
   * 有经纬度代表"已固定城市"，用户既然在改名字，就该重新按名字定位。
   */
  const editWeatherLabel = (label: string) => {
    updateDashboard(
      (current) => ({
        ...current,
        weather: {
          ...current.weather,
          label,
          latitude: undefined,
          longitude: undefined,
        },
      }),
      '编辑天气城市',
    )
  }

  return (
    <header className="top-status">
      <section className="status-block time-block" aria-label="日期与时间">
        <Clock3 size={18} />
        <div>
          <strong>{formatTime(now)}</strong>
          <span>{formatDate(now)}</span>
        </div>
      </section>

      <section className="status-block weather-block" aria-label="天气">
        {editingWeather ? (
          <div className="compact-edit">
            <input
              aria-label="天气城市"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={dashboard.weather.label}
              placeholder="城市，如 Hong Kong"
              onChange={(event) => editWeatherLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  weather.setCity(dashboard.weather.label)
                }
              }}
            />
            <button
              className="icon-button"
              type="button"
              title="固定这个城市"
              disabled={weather.loading}
              onClick={() => weather.setCity(dashboard.weather.label)}
            >
              <MapPin size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="完成天气编辑"
              onClick={() => setEditingWeather(false)}
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="weather-card">
            <button
              className="weather-button"
              type="button"
              title="设置天气城市"
              onClick={() => setEditingWeather(true)}
            >
              <span className="weather-icon">
                <WeatherIcon
                  condition={dashboard.weather.condition}
                  fallback={dashboard.weather.icon}
                />
              </span>
              <span className="weather-main">
                <strong>{dashboard.weather.temp}</strong>
                {dashboard.weather.condition && <em>{dashboard.weather.condition}</em>}
              </span>
              <small>
                <MapPin size={12} />
                {dashboard.weather.label}
              </small>
            </button>
            <button
              className="weather-refresh"
              type="button"
              title="联网查询当前位置天气"
              disabled={weather.loading}
              onClick={() => void weather.refresh()}
            >
              <RefreshCw size={15} />
            </button>
            {weather.error && <p>{weather.error}</p>}
          </div>
        )}
      </section>

      <section className="status-block quote-block" aria-label="今日箴言">
        <Sparkles size={18} />
        <button
          className="quote-button"
          type="button"
          title="管理名言池"
          onClick={() => setQuoteManagerOpen(true)}
        >
          <span className="quote-text">{todaysQuote.text}</span>
          <small className="quote-author">-- {todaysQuote.author}</small>
        </button>
      </section>
    </header>
  )
}
