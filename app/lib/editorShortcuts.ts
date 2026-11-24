type EditorEdit = {
  start: number
  end: number
  text: string
  selectionStart: number
  selectionEnd: number
}

const BULLET = '• '
const MARKUP: Partial<Record<string, string>> = { b: '**', i: '_', '`': '`' }

export function editorShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing'>,
  value: string,
  start: number,
  end: number,
): EditorEdit | undefined {
  if (event.isComposing || event.altKey) return

  const { key, shiftKey } = event
  if (event.metaKey || event.ctrlKey) {
    const letter = key.toLowerCase()
    const marker = shiftKey
      ? letter === 'x' ? '~~' : undefined
      : MARKUP[letter]
    if (!marker) return

    if (start === end) {
      return { start, end, text: marker + marker, selectionStart: start + marker.length, selectionEnd: end + marker.length }
    }

    return formatSelection(value, start, end, marker)
  }

  if (start !== end || shiftKey || (key !== ' ' && key !== 'Enter')) return

  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', start)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const line = value.slice(lineStart, lineEnd)
  if (start === lineEnd && line === '-') {
    return {
      start: lineStart,
      end: start,
      text: BULLET,
      selectionStart: lineStart + BULLET.length,
      selectionEnd: lineStart + BULLET.length,
    }
  }
  if (key !== 'Enter' || !line.startsWith(BULLET) || start < lineStart + BULLET.length) return

  if (!line.slice(BULLET.length).trim()) {
    return { start: lineStart, end: lineEnd, text: '', selectionStart: lineStart, selectionEnd: lineStart }
  }

  const text = '\n' + BULLET
  return { start, end, text, selectionStart: start + text.length, selectionEnd: start + text.length }
}

function formatSelection(value: string, start: number, end: number, marker: string): EditorEdit | undefined {
  const edits: { start: number; end: number; body: string; remove: boolean }[] = []
  const markerLength = marker.length
  let offset = start
  for (const line of value.slice(start, end).split('\n')) {
    const trimmed = line.trim()
    if (trimmed) {
      const from = offset + line.length - line.trimStart().length
      const to = from + trimmed.length
      const openingInside = trimmed.startsWith(marker)
      const closingInside = trimmed.endsWith(marker)
      const body = trimmed.slice(openingInside ? markerLength : 0, closingInside ? -markerLength : undefined)
      const remove = Boolean(body) && !body.includes(marker) &&
        (openingInside || value.slice(Math.max(0, from - markerLength), from) === marker) &&
        (closingInside || value.startsWith(marker, to))
      edits.push({
        start: remove && !openingInside ? from - markerLength : from,
        end: remove && !closingInside ? to + markerLength : to,
        body: remove ? body : trimmed,
        remove,
      })
    }
    offset += line.length + 1
  }
  if (!edits.length) return

  const remove = edits.every((edit) => edit.remove)
  const first = edits[0]
  const last = edits[edits.length - 1]
  const replaceStart = Math.min(start, first.start)
  const replaceEnd = Math.max(end, last.end)
  // A line can already contain formatted words. Coalesce complete spans of the
  // same style before wrapping the line, so their delimiters cannot close it early.
  const escapedMarker = marker.replace(/\*/g, '\\*')
  const sameStyle = new RegExp(escapedMarker + '(.+?)' + escapedMarker, 'g')
  let text = ''
  let cursor = replaceStart
  let selectionStart = replaceStart
  let selectionEnd = replaceStart
  for (const edit of edits) {
    text += value.slice(cursor, edit.start)
    if (!remove) text += marker
    if (edit === first) selectionStart = start < edit.start ? start : replaceStart + text.length
    text += remove ? edit.body : edit.body.replace(sameStyle, '$1')
    selectionEnd = replaceStart + text.length
    if (!remove) text += marker
    cursor = edit.end
  }
  text += value.slice(cursor, replaceEnd)
  if (end > last.end) selectionEnd = replaceStart + text.length
  return { start: replaceStart, end: replaceEnd, text, selectionStart, selectionEnd }
}
