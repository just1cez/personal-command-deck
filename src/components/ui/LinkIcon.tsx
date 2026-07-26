/** 按图标名渲染快捷入口图标；映射表见 config/options.tsx，未知图标回落到链接图标。 */
import { linkIconComponents } from '../../config/options'

export function LinkIcon({ name }: { name: string }) {
  const Icon = linkIconComponents[name] ?? linkIconComponents.link
  return <Icon size={20} />
}
