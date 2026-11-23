import { useState } from 'react'

function RollingDigit({ digit, countsDown }: { digit: string; countsDown: boolean }) {
  const [change, setChange] = useState({ digit, previous: '', countsDown, revision: 0 })
  if (digit !== change.digit) {
    setChange({ digit, previous: change.digit, countsDown, revision: change.revision + 1 })
  }

  return (
    <span className="zoom-slider-digit" data-counts-down={change.countsDown || undefined}>
      {change.previous && <span key={`out-${change.revision}`} data-outgoing>{change.previous}</span>}
      <span key={change.revision} data-incoming={change.revision > 0 || undefined}>{change.digit}</span>
    </span>
  )
}

export function AnimatedWordCount({ count }: { count: number }) {
  const [change, setChange] = useState({ count, countsDown: false })
  if (count !== change.count) {
    setChange({ count, countsDown: count < change.count })
  }

  const digits = String(count)
  return (
    <>
      <span className="sr-only">{digits}</span>
      <span aria-hidden="true">
        {Array.from(digits, (digit, index) => (
          <RollingDigit key={digits.length - index} digit={digit} countsDown={change.countsDown} />
        ))}
      </span>
    </>
  )
}
