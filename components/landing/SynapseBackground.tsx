"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

interface Connection {
  from: Node
  to: Node
  opacity: number
}

export function SynapseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const nodesRef = useRef<Node[]>([])
  const connectionsRef = useRef<Connection[]>([])
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createNodes = () => {
      const nodes: Node[] = []
      const nodeCount = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 12000))

      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
        })
      }
      return nodes
    }

    const updateConnections = (nodes: Node[]) => {
      const connections: Connection[] = []
      const maxDistance = 180

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < maxDistance) {
            connections.push({
              from: nodes[i],
              to: nodes[j],
              opacity: Math.max(0, 1 - distance / maxDistance),
            })
          }
        }
      }
      return connections
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update node positions
      nodesRef.current.forEach((node) => {
        node.x += node.vx
        node.y += node.vy

        // Bounce off edges
        if (node.x <= 0 || node.x >= canvas.width) node.vx *= -1
        if (node.y <= 0 || node.y >= canvas.height) node.vy *= -1

        // Keep nodes in bounds
        node.x = Math.max(0, Math.min(canvas.width, node.x))
        node.y = Math.max(0, Math.min(canvas.height, node.y))
      })

      // Update connections
      connectionsRef.current = updateConnections(nodesRef.current)

      // Draw connections with theme-aware colors
      const isDark = resolvedTheme === "dark"
      connectionsRef.current.forEach((connection) => {
        ctx.beginPath()
        ctx.moveTo(connection.from.x, connection.from.y)
        ctx.lineTo(connection.to.x, connection.to.y)

        if (isDark) {
          // Keep dark mode opacity as is
          ctx.strokeStyle = `rgba(16, 185, 129, ${connection.opacity * 0.7})`
        } else {
          // Reduce light mode opacity for better text readability
          ctx.strokeStyle = `rgba(52, 211, 153, ${connection.opacity * 0.4})`
        }

        ctx.lineWidth = 1.5
        ctx.stroke()
      })

      // Draw nodes with theme-aware colors
      nodesRef.current.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)

        if (isDark) {
          // Keep dark mode opacity as is
          ctx.fillStyle = "rgba(16, 185, 129, 0.9)"
          ctx.shadowColor = "rgba(16, 185, 129, 0.5)"
          ctx.shadowBlur = 8
        } else {
          // Reduce light mode opacity for better text readability
          ctx.fillStyle = "rgba(52, 211, 153, 0.6)"
          ctx.shadowColor = "rgba(52, 211, 153, 0.2)"
          ctx.shadowBlur = 4
        }

        ctx.fill()
        ctx.shadowBlur = 0
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    resizeCanvas()
    nodesRef.current = createNodes()
    animate()

    const handleResize = () => {
      resizeCanvas()
      nodesRef.current = createNodes()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [resolvedTheme])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />
}
