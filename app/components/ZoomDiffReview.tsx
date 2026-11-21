'use client'

import { useEffect, useRef } from 'react'
import { Check, Undo2 } from 'lucide-react'

type ZoomDiffReviewProps = {
  onAccept: () => void
  onReject: () => void
}

export function ZoomDiffReview({ onAccept, onReject }: ZoomDiffReviewProps) {
  const acceptRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    acceptRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      role="group"
      aria-label="Zoom result"
      className="review-dock-in fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 p-2 backdrop-blur-[30px]"
      style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(196, 196, 196, 0.45) 100%)',
        boxShadow: '0 0 40px 0 rgba(179, 179, 179, 0.15), 0 8px 32px 0 rgba(31, 38, 135, 0.2)',
      }}
    >
      <button
        type="button"
        onClick={onReject}
        aria-keyshortcuts="Escape"
        className="flex h-12 min-w-[128px] items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold text-slate-800 transition-shadow hover:shadow-[0_0_24px_rgba(255,255,255,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06b6d4]"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(226, 232, 240, 0.88) 100%)',
          boxShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
        }}
      >
        <Undo2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
        Reject
      </button>
      <button
        ref={acceptRef}
        type="button"
        onClick={onAccept}
        aria-keyshortcuts="Enter"
        className="flex h-12 min-w-[128px] items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold text-cyan-950 transition-shadow hover:shadow-[0_0_24px_rgba(6,182,212,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06b6d4]"
        style={{
          background: 'linear-gradient(180deg, #a5f3fc 0%, #22d3ee 100%)',
          boxShadow: '0 8px 24px rgba(6, 182, 212, 0.28)',
        }}
      >
        <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
        Accept
      </button>
    </div>
  )
}
