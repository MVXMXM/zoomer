export type ZoomOperation = 'expand' | 'contract'

export type ZoomDegree = 1 | 2 | 3

export type ZoomArticleProps = {
  initialContent: string
  onLoadingStateChange?: (
    isLoading: boolean,
    activeButton: ZoomOperation | null,
    operationSummary?: { beforeCount: number; afterCount: number },
  ) => void
  onWordCountChange?: (wordCount: number) => void
  onContentManuallyEdited?: () => void
  onSelectionChange?: (hasSelection: boolean) => void
  onTransitioningChange?: (isTransitioning: boolean) => void
}
