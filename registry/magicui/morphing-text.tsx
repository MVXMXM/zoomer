"use client"

import { AnimatePresence, motion } from "framer-motion"

export function MorphingText({
  children,
  className,
  duration = 0.4,
  blur = 4,
  distance = 10,
}: {
  children: React.ReactNode
  className?: string
  duration?: number
  blur?: number
  distance?: number
}) {
  const key = typeof children === "string" ? children : "rich"
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, filter: `blur(${blur}px)`, y: distance }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: `blur(${blur}px)`, y: -distance }}
          transition={{ duration, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
