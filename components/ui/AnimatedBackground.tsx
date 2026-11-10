"use client";

import React from "react";

type Props = {
  className?: string;
  children?: React.ReactNode;
  variant?: "light" | "teal-prominent" | "emerald" | "teacher";
};

/**
 * Full-bleed animated emerald background with cloudy gradients,
 * slow swirls, and a subtle film-grain overlay. Ideal behind
 * dashboards with glassmorphic UI panels.
 */
export function AnimatedBackground({ className = "", children, variant = "light" }: Props) {
  const bgClass =
    variant === "teal-prominent"
      ? "bg-ambient-teal-prominent"
      : variant === "emerald"
      ? "bg-emerald-ambient"
      : variant === "teacher"
      ? "bg-ambient-teacher"
      : "bg-ambient-light";
  return (
    <div className={`relative min-h-screen ${bgClass} ${className}`}>
      {/* Optional container for foreground content */}
      {children}
    </div>
  );
}

export default AnimatedBackground;
