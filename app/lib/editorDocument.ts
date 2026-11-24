const INLINE_MARKUP = /(\*\*|__|\*|_|~~|`)([^\n]+?)\1/g
const FORMATS: Record<string, string> = {
  '**': 'strong',
  '__': 'strong',
  '*': 'em',
  _: 'em',
  '~~': 's',
  '`': 'code',
}

export function renderEditorDocument(editor: HTMLElement, source: string) {
  const fragment = document.createDocumentFragment()
  let offset = 0
  for (const match of source.matchAll(INLINE_MARKUP)) {
    const [, marker, body] = match
    if (match.index > offset) fragment.append(source.slice(offset, match.index))
    const formatted = document.createElement(FORMATS[marker])
    const opening = document.createElement('span')
    opening.hidden = true
    opening.textContent = marker
    const closing = opening.cloneNode(true)
    formatted.append(opening, body, closing)
    fragment.append(formatted)
    offset = match.index + match[0].length
  }
  if (offset < source.length) fragment.append(source.slice(offset))
  if (!source || source.endsWith('\n')) fragment.append(document.createElement('br'))
  const expected = editor.cloneNode(false) as HTMLElement
  expected.append(fragment)
  if (editor.innerHTML === expected.innerHTML) return false
  editor.replaceChildren(...expected.childNodes)
  return true
}

export function editorSelection(editor: HTMLElement) {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null
  const prefix = document.createRange()
  prefix.selectNodeContents(editor)
  prefix.setEnd(range.startContainer, range.startOffset)
  const start = prefix.toString().length
  return { range, start, end: start + range.toString().length }
}

export function expandEditorRange(source: string, start: number, end: number) {
  if (start === end) return { start, end }
  for (const match of source.matchAll(INLINE_MARKUP)) {
    const markerLength = match[1].length
    const left = match.index
    const right = left + match[0].length
    if (start <= left + markerLength && end >= right - markerLength) {
      start = Math.min(start, left)
      end = Math.max(end, right)
    }
  }
  return { start, end }
}

export function editorLineBreak(source: string, start: number, end: number) {
  const expanded = expandEditorRange(source, start, end)
  for (const match of source.matchAll(INLINE_MARKUP)) {
    const marker = match[1]
    const bodyStart = match.index + marker.length
    const bodyEnd = bodyStart + match[2].length
    if (expanded.start < bodyStart || expanded.end > bodyEnd) continue

    const before = expanded.start > bodyStart ? marker : ''
    const after = expanded.end < bodyEnd ? marker : ''
    const from = before ? expanded.start : match.index
    const to = after ? expanded.end : bodyEnd + marker.length
    return { start: from, end: to, text: before + '\n' + after, caret: from + before.length + 1 + after.length }
  }
  return { ...expanded, text: '\n', caret: expanded.start + 1 }
}

export function setEditorSelection(editor: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  let offset = 0
  let startPoint: { node: Node; offset: number } | undefined
  let endPoint: { node: Node; offset: number } | undefined
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0
    if (!node.parentElement?.hidden) {
      if (!startPoint && start >= offset && start <= offset + length) {
        startPoint = { node, offset: start - offset }
      }
      if (end >= offset && end <= offset + length) {
        endPoint = { node, offset: end - offset }
        break
      }
    }
    offset += length
  }
  if (startPoint) range.setStart(startPoint.node, startPoint.offset)
  else if (start !== end) range.setStart(editor, 0)
  if (endPoint) range.setEnd(endPoint.node, endPoint.offset)
  if (start === end) range.collapse()
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
