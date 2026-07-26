/**
 * 表单里"标签 + 控件"的一行，以及编辑卡片的标题。
 *
 * 新增入口、新增项目、新增提醒、编辑入口、AI 设置这五处表单结构完全一致，
 * 抽出来后各表单只剩下自己真正关心的字段。
 */
import type { ReactNode } from 'react'

export function EditorField({
  label,
  className = '',
  children,
}: {
  label: string
  /** 追加的修饰类，例如 `reminder-date-field`。 */
  className?: string
  children: ReactNode
}) {
  return (
    <label className={['quick-link-editor-field', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

/** 编辑卡片顶部的"动作名 + 当前值预览"。 */
export function EditorCardTitle({ action, preview }: { action: string; preview: string }) {
  return (
    <div className="quick-link-editor-title">
      <span>{action}</span>
      <strong>{preview}</strong>
    </div>
  )
}
