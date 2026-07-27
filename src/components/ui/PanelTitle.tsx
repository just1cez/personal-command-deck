/**
 * 面板标题栏的两种形态。
 *
 * 之所以抽出来：这两段结构在各个面板里逐字重复了七八遍，
 * 改一次样式要满文件搜 `panel-title`。
 */
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'

/** 普通标题：左侧图标 + 标题，右侧可选的说明文字。 */
export function PanelTitle({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: string
}) {
  return (
    <div className="panel-title">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {aside && <span>{aside}</span>}
    </div>
  )
}

/** 带"新增"按钮的标题，用于快捷入口 / 项目 / 提醒这类可增删的面板。 */
export function ActionPanelTitle({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  title: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="panel-title panel-title-action">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      <button type="button" className="ghost-action" onClick={onAction}>
        <Plus size={15} />
        {actionLabel}
      </button>
    </div>
  )
}

/**
 * 复盘页里的小节标题。
 * 右侧内容二选一：`aside` 渲染成说明文字，`children` 用于放按钮组。
 */
export function ReviewSectionHeading({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="review-section-heading">
      <div>
        {icon}
        <span>{title}</span>
      </div>
      {aside !== undefined && <small>{aside}</small>}
      {children}
    </div>
  )
}
