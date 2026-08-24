import { focusEndReasonLabels } from '../domain/focusRecords'
import type { FocusRecord } from '../types'

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-Hans-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`
}

export function FocusRecordDetails({ records }: { records: FocusRecord[] }) {
  if (!records.length) return null

  const sorted = [...records].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  )

  return (
    <details className="focus-record-details">
      <summary>查看 {records.length} 段专注明细</summary>
      <div className="focus-record-list">
        {sorted.map((record) => {
          const source = [record.projectName, record.taskTitle].filter(Boolean).join(' · ')
          return (
            <div className="focus-record-row" key={record.id}>
              <div>
                <strong>{record.targetLabel || '自由专注'}</strong>
                <small>{source || '未关联项目或任务'}</small>
              </div>
              <div>
                <span>
                  {formatClock(record.startedAt)}–{formatClock(record.endedAt)}
                </span>
                <small>
                  {formatDuration(record.actualSeconds)} · {focusEndReasonLabels[record.endReason]}
                </small>
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}
