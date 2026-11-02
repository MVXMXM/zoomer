'use client'

import { useEffect, useId, useLayoutEffect, useState } from 'react'
import { Microscope, Telescope } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { GlassSettings } from '@/app/lib/glassSettings'
import { createLensMap } from '@/app/lib/glassRefraction'

type ControlBarProps = {
  settings: GlassSettings
  visible: boolean
  anchor: {
    x: number
    y: number
    placement: 'above' | 'below'
  } | null
  sourceRef: React.RefObject<HTMLTextAreaElement | null>
  sourceText: string
  disabled: boolean
  onContract: () => void
  onExpand: () => void
}

type SourceGeometry = {
  left: number
  top: number
  width: number
  height: number
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  color: string
}

export function ControlBar({ settings, visible, anchor, sourceRef, sourceText, disabled, onContract, onExpand }: ControlBarProps) {
  const reduceMotion = useReducedMotion()
  const menuMotion = settings.motion
  const hiddenOffset = (anchor?.placement === 'above' ? 1 : -1) * menuMotion.distance
  const glassSettings = { ...settings.shape, ...settings.refraction, ...settings.lighting }
  const [sourceGeometry, setSourceGeometry] = useState<SourceGeometry | null>(null)
  const [lensMap, setLensMap] = useState('')
  const filterInstanceId = useId().replace(/:/g, '')
  const controlWidth = glassSettings.width
  const controlHeight = glassSettings.height
  const controlRadius = Math.min(controlHeight / 2, glassSettings.borderRadius)
  const controlTop = anchor?.y ?? null
  const displacementScale = glassSettings.scale * 200
  const chromaOffset = glassSettings.chroma * 2
  const filterId = `glass-content-${filterInstanceId}-${controlWidth}-${controlHeight}-${Math.round(controlRadius)}-${Math.round(glassSettings.scale * 1000)}-${glassSettings.depth}-${glassSettings.curvature}-${Math.round(glassSettings.splay * 100)}-${Math.round(glassSettings.chroma * 100)}-${Math.round(glassSettings.blur * 10)}`
  useEffect(() => {
    setLensMap(
      createLensMap({
        width: controlWidth,
        height: controlHeight,
        radius: controlRadius,
        depth: glassSettings.depth * (controlHeight / 60),
        curvature: glassSettings.curvature,
        splay: glassSettings.splay,
      }),
    )
  }, [controlHeight, controlRadius, controlWidth, glassSettings.curvature, glassSettings.depth, glassSettings.splay])

  useLayoutEffect(() => {
    const textarea = sourceRef.current
    if (!visible || !anchor || !textarea) return
    const rect = textarea.getBoundingClientRect()
    const style = window.getComputedStyle(textarea)
    setSourceGeometry({
      left: rect.left - textarea.scrollLeft - (anchor.x - controlWidth / 2),
      top: rect.top - textarea.scrollTop - (controlTop ?? anchor.y),
      width: rect.width,
      height: Math.max(rect.height, textarea.scrollHeight),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      color: style.color,
    })
  }, [anchor, controlTop, controlWidth, sourceRef, sourceText, visible])

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {lensMap && (
            <filter id={filterId} x="-20%" y="-30%" width="140%" height="160%" colorInterpolationFilters="sRGB">
              <feImage
                href={lensMap}
                x="0"
                y="0"
                width={controlWidth}
                height={controlHeight}
                preserveAspectRatio="none"
                result="lens-map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="lens-map"
                scale={displacementScale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="refracted"
              />
              <feGaussianBlur
                in="refracted"
                stdDeviation={1.8 + glassSettings.blur * 1.5}
                result="displaced"
              />
              <feOffset in="displaced" dx={-chromaOffset} result="red-offset" />
              <feFlood floodColor="#ff453a" floodOpacity={glassSettings.chroma * 0.18} result="red-color" />
              <feComposite in="red-color" in2="red-offset" operator="in" result="red-fringe" />
              <feOffset in="displaced" dx={chromaOffset} result="blue-offset" />
              <feFlood floodColor="#32ade6" floodOpacity={glassSettings.chroma * 0.16} result="blue-color" />
              <feComposite in="blue-color" in2="blue-offset" operator="in" result="blue-fringe" />
              <feMerge>
                <feMergeNode in="red-fringe" />
                <feMergeNode in="blue-fringe" />
                <feMergeNode in="displaced" />
              </feMerge>
            </filter>
          )}
        </defs>
      </svg>

      <div
        aria-hidden={!visible}
        inert={!visible}
        className="fixed z-50"
        style={{
          zIndex: 9999,
          left: anchor?.x ?? '50%',
          top: controlTop ?? '100%',
          pointerEvents: visible ? 'auto' : 'none',
          transform: 'translate3d(-50%, 0, 0)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94, y: reduceMotion ? 0 : hiddenOffset }}
          animate={{
            opacity: visible ? 1 : 0,
            scale: reduceMotion || visible ? 1 : 0.94,
            y: reduceMotion || visible ? 0 : hiddenOffset,
          }}
          transition={reduceMotion
            ? { duration: 0.1 }
            : {
                opacity: { duration: visible ? Math.min(0.16, menuMotion.enterDuration) : menuMotion.exitDuration },
                scale: visible
                  ? { type: 'spring', visualDuration: menuMotion.enterDuration, bounce: menuMotion.bounce }
                  : { duration: menuMotion.exitDuration, ease: 'easeIn' },
                y: visible
                  ? { type: 'spring', visualDuration: menuMotion.enterDuration, bounce: menuMotion.bounce }
                  : { duration: menuMotion.exitDuration, ease: 'easeIn' },
              }
          }
          role="group"
          aria-label="Text selection actions"
          className="control-container liquid-glass relative flex items-center p-1.5"
          style={{
            position: 'relative',
            transformOrigin: anchor?.placement === 'above' ? '50% 100%' : '50% 0%',
            width: controlWidth,
            height: controlHeight,
            borderRadius: controlRadius,
            '--glass-glow': glassSettings.glow,
            '--glass-glow-wide': glassSettings.glow * 0.25,
            '--glass-edge-highlight': glassSettings.edgeHighlight,
            '--glass-rim': 0.55 + glassSettings.edgeHighlight * 0.45,
            '--glass-specular-angle': `${glassSettings.specularAngle}deg`,
            '--glass-specular-cross-angle': `${(glassSettings.specularAngle + 90) % 360}deg`,
            '--glass-icon-size': `${glassSettings.iconSize}px`,
            '--glass-label-size': `${glassSettings.labelSize}px`,
            '--glass-menu-radius': `${controlRadius}px`,
            '--glass-backdrop-blur': `${glassSettings.backdropBlur}px`,
            '--glass-tint': glassSettings.tint,
          } as React.CSSProperties}
          onMouseDown={(e) => {
            // Keep the textarea highlight when Distill / Extrapolate is clicked.
            e.preventDefault()
          }}
        >
          <div className="liquid-glass-surface" aria-hidden="true">
            {sourceGeometry && (
              <div
                className="glass-refraction-viewport"
                style={{
                  filter: `url(#${filterId})`,
                  opacity: 0.32,
                }}
              >
                <div
                  className="glass-refraction-content"
                  style={{
                    left: sourceGeometry.left,
                    top: sourceGeometry.top,
                    width: sourceGeometry.width,
                    minHeight: sourceGeometry.height,
                    fontFamily: sourceGeometry.fontFamily,
                    fontSize: sourceGeometry.fontSize,
                    fontWeight: sourceGeometry.fontWeight,
                    lineHeight: sourceGeometry.lineHeight,
                    letterSpacing: sourceGeometry.letterSpacing,
                    color: sourceGeometry.color,
                  }}
                >
                  {sourceText}
                </div>
              </div>
            )}
          </div>
          <div className="liquid-glass-rim" aria-hidden="true" />

          <button
            className="liquid-glass-button glass-menu-action"
            onClick={onContract}
            title="Distill (←)"
            aria-keyshortcuts="ArrowLeft"
            disabled={disabled}
            type="button"
          >
            <Microscope className="glass-action-icon" strokeWidth={2} aria-hidden="true" />
            <span>Distill</span>
          </button>

          <button
            className="liquid-glass-button glass-menu-action"
            onClick={onExpand}
            title="Extrapolate (→)"
            aria-keyshortcuts="ArrowRight"
            disabled={disabled}
            type="button"
          >
            <Telescope className="glass-action-icon" strokeWidth={2} aria-hidden="true" />
            <span>Extrapolate</span>
          </button>
        </motion.div>
      </div>
    </>
  )
}
