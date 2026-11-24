import { ArticleContent } from '@/app/components/ArticleContent'

import { DocumentFooter } from '@/app/components/DocumentFooter'

export function ZoomWorkspace() {
  return (
    <main className="document-workspace [overflow-anchor:none]">
      <div id="top" className="document-layout mx-auto [overflow-anchor:none]">
        <h1 className="sr-only">Zoomer</h1>
        <ArticleContent placeholder="Type or paste any text to apply semantic zoom" />
        <DocumentFooter />
      </div>
    </main>
  )
}
