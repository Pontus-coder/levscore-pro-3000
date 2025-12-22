"use client"

import { HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient"
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-slate-900/80 border border-slate-800",
      glass: "bg-slate-900/40 backdrop-blur-xl border border-slate-700/50",
      gradient: "bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50",
    }

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-6 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = "Card"

