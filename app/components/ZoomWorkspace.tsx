import { ArticleContent } from '@/app/components/ArticleContent'

const INITIAL_CONTENT = `**Welcome to Zoomer!**
An LLM-powered text editor designed for *semantic zoom*.

Just like controls on a map, you can quickly see your writing at different levels of representation. Slide the scale above to zoom the entire text, or highlight specific words to zoom only them.

How it works:
• Zoom in (microscope) distills towards irreducible simplicity
• Zoom out (telescope) extrapolates towards exhaustive detail

Replace this text with your own to zoom it!`

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
