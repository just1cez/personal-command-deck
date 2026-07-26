/**
 * 全局呼出快捷键的录制器。
 *
 * 为什么不用普通输入框：Electron 的 accelerator 是 `CommandOrControl+Shift+Space`
 * 这种字符串，手打既难记又容易写出主进程注册不了的组合。改成"按下即录制"后，
 * 显示区是只读的，用户按什么就录什么。
 *
 * 三个容易踩的坑，都在下面处理了：
 * - 录制期间必须让主进程挂起已注册的热键（onRecordingChange），
 *   否则按下与当前热键相同的组合会被主进程抢走，永远录不进来；
 * - 用捕获阶段监听并 preventDefault，避免按键先被页面里的其他快捷键消费；
 * - 窗口失焦时自动结束录制，否则会停在"按下组合键…"的状态出不来。
 */
import { useCallback, useEffect, useState } from 'react'
import { Keyboard, X } from 'lucide-react'

/** accelerator 里的修饰键名 -> 界面上显示的短名。 */
const shortcutDisplayNames: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  CmdOrCtrl: 'Ctrl',
  Control: 'Ctrl',
  Ctrl: 'Ctrl',
  Command: 'Cmd',
  Alt: 'Alt',
  Option: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
  Meta: 'Win',
}

const formatAccelerator = (accelerator: string) =>
  accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => shortcutDisplayNames[part] ?? part)
    .join(' + ')

// 与 electron/main.cjs 的 isSafeAccelerator 保持一致：只产出白名单里的按键名
const acceleratorKeyByCode: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Backslash: '\\',
}

/**
 * 从事件里取出主键名。
 * 用 `code`（物理按键）而不是 `key`：后者会受输入法和修饰键影响，
 * 按 Shift+2 在 `key` 里是 `@`，注册热键时并不通用。
 */
const acceleratorKeyFromEvent = (event: KeyboardEvent) => {
  const { code } = event
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F(?:[1-9]|1\d|2[0-4])$/.test(code)) return code
  return acceleratorKeyByCode[code] ?? ''
}

const modifiersFromEvent = (event: KeyboardEvent) =>
  [
    event.ctrlKey ? 'CommandOrControl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Super' : '',
  ].filter(Boolean)

export function ShortcutRecorder({
  value,
  disabled,
  onCapture,
  onRecordingChange,
}: {
  value: string
  disabled: boolean
  /** 录到一个合法组合时回调，参数是 Electron 格式的 accelerator。 */
  onCapture: (accelerator: string) => void
  /** 录制开始/结束，用于让主进程临时挂起全局热键。 */
  onRecordingChange?: (recording: boolean) => void
}) {
  const [recording, setRecording] = useState(false)
  /** 只按下了修饰键时的实时预览。 */
  const [previewModifiers, setPreviewModifiers] = useState<string[]>([])
  /** 按了主键但没带修饰键——这种组合太容易误触，不允许。 */
  const [needsModifier, setNeedsModifier] = useState(false)

  const stopRecording = useCallback(() => {
    setRecording(false)
    setPreviewModifiers([])
    setNeedsModifier(false)
  }, [])

  useEffect(() => {
    if (!recording) return
    onRecordingChange?.(true)
    return () => onRecordingChange?.(false)
  }, [recording, onRecordingChange])

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        stopRecording()
        return
      }

      const modifiers = modifiersFromEvent(event)
      const key = acceleratorKeyFromEvent(event)

      // 还没按到主键：只更新预览。
      if (!key) {
        setPreviewModifiers(modifiers)
        setNeedsModifier(false)
        return
      }
      // 光一个主键不够，提示用户加修饰键。
      if (!modifiers.length) {
        setPreviewModifiers([])
        setNeedsModifier(true)
        return
      }

      stopRecording()
      onCapture([...modifiers, key].join('+'))
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setPreviewModifiers(modifiersFromEvent(event))
    }

    const handleWindowBlur = () => stopRecording()

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [recording, onCapture, stopRecording])

  const displayValue = recording
    ? previewModifiers.length
      ? `${formatAccelerator(previewModifiers.join('+'))} + …`
      : needsModifier
        ? '需要搭配 Ctrl / Alt / Shift'
        : '按下组合键…'
    : formatAccelerator(value) || '未设置'

  return (
    <div
      className={['shortcut-recorder', recording ? 'recording' : ''].filter(Boolean).join(' ')}
    >
      <span
        className="shortcut-recorder-value"
        title={recording ? '正在录制快捷键，Esc 取消' : value}
        aria-live="polite"
      >
        {displayValue}
      </span>
      <button
        type="button"
        disabled={disabled}
        title={recording ? '取消录制 (Esc)' : '录制新的呼出快捷键'}
        aria-label={recording ? '取消录制快捷键' : '录制新的呼出快捷键'}
        onClick={() => {
          if (recording) {
            stopRecording()
          } else {
            setRecording(true)
          }
        }}
      >
        {recording ? <X size={14} /> : <Keyboard size={14} />}
        {recording ? '取消' : '修改'}
      </button>
    </div>
  )
}
