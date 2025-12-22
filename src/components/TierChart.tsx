"use client"

import { Card } from "./ui/Card"

interface TierChartProps {
  distribution: Record<string, number>
}

export function TierChart({ distribution }: TierChartProps) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0)
  
  const tierColors: Record<string, { bg: string; bar: string }> = {
    "A": { bg: "bg-emerald-500/20", bar: "bg-emerald-500" },
    "B": { bg: "bg-blue-500/20", bar: "bg-blue-500" },
    "C": { bg: "bg-amber-500/20", bar: "bg-amber-500" },
    "D": { bg: "bg-orange-500/20", bar: "bg-orange-500" },
    "F": { bg: "bg-red-500/20", bar: "bg-red-500" },
  }

  const sortedTiers = Object.entries(distribution).sort(([a], [b]) => {
    const order = ["A", "B", "C", "D", "F"]
    return order.indexOf(a.charAt(0).toUpperCase()) - order.indexOf(b.charAt(0).toUpperCase())
  })

  return (
    <Card variant="glass">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Tier-fördelning</h3>
      
      <div className="space-y-3">
        {sortedTiers.map(([tier, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0
          const colors = tierColors[tier.charAt(0).toUpperCase()] || tierColors["C"]
          
          return (
            <div key={tier} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-300">{tier}</span>
                <span className="text-slate-500">{count} ({percentage.toFixed(0)}%)</span>
              </div>
              <div className={`h-2 rounded-full ${colors.bg}`}>
                <div
                  className={`h-full rounded-full ${colors.bar} transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(distribution).length === 0 && (
        <p className="text-center text-slate-500 py-4">Ingen data tillgänglig</p>
      )}
    </Card>
  )
}

