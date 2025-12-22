"use client"

import { Card } from "./ui/Card"

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "default" | "success" | "warning" | "info"
}

export function KPICard({ title, value, subtitle, icon, trend, variant = "default" }: KPICardProps) {
  const accentColors = {
    default: "from-slate-500 to-slate-600",
    success: "from-emerald-500 to-teal-600",
    warning: "from-amber-500 to-orange-600",
    info: "from-blue-500 to-indigo-600",
  }

  return (
    <Card variant="glass" className="relative overflow-hidden group">
      {/* Accent gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColors[variant]} opacity-60 group-hover:opacity-100 transition-opacity`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? "text-emerald-400" : "text-red-400"}`}>
              <svg className={`w-4 h-4 ${trend.isPositive ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-xl bg-slate-800/50 text-slate-400 group-hover:text-slate-300 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

