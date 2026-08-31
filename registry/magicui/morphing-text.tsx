"use client"

import { AnimatePresence, motion } from "framer-motion"

export function MorphingText({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const key = typeof children === "string" ? children : "rich"
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(4px)", y: -10 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
