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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400"
    if (score >= 60) return "text-blue-400"
    if (score >= 40) return "text-amber-400"
    if (score >= 20) return "text-orange-400"
    return "text-red-400"
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500"
    if (score >= 60) return "bg-blue-500"
    if (score >= 40) return "bg-amber-500"
    if (score >= 20) return "bg-orange-500"
    return "bg-red-500"
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

  const scores = [
    { name: "Sales", value: parseFloat(supplier.salesScore), label: "Försäljning" },
    { name: "Assortment", value: parseFloat(supplier.assortmentScore), label: "Sortiment" },
    { name: "Efficiency", value: parseFloat(supplier.efficiencyScore), label: "Effektivitet" },
    { name: "Margin", value: parseFloat(supplier.marginScore), label: "Marginal" },
  ]

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
              <span className={getScoreColor(supplier.adjustedTotalScore)}>
                {supplier.adjustedTotalScore.toFixed(1)}
              </span>
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
              <h2 className="text-lg font-semibold text-slate-100 mb-6">Score-fördelning</h2>
              <div className="space-y-4">
                {scores.map((score) => (
                  <div key={score.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{score.label}</span>
                      <span className={`font-bold ${getScoreColor(score.value)}`}>
                        {score.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreBg(score.value)} transition-all duration-500`}
                        style={{ width: `${Math.min(score.value, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Diagnosis */}
            {supplier.diagnosis && (
              <Card variant="glass">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Diagnos</h2>
                <p className="text-slate-300 whitespace-pre-wrap">{supplier.diagnosis}</p>
              </Card>
            )}

            {/* Action */}
            {supplier.shortAction && (
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
                  <p className="text-2xl font-bold text-slate-300">
                    {parseFloat(supplier.totalScore).toFixed(1)}
                  </p>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-sm text-slate-400 mb-1">Justerad score</p>
                  <p className={`text-2xl font-bold ${getScoreColor(supplier.adjustedTotalScore)}`}>
                    {supplier.adjustedTotalScore.toFixed(1)}
                  </p>
                </div>
                {supplier.customFactors.length > 0 && (
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-sm text-slate-400 mb-1">Skillnad</p>
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

