/**
 * 控制条：能量、今日模式、主题、桌面快捷键、本地备份、命令面板入口。
 *
 * 这一排都是"设置类"操作——不产生数据，只改变面板的状态或外观，
 * 所以统一放在顶栏下方，与下面的三个主视图区分开。
 */
import { BatteryCharging, Command, Download, Palette, Upload } from 'lucide-react'
import { useBackupActions } from '../actions/useBackupActions'
import { ShortcutRecorder } from '../components/ShortcutRecorder'
import { ThemedSelect } from '../components/ui/ThemedSelect'
import { ENERGY_LEVELS } from '../config/constants'
import { dayModeOptions, themeOptions } from '../config/options'
import { useDesktopShortcut } from '../hooks/useDesktopShortcut'
import { useDashboardStore, useDeckUi } from '../state/deckContext'
import type { Theme } from '../types'

export function ControlStrip() {
  const { dashboard, updateDashboard } = useDashboardStore()
  const { setCommandPaletteOpen } = useDeckUi()
  const { exportBackup, importBackup } = useBackupActions()
  const shortcut = useDesktopShortcut()

  const shortcutDisabled = !shortcut.supported || shortcut.loading

  return (
    <section className="control-strip" aria-label="个人状态控制">
      {/* 能量：影响的是使用者自己的判断，不参与任何自动计算。 */}
      <div
        className="energy-control"
        data-energy={dashboard.energy}
        style={{ '--energy-level': dashboard.energy } as React.CSSProperties}
      >
        <BatteryCharging size={18} />
        <span>能量</span>
        <div className="energy-dots" aria-label={`当前能量 ${dashboard.energy} 分`}>
          {ENERGY_LEVELS.map((score) => (
            <button
              key={score}
              type="button"
              className={[
                score <= dashboard.energy ? 'active' : '',
                score === dashboard.energy ? 'current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-score={score}
              title={`能量 ${score}`}
              onClick={() =>
                updateDashboard((current) => ({ ...current, energy: score }), '设置能量')
              }
            />
          ))}
        </div>
      </div>

      <div className="mode-control" data-day-mode={dashboard.dayMode}>
        <span>今日模式</span>
        <div className="mode-options" role="group" aria-label="今日模式">
          {dayModeOptions.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={dashboard.dayMode === mode.value ? 'active' : ''}
              data-mode-option={mode.value}
              title={mode.value}
              aria-pressed={dashboard.dayMode === mode.value}
              onClick={() =>
                updateDashboard(
                  (current) => ({ ...current, dayMode: mode.value }),
                  '切换今日模式',
                )
              }
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <ThemedSelect
        className="theme-select"
        icon={<Palette size={18} />}
        label="主题"
        value={dashboard.theme}
        options={themeOptions}
        onChange={(theme) =>
          updateDashboard((current) => ({ ...current, theme: theme as Theme }), '切换主题')
        }
      />

      {/* 全局快捷键只有桌面版可用，Web 端整组控件禁用。 */}
      <div className="shortcut-settings" aria-label="托盘呼出快捷键">
        <label className="shortcut-toggle">
          <input
            type="checkbox"
            checked={shortcut.status.enabled}
            disabled={shortcutDisabled}
            onChange={(event) => shortcut.toggleEnabled(event.target.checked)}
          />
          <span>呼出</span>
        </label>
        <ShortcutRecorder
          value={shortcut.accelerator}
          disabled={shortcutDisabled}
          onRecordingChange={shortcut.setCapturing}
          onCapture={shortcut.recordAccelerator}
        />
        <small className={shortcut.status.registered ? 'ok' : ''}>
          {shortcut.notice || (shortcut.status.registered ? '已启用' : '未启用')}
        </small>
      </div>

      <div className="data-actions" aria-label="本地数据">
        <span>本地备份</span>
        <button type="button" title="导出本地备份，不包含 API Key" onClick={exportBackup}>
          <Download size={15} />
          导出
        </button>
        <label title="导入会覆盖当前本地数据，但保留本机 API Key">
          <Upload size={15} />
          导入
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importBackup(file)
              // 清空 value，保证连续选择同一个文件也能再次触发 change。
              event.currentTarget.value = ''
            }}
          />
        </label>
      </div>

      <button
        className="command-trigger"
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
      >
        <Command size={17} />
        <span>命令面板</span>
        <kbd>Ctrl K</kbd>
      </button>
    </section>
  )
}
