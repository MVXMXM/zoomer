export type ZoomFlowState = 'selection' | 'working' | 'review' | 'pinned' | 'accepted' | 'rejected'
export type ZoomFlowFixture = { stage: ZoomFlowState; before: string; after: string; range: { start: number; end: number } }
