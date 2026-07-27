/**
 * 三分钟复盘：做了什么 / 卡在哪里 / 明天第一步。
 *
 * 三个问题的顺序固定，占位文案也刻意写得很轻（"三两句就够"、"不审判自己"）——
 * 复盘只有在门槛足够低的时候才会被长期坚持。
 */
import { Pencil } from 'lucide-react'
import { useReviewActions } from '../../actions/useReviewActions'
import { ReviewSectionHeading } from '../../components/ui/PanelTitle'
import { useDashboardStore } from '../../state/deckContext'

export function ReviewFlow() {
  const { dashboard } = useDashboardStore()
  const { updateReview } = useReviewActions()

  const steps = [
    {
      key: 'did' as const,
      order: '1',
      title: '今天推进',
      placeholder: '三两句就够',
    },
    {
      key: 'stuck' as const,
      order: '2',
      title: '卡在哪里',
      placeholder: '只记录事实，不审判自己',
    },
    {
      key: 'tomorrow' as const,
      order: '3',
      title: '明天第一步',
      placeholder: '醒来直接做的那一小步',
    },
  ]

  return (
    <section className="review-flow" aria-label="三分钟复盘">
      <ReviewSectionHeading
        icon={<Pencil size={17} />}
        title="3 分钟复盘"
        aside="轻一点，写事实就够"
      />
      <div className="review-grid">
        {steps.map((step) => (
          <label className="review-step" key={step.key}>
            <span>{step.order}</span>
            <strong>{step.title}</strong>
            <textarea
              value={dashboard.review[step.key]}
              onChange={(event) => updateReview({ [step.key]: event.target.value })}
              placeholder={step.placeholder}
            />
          </label>
        ))}
      </div>
    </section>
  )
}
