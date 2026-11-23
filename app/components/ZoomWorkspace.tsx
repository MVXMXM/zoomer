import { ArticleContent } from '@/app/components/ArticleContent'
import zoomerVersion from '@/zoomer-version.json'

const INITIAL_CONTENT =
  `Welcome to Zoomer (v${zoomerVersion.version}), a LLM toy to let you easily experiment with semantic zoom. ` +
  'Highlight this text to reveal a control bar that allows you to zoom in (distill selected text to its irreducible simplicity) or zoom out (extrapolate selected text into a more exhaustive & thorough representation). ' +
  'This app works like a word document, allowing you to type or paste any text you want to apply semantic zoom to.'

export function ZoomWorkspace() {
  return (
    <main className="document-workspace [overflow-anchor:none]">
      <div id="top" className="document-layout mx-auto [overflow-anchor:none]">
        <h1 className="sr-only">Zoomer</h1>
        <ArticleContent initialContent={INITIAL_CONTENT} />
        <footer className="document-footer">
          {'"'}<a href="https://github.com/MVXMXM/zoomer" target="_blank" rel="noopener noreferrer">ZOOMER</a>{'" BY '}
          <a href="https://mvxmxm.com" target="_blank" rel="noopener noreferrer">MAXIMILLIAN PIRAS</a>
        </footer>
      </div>
    </main>
  )
}
