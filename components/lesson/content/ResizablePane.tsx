"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { GripVertical } from "lucide-react"

interface ResizablePaneProps {
  leftPane: React.ReactNode
  rightPane: React.ReactNode
  initialWidth: number
  onWidthChange: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

export function ResizablePane({
  leftPane,
  rightPane,
  initialWidth,
  onWidthChange,
  minWidth = 20,
  maxWidth = 80,
}: ResizablePaneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [leftWidth, setLeftWidth] = useState(initialWidth)
  const [isHovering, setIsHovering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      const clampedWidth = Math.min(Math.max(newLeftWidth, minWidth), maxWidth)
      setLeftWidth(clampedWidth)
      onWidthChange(clampedWidth)
    },
    [isDragging, minWidth, maxWidth, onWidthChange],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return

      const touch = e.touches[0]
      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((touch.clientX - containerRect.left) / containerRect.width) * 100

      const clampedWidth = Math.min(Math.max(newLeftWidth, minWidth), maxWidth)
      setLeftWidth(clampedWidth)
      onWidthChange(clampedWidth)
    },
    [isDragging, minWidth, maxWidth, onWidthChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveGlobal = (e: MouseEvent) => handleMouseMove(e)
      const handleTouchMoveGlobal = (e: TouchEvent) => {
        e.preventDefault()
        handleTouchMove(e)
      }
      const handleMouseUpGlobal = () => handleMouseUp()
      const handleTouchEndGlobal = () => handleTouchEnd()

      document.addEventListener("mousemove", handleMouseMoveGlobal)
      document.addEventListener("touchmove", handleTouchMoveGlobal, { passive: false })
      document.addEventListener("mouseup", handleMouseUpGlobal)
      document.addEventListener("touchend", handleTouchEndGlobal)

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      document.body.style.webkitUserSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMoveGlobal)
        document.removeEventListener("touchmove", handleTouchMoveGlobal)
        document.removeEventListener("mouseup", handleMouseUpGlobal)
        document.removeEventListener("touchend", handleTouchEndGlobal)

        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        document.body.style.webkitUserSelect = ""
      }
    }
  }, [isDragging, handleMouseMove, handleTouchMove, handleMouseUp, handleTouchEnd])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const delta = e.key === "ArrowLeft" ? -2 : 2
        const newWidth = Math.min(Math.max(leftWidth + delta, minWidth), maxWidth)
        setLeftWidth(newWidth)
        onWidthChange(newWidth)
      }
    },
    [leftWidth, minWidth, maxWidth, onWidthChange],
  )

  const handleDoubleClick = useCallback(() => {
    const centerWidth = 50
    setLeftWidth(centerWidth)
    onWidthChange(centerWidth)
  }, [onWidthChange])

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left Pane */}
      <div style={{ width: `${leftWidth}%` }} className="overflow-hidden transition-all duration-150 ease-out">
        {leftPane}
      </div>

      <div
        ref={resizerRef}
        className={`
          group relative flex-shrink-0 flex items-center justify-center
          transition-all duration-200 ease-out cursor-col-resize
          ${
            isDragging
              ? "w-2 bg-primary shadow-lg"
              : isHovering
                ? "w-2 bg-primary/60"
                : "w-1 bg-border hover:bg-primary/40"
          }
        `}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftWidth)}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-label="Resize panels"
        title="Drag to resize panels, double-click to center, or use arrow keys"
      >
        <div
          className={`
            absolute inset-y-0 flex items-center justify-center
            transition-opacity duration-200
            ${isHovering || isDragging ? "opacity-100" : "opacity-0"}
          `}
        >
          <GripVertical
            className={`
              w-3 h-6 transition-colors duration-200
              ${isDragging ? "text-primary-foreground" : "text-primary"}
            `}
          />
        </div>

        {(isHovering || isDragging) && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-popover border border-border rounded text-xs text-popover-foreground shadow-lg whitespace-nowrap z-50">
            {Math.round(leftWidth)}% | {Math.round(100 - leftWidth)}%
          </div>
        )}
      </div>

      {/* Right Pane */}
      <div style={{ width: `${100 - leftWidth}%` }} className="overflow-hidden transition-all duration-150 ease-out">
        {rightPane}
      </div>
    </div>
  )
}
