import { notFound } from 'next/navigation'
import { ZoomWorkspace } from '@/app/components/ZoomWorkspace'
import type { ZoomFlowFixture, ZoomFlowState } from '@/app/lib/zoomFlowPreview'

const stages: Record<string, ZoomFlowState> = {
  '01-selection': 'selection', '02-working': 'working', '03-review': 'review',
  '04-pinned': 'pinned', '05-accepted': 'accepted', '06-rejected': 'rejected',
}
const intro = 'Designing with words\n\nA good writing tool keeps you close to your ideas. '
const excerpt = 'Editing should feel direct. Select a passage, choose a direction, and keep your attention on the text.'
const suffix = '\n\nEvery change should stay connected to the words that started it. You can accept the revision or return to your original without losing your place.'
const replacement = 'Editing should feel direct and considered. Select a passage and choose whether to distill its meaning or explore it in greater detail. The controls stay beside your words while the revision takes shape, giving you a clear place to review the result. Accept the version that says what you mean, or reject it to return to your original.'

export default async function ZoomFlowPage({ params }: { params: Promise<{ state: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { state } = await params
  const stage = stages[state]
  if (!stage) notFound()
  const longSuffix = stage === 'pinned' ? (suffix + '\n\nRead at your own pace. The review controls stay within reach, and Back to edit returns you to the passage.').repeat(12) : suffix
  const fixture: ZoomFlowFixture = {
    stage, before: intro + excerpt + longSuffix, after: intro + replacement + longSuffix,
    range: { start: intro.length, end: intro.length + excerpt.length },
  }
  return <ZoomWorkspace preview={fixture} />
}
