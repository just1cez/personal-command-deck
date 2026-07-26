/**
 * 本机保留天数的设置控件：快捷下拉 + 自定义天数步进器。
 *
 * 两个入口并存是有意的——大多数人从下拉里选个 30/90 天就够了，
 * 少数想精确控制的人可以直接敲天数。
 */
import { useState } from 'react'
import { CalendarClock, Minus, Plus } from 'lucide-react'
import { RETENTION_STEP_DAYS } from '../config/constants'
import { retentionOptions } from '../config/options'
import { clampRetentionDays, getRetentionLabel } from '../domain/retention'
import { ThemedSelect } from './ui/ThemedSelect'

export function RetentionControls({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  /** 天数以字符串形式回传（输入框与下拉框都是字符串），由调用方统一收敛。 */
  onChange: (value: string) => void
}) {
  /**
   * 输入框的草稿态：**逐键提交会误删数据**。
   * 把 90 改成 30 的过程中会经过 9、3 这些中间值，每一个都会立刻按新天数清理归档。
   * 因此输入过程中只记草稿，失焦（或回车触发失焦）时才真正提交。
   */
  const [draft, setDraft] = useState<string | null>(null)

  const selectValue = String(value)

  // 用户敲了一个不在快捷选项里的天数时，临时插一条把它显示出来，
  // 否则下拉框会显示成另一个值，看起来像设置没生效。
  const options = retentionOptions.some((option) => option.value === selectValue)
    ? retentionOptions
    : [
        {
          value: selectValue,
          label: getRetentionLabel(value),
          icon: <CalendarClock size={15} />,
        },
        ...retentionOptions,
      ]

  return (
    <>
      <label className="retention-select-field">
        <span>{label}</span>
        <ThemedSelect
          compact
          value={selectValue}
          aria-label={label}
          options={options}
          onChange={onChange}
        />
      </label>
      <label className="retention-stepper-field">
        <span>自定义天数</span>
        <div className="retention-stepper">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
            onBlur={() => {
              if (draft === null) return
              onChange(draft)
              setDraft(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // 交给 onBlur 统一提交，只有一条提交路径。
                event.currentTarget.blur()
              }
            }}
          />
          <div>
            <button
              type="button"
              title={`增加 ${RETENTION_STEP_DAYS} 天`}
              aria-label={`增加 ${RETENTION_STEP_DAYS} 天`}
              onClick={() => onChange(String(clampRetentionDays(value + RETENTION_STEP_DAYS)))}
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              title={`减少 ${RETENTION_STEP_DAYS} 天`}
              aria-label={`减少 ${RETENTION_STEP_DAYS} 天`}
              disabled={value <= 0}
              onClick={() => onChange(String(clampRetentionDays(value - RETENTION_STEP_DAYS)))}
            >
              <Minus size={13} />
            </button>
          </div>
        </div>
      </label>
    </>
  )
}
