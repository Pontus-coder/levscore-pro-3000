"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/Card"

interface Article {
  id: string
  articleNumber: string
  description: string | null
  quantity: number
  revenue: number
  grossProfit: number | null
  margin: number | null
  revenueShare: number
  accumulatedShare: number
  category: string | null
}

interface ArticleListProps {
  supplierId: string
}

export function ArticleList({ supplierId }: ArticleListProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch(`/api/suppliers/${supplierId}/articles`)
        if (!response.ok) throw new Error("Failed to fetch articles")
        const data = await response.json()
        setArticles(data.articles || [])
      } catch (error) {
        console.error("Error fetching articles:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (supplierId) {
      fetchArticles()
    }
  }, [supplierId])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  // Filtrera artiklar: visa A-artiklar alltid, B och C endast om showAll är true
  const aArticles = articles.filter((a) => a.category === "A")
  const bArticles = articles.filter((a) => a.category === "B")
  const cArticles = articles.filter((a) => a.category === "C")

  const displayedArticles = showAll
    ? articles
    : aArticles // Visa bara A-artiklar som standard

  const hasBCArticles = bArticles.length > 0 || cArticles.length > 0

  if (isLoading) {
    return (
      <Card variant="glass">
        <div className="text-slate-400 text-sm">Laddar artiklar...</div>
      </Card>
    )
  }

  if (articles.length === 0) {
    return (
      <Card variant="glass">
        <div className="text-slate-400 text-sm">Inga artiklar hittades för denna leverantör.</div>
      </Card>
    )
  }

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Artiklar</h2>
        {hasBCArticles && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {showAll ? "Visa endast A-artiklar" : `Visa alla (${articles.length})`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {displayedArticles.map((article, index) => {
          const isA = article.category === "A"
          const isB = article.category === "B"
          const isC = article.category === "C"

          return (
            <div
              key={article.id}
              className={`p-3 rounded-lg border transition-all ${
                isA
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : isB
                  ? "bg-blue-500/10 border-blue-500/30 opacity-70"
                  : "bg-slate-700/50 border-slate-600/50 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isA && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold">
                        A
                      </span>
                    )}
                    {isB && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-bold">
                        B
                      </span>
                    )}
                    {isC && (
                      <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs font-bold">
                        C
                      </span>
                    )}
                    <span className="font-medium text-slate-200 truncate">
                      {article.articleNumber}
                    </span>
                  </div>
                  {article.description && (
                    <div className="text-sm text-slate-400 truncate mb-1">
                      {article.description}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Antal: {article.quantity.toLocaleString("sv-SE")}</span>
                    {article.margin !== null && (
                      <span>TG: {formatPercent(article.margin)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-200 mb-0.5">
                    {formatCurrency(article.revenue)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(article.revenueShare)} • Ack: {formatPercent(article.accumulatedShare)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!showAll && hasBCArticles && (
        <div className="mt-4 pt-4 border-t border-slate-700 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Visa B-artiklar ({bArticles.length}) och C-artiklar ({cArticles.length})
          </button>
        </div>
      )}
    </Card>
  )
}

