"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/Header"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { FactorForm } from "@/components/FactorForm"

interface CustomFactor {
  id: string
  factorName: string
  factorValue: string
  weight: string
  comment: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface Supplier {
  id: string
  supplierNumber: string
  name: string
  rowCount: number
  totalQuantity: number
  totalRevenue: string
  avgMargin: string
  salesScore: string
  assortmentScore: string
  efficiencyScore: string
  marginScore: string
  totalScore: string
  diagnosis: string | null
  shortAction: string | null
  revenueShare: string
  accumulatedShare: string
  tier: string | null
  profile: string | null
  customFactors: CustomFactor[]
  adjustedTotalScore: number
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<{
    diagnosis: string
    opportunities: string
    action: string
    priority: "high" | "medium" | "low"
    confidence: number
  } | null>(null)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [isAIPowered, setIsAIPowered] = useState(false)

  const fetchSupplier = useCallback(async () => {
    try {
      const response = await fetch(`/api/suppliers/${resolvedParams.id}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte hämta leverantör")
      }
      
      setSupplier(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchSupplier()
    }
  }, [session, fetchSupplier])

  const handleDeleteFactor = async (factorId: string) => {
    try {
      const response = await fetch(`/api/factors?id=${factorId}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort faktorn")
      }
      
      fetchSupplier()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    }
  }

  const fetchAIAnalysis = async () => {
    if (!supplier) return
    
    setIsLoadingAI(true)
    try {
      const response = await fetch(`/api/suppliers/${resolvedParams.id}/ai-analysis`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte generera AI-analys")
      }
      
      setAiAnalysis(data.analysis)
      setIsAIPowered(data.isAIPowered)
    } catch (err) {
      console.error("AI analysis error:", err)
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoadingAI(false)
    }
  }

  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">Hög prioritet</span>
      case "medium":
        return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Medium</span>
      case "low":
        return <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs font-medium">Låg prioritet</span>
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  const formatPercent = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return `${num.toFixed(1)}%`
  }

  // Färger baserat på procent av max (0-100%)
  const getScoreColor = (percent: number) => {
    if (percent >= 80) return "text-emerald-400"
    if (percent >= 60) return "text-blue-400"
    if (percent >= 40) return "text-amber-400"
    if (percent >= 20) return "text-orange-400"
    return "text-red-400"
  }

  const getScoreBg = (percent: number) => {
    if (percent >= 80) return "bg-emerald-500"
    if (percent >= 60) return "bg-blue-500"
    if (percent >= 40) return "bg-amber-500"
    if (percent >= 20) return "bg-orange-500"
    return "bg-red-500"
  }

  // Färger för total score (max 10)
  const getTotalScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400"
    if (score >= 6) return "text-blue-400"
    if (score >= 4) return "text-amber-400"
    if (score >= 2) return "text-orange-400"
    return "text-red-400"
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/dashboard">
              <Button variant="secondary">Tillbaka till dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!supplier) {
    return null
  }

  // Varje score har sitt eget maxvärde
  const scores = [
    { name: "Sales", value: parseFloat(supplier.salesScore), max: 3, label: "Försäljning", desc: "Omsättning relativt till andra" },
    { name: "Assortment", value: parseFloat(supplier.assortmentScore), max: 2, label: "Sortimentsbredd", desc: "Antal artiklar/rader" },
    { name: "Efficiency", value: parseFloat(supplier.efficiencyScore), max: 2, label: "Effektivitet", desc: "Omsättning per artikel" },
    { name: "Margin", value: parseFloat(supplier.marginScore), max: 3, label: "Marginal", desc: "Täckningsgrad (TG)" },
  ]
  
  const totalMax = 10 // Sum av alla max (3+2+2+3)

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 transition-colors">
            ← Tillbaka till dashboard
          </Link>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-100">{supplier.name}</h1>
              {supplier.tier && (
                <Badge variant="tier" tier={supplier.tier} className="text-sm">
                  {supplier.tier}
                </Badge>
              )}
            </div>
            <p className="text-slate-400">Leverantörsnummer: {supplier.supplierNumber}</p>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold mb-1">
              <span className={getTotalScoreColor(supplier.adjustedTotalScore)}>
                {supplier.adjustedTotalScore.toFixed(1)}
              </span>
              <span className="text-xl text-slate-500 font-normal"> / 10</span>
            </div>
            <p className="text-sm text-slate-500">
              Total Score (inkl. egna faktorer)
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score Breakdown */}
            <Card variant="glass">
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Score-fördelning</h2>
              <p className="text-sm text-slate-500 mb-6">Varje kategori bidrar till den totala scoren (max {totalMax})</p>
              
              {/* Total Score Bar */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-slate-300 font-medium">Total Score</span>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${getTotalScoreColor(supplier.adjustedTotalScore)}`}>
                      {supplier.adjustedTotalScore.toFixed(1)}
                    </span>
                    <span className="text-slate-500 text-sm ml-1">/ {totalMax}</span>
                  </div>
                </div>
                <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getScoreBg((supplier.adjustedTotalScore / totalMax) * 100)} transition-all duration-500`}
                    style={{ width: `${Math.min((supplier.adjustedTotalScore / totalMax) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-5">
                {scores.map((score) => {
                  const percent = (score.value / score.max) * 100
                  return (
                    <div key={score.name}>
                      <div className="flex justify-between items-end mb-1.5">
                        <div>
                          <span className="text-slate-200 font-medium">{score.label}</span>
                          <p className="text-xs text-slate-500">{score.desc}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${getScoreColor(percent)}`}>
                            {score.value.toFixed(1)}
                          </span>
                          <span className="text-slate-500 text-sm ml-1">/ {score.max}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden relative">
                        {/* Tick marks at 25%, 50%, 75% */}
                        <div className="absolute inset-0 flex">
                          <div className="w-1/4 border-r border-slate-600/50" />
                          <div className="w-1/4 border-r border-slate-600/50" />
                          <div className="w-1/4 border-r border-slate-600/50" />
                          <div className="w-1/4" />
                        </div>
                        <div
                          className={`h-full ${getScoreBg(percent)} transition-all duration-500 relative z-10`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Score Legend */}
              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Färgskala:</p>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">Stark (80%+)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-slate-400">Bra (60-79%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-slate-400">OK (40-59%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-slate-400">Svag (20-39%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-400">Kritisk (&lt;20%)</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Analysis */}
            <Card variant="glass" className="relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">AI-analys</h2>
                  {isAIPowered && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                      GPT-4
                    </span>
                  )}
                </div>
                {!aiAnalysis && (
                  <Button
                    onClick={fetchAIAnalysis}
                    disabled={isLoadingAI}
                    variant="secondary"
                    size="sm"
                  >
                    {isLoadingAI ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-400/20 border-t-slate-400 rounded-full animate-spin mr-2" />
                        Analyserar...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generera analys
                      </>
                    )}
                  </Button>
                )}
              </div>

              {aiAnalysis ? (
                <div className="space-y-4">
                  {/* Diagnosis */}
                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-slate-400">Nulägesanalys</h3>
                      {getPriorityBadge(aiAnalysis.priority)}
                    </div>
                    <p className="text-slate-200">{aiAnalysis.diagnosis}</p>
                  </div>

                  {/* Opportunities */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Möjligheter
                    </h3>
                    <p className="text-slate-200">{aiAnalysis.opportunities}</p>
                  </div>

                  {/* Action */}
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <h3 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Rekommenderad åtgärd
                    </h3>
                    <p className="text-slate-200 font-medium">{aiAnalysis.action}</p>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span>
                      {isAIPowered ? "Analyserad med GPT-4o-mini" : "Regelbaserad analys"}
                    </span>
                    <span className="flex items-center gap-1">
                      Konfidens: {aiAnalysis.confidence}%
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${aiAnalysis.confidence}%` }}
                        />
                      </div>
                    </span>
                  </div>

                  {/* Regenerate button */}
                  <div className="pt-2 border-t border-slate-700">
                    <button
                      onClick={fetchAIAnalysis}
                      disabled={isLoadingAI}
                      className="text-sm text-slate-400 hover:text-purple-400 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generera ny analys
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-2">Klicka på &quot;Generera analys&quot; för att få en AI-driven analys</p>
                  <p className="text-xs">Analysen ger djupare insikter om möjligheter och konkreta åtgärder</p>
                </div>
              )}
            </Card>

            {/* Original Diagnosis (fallback) */}
            {supplier.diagnosis && !aiAnalysis && (
              <Card variant="glass">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Automatisk diagnos</h2>
                <p className="text-slate-300 whitespace-pre-wrap">{supplier.diagnosis}</p>
              </Card>
            )}

            {/* Original Action (fallback) */}
            {supplier.shortAction && !aiAnalysis && (
              <Card variant="gradient">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100 mb-2">Rekommenderad handling</h2>
                    <p className="text-slate-300">{supplier.shortAction}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Custom Factors */}
            <Card variant="glass">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-100">Egna faktorer</h2>
              </div>
              
              {supplier.customFactors.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {supplier.customFactors.map((factor) => (
                    <div
                      key={factor.id}
                      className="p-4 bg-slate-800/50 rounded-xl border border-slate-700"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {factor.user.image && (
                            <img
                              src={factor.user.image}
                              alt={factor.user.name || "User"}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <div>
                            <h4 className="font-medium text-slate-200">{factor.factorName}</h4>
                            <p className="text-xs text-slate-500">
                              av {factor.user.name} • {new Date(factor.createdAt).toLocaleDateString("sv-SE")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`text-lg font-bold ${parseFloat(factor.factorValue) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {parseFloat(factor.factorValue) >= 0 ? "+" : ""}{parseFloat(factor.factorValue).toFixed(1)}
                            </span>
                            <p className="text-xs text-slate-500">
                              Vikt: {parseFloat(factor.weight).toFixed(1)}
                            </p>
                          </div>
                          {factor.user.id === session.user.id && (
                            <button
                              onClick={() => handleDeleteFactor(factor.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {factor.comment && (
                        <p className="mt-3 text-sm text-slate-400">{factor.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 mb-6">Inga egna faktorer tillagda ännu.</p>
              )}
              
              <FactorForm supplierId={supplier.id} onSuccess={fetchSupplier} />
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <Card variant="glass">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Nyckeltal</h2>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Omsättning</dt>
                  <dd className="font-mono font-medium text-slate-200">
                    {formatCurrency(supplier.totalRevenue)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Täckningsgrad</dt>
                  <dd className="font-mono font-medium text-slate-200">
                    {formatPercent(supplier.avgMargin)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Antal rader</dt>
                  <dd className="font-mono font-medium text-slate-200">
                    {supplier.rowCount}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Totalt antal</dt>
                  <dd className="font-mono font-medium text-slate-200">
                    {supplier.totalQuantity}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Andel av total</dt>
                  <dd className="font-mono font-medium text-slate-200">
                    {formatPercent(parseFloat(supplier.revenueShare) * 100)}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Profile */}
            {supplier.profile && (
              <Card variant="glass">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Leverantörsprofil</h2>
                <p className="text-slate-300">{supplier.profile}</p>
              </Card>
            )}

            {/* Original vs Adjusted Score */}
            <Card variant="glass">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Score-jämförelse</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Original score</p>
                  <p className="text-2xl font-bold">
                    <span className={getTotalScoreColor(parseFloat(supplier.totalScore))}>
                      {parseFloat(supplier.totalScore).toFixed(1)}
                    </span>
                    <span className="text-sm text-slate-500 font-normal ml-1">/ 10</span>
                  </p>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-sm text-slate-400 mb-1">Justerad score</p>
                  <p className="text-2xl font-bold">
                    <span className={getTotalScoreColor(supplier.adjustedTotalScore)}>
                      {supplier.adjustedTotalScore.toFixed(1)}
                    </span>
                    <span className="text-sm text-slate-500 font-normal ml-1">/ 10</span>
                  </p>
                </div>
                {supplier.customFactors.length > 0 && (
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-sm text-slate-400 mb-1">Effekt av egna faktorer</p>
                    <p className={`text-lg font-bold ${
                      supplier.adjustedTotalScore - parseFloat(supplier.totalScore) >= 0 
                        ? "text-emerald-400" 
                        : "text-red-400"
                    }`}>
                      {supplier.adjustedTotalScore - parseFloat(supplier.totalScore) >= 0 ? "+" : ""}
                      {(supplier.adjustedTotalScore - parseFloat(supplier.totalScore)).toFixed(1)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

