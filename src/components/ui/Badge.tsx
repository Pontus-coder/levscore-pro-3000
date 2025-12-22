"use client"

import { HTMLAttributes, forwardRef } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "tier"
  tier?: string
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", tier, children, ...props }, ref) => {
    // Dynamic tier colors
    const tierColors: Record<string, string> = {
      "A": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      "B": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "C": "bg-amber-500/20 text-amber-400 border-amber-500/30",
      "D": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "F": "bg-red-500/20 text-red-400 border-red-500/30",
    }

    const variants = {
      default: "bg-slate-700/50 text-slate-300 border-slate-600",
      success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      danger: "bg-red-500/20 text-red-400 border-red-500/30",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      tier: tier ? tierColors[tier.charAt(0).toUpperCase()] || tierColors["C"] : tierColors["C"],
    }

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          border ${variants[variant]} ${className}
        `}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = "Badge"

