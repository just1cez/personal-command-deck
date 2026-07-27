/**
 * 提醒与倒计时。
 *
 * 列表始终按剩余天数排序（约定见 AGENTS.md），已过期的排在最前并标红，
 * 因为"已经错过"比"还有三天"更需要处理。
 */
import { useRef, useState } from 'react'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { useReminderActions } from '../../actions/useCaptureActions'
import { EditorCardTitle, EditorField } from '../../components/ui/EditorField'
import { ActionPanelTitle } from '../../components/ui/PanelTitle'
import { ThemedSelect } from '../../components/ui/ThemedSelect'
import { DEFAULT_REMINDER_LEAD_DAYS } from '../../config/constants'
import { reminderTypeOptions } from '../../config/options'
import { formatCountdown, isUrgentReminder, sortRemindersByDate } from '../../domain/reminders'
import { useDashboardStore } from '../../state/deckContext'
import { dateAfter, daysUntil } from '../../utils'

const DEFAULT_REMINDER_TYPE = 'Deadline'

export function RemindersPanel() {
  const { dashboard } = useDashboardStore()
  const { addReminder, removeReminder } = useReminderActions()

  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(() => dateAfter(DEFAULT_REMINDER_LEAD_DAYS))
  const [newType, setNewType] = useState(DEFAULT_REMINDER_TYPE)

  const dateInputRef = useRef<HTMLInputElement>(null)

  /** 原生日期框的图标区域太小，额外给一个大按钮来唤起选择器。 */
  const openDatePicker = () => {
    const input = dateInputRef.current
    if (!input) return
    input.focus()
    input.showPicker?.()
  }

  const submit = () => {
    if (!addReminder(newTitle, newDate, newType)) return
    setNewTitle('')
    setNewDate(dateAfter(DEFAULT_REMINDER_LEAD_DAYS))
    setNewType(DEFAULT_REMINDER_TYPE)
    setAdding(false)
  }

  return (
    <article className="panel reminders-panel">
      <ActionPanelTitle
        icon={<CalendarClock size={20} />}
        title="提醒与倒计时"
        actionLabel="新提醒"
        onAction={() => setAdding((current) => !current)}
      />

      <div className="reminder-stack">
        {sortRemindersByDate(dashboard.reminders).map((item) => {
          const days = daysUntil(item.date)
          return (
            <div className="reminder-card" key={item.id}>
              <div>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.date}</small>
              </div>
              <div className={isUrgentReminder(days) ? 'countdown urgent' : 'countdown'}>
                {formatCountdown(days)}
              </div>
              <button
                type="button"
                className="icon-button danger"
                title="删除提醒"
                onClick={() => removeReminder(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {adding && (
        <div className="field-form reminder-form">
          <EditorCardTitle action="新增提醒" preview={newTitle || '重要日期和倒计时'} />
          <EditorField label="提醒名称" className="reminder-title-field">
            <input
              value={newTitle}
              placeholder="例如 信用卡账单"
              onChange={(event) => setNewTitle(event.target.value)}
            />
          </EditorField>
          <div className="reminder-form-row">
            <EditorField label="日期" className="reminder-date-field">
              <div className="date-input-shell">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
                <button
                  type="button"
                  className="reminder-date-picker-button"
                  aria-label="打开日期选择"
                  title="打开日期选择"
                  onClick={openDatePicker}
                >
                  <CalendarClock size={18} />
                </button>
              </div>
            </EditorField>
            <EditorField label="类型" className="reminder-type-field">
              <ThemedSelect
                compact
                className="reminder-type-select"
                value={newType}
                aria-label="提醒类型"
                options={reminderTypeOptions}
                onChange={setNewType}
              />
            </EditorField>
          </div>
          <div className="quick-link-editor-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setAdding(false)}
            >
              取消
            </button>
            <button type="button" className="done-action" onClick={submit}>
              <Plus size={16} />
              添加
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
