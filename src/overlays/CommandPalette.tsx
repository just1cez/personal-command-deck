/**
 * 命令面板（Ctrl/Cmd + K）。
 *
 * 一个搜索框统一入口：链接直接打开、任务直接勾选、项目直接开专注。
 * 搜索词在关闭后保留，方便"再看一眼刚才那个结果"。
 */
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCommandResults } from '../actions/useCommandResults'
import { useWindowKeyDown } from '../hooks/useWindowKeyDown'
import { useDeckUi } from '../state/deckContext'
import { Dialog } from '../components/ui/Dialog'

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useDeckUi()
  const [query, setQuery] = useState('')
  const results = useCommandResults(query)

  useWindowKeyDown((event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      // 拦下浏览器/Electron 自带的搜索快捷键。
      event.preventDefault()
      setCommandPaletteOpen((open) => !open)
    }
    if (event.key === 'Escape') {
      setCommandPaletteOpen(false)
    }
  })

  if (!commandPaletteOpen) return null

  return (
    <Dialog label="命令面板" onClose={() => setCommandPaletteOpen(false)}>
      {/* 阻止冒泡，避免点击面板本身被当成"点了遮罩"。 */}
      <div className="command-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <Search size={19} />
          <input
            data-dialog-autofocus
            aria-label="搜索命令"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            placeholder="搜索链接、任务、项目、灵感..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="icon-button"
            type="button"
            aria-label="关闭命令面板"
            title="关闭命令面板"
            onClick={() => setCommandPaletteOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="command-results">
          {results.map((row) => (
            <button
              type="button"
              key={row.id}
              onClick={() => {
                row.action()
                // 无论执行了什么，选完就关面板。
                setCommandPaletteOpen(false)
              }}
            >
              <span>{row.type}</span>
              <strong>{row.title}</strong>
              <small>{row.meta}</small>
            </button>
          ))}
          {!results.length && <p>没有找到匹配项</p>}
        </div>
      </div>
    </Dialog>
  )
}
