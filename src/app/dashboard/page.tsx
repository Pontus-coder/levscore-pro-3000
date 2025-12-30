"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/Header"
import { KPICard } from "@/components/KPICard"
import { SupplierTable } from "@/components/SupplierTable"
import { TierChart } from "@/components/TierChart"
import { Button } from "@/components/ui/Button"
import Link from "next/link"

interface Supplier {
  id: string
  supplierNumber: string
  name: string
  totalRevenue: string
  avgMargin: string
  salesScore: string
  assortmentScore: string
  efficiencyScore: string
  marginScore: string
  totalScore: string
  adjustedTotalScore?: number // Adjusted score including bonus/tender support and custom factors
  tier: string | null
  profile: string | null
  diagnosis: string | null
  shortAction: string | null
}

interface Stats {
  totalSuppliers: number
  totalRevenue: number
  avgMargin: number
  avgTotalScore: number
  tierDistribution: Record<string, number>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState("adjustedTotalScore")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userRole, setUserRole] = useState<"OWNER" | "ADMIN" | "MEMBER" | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/suppliers?sortBy=${sortField}&sortOrder=${sortOrder}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte hämta data")
      }
      
      setSuppliers(data.suppliers)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoading(false)
    }
  }, [sortField, sortOrder])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const response = await fetch("/api/team")
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.currentUserRole || null)
        }
      } catch (error) {
        console.error("Error fetching user role:", error)
      }
    }

    if (session) {
      fetchData()
      fetchUserRole()
    }
  }, [session, fetchData])

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm("Är du säker på att du vill radera ALL importerad data? Detta går inte att ångra!")) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch("/api/suppliers/delete-all", {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunde inte radera data")
      }

      // Uppdatera data efter radering
      setSuppliers([])
      setStats(null)
      setShowDeleteConfirm(false)
      alert(`All data har raderats. ${data.deletedSuppliers} leverantörer och ${data.deletedUploads} uppladdningar borttagna.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Laddar dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Block blocked users
  if ((session.user as any)?.isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card variant="glass" className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Konto blockerat</h1>
          <p className="text-slate-400 mb-6">Ditt konto har blockerats. Kontakta administratören för mer information.</p>
          <Button onClick={() => router.push("/")}>Tillbaka</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
            <p className="text-slate-400">Översikt av dina leverantörer</p>
          </div>
          <div className="flex gap-3">
            {userRole === "OWNER" && suppliers.length > 0 && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="secondary"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Radera all data
              </Button>
            )}
            {userRole === "OWNER" && (
              <Link href="/upload">
                <Button>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Ladda upp ny data
                </Button>
              </Link>
            )}
            {userRole !== "OWNER" && (
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
                <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Endast ägare kan ladda upp och radera data
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-red-400 mb-2">Radera all data?</h2>
              <p className="text-slate-300 mb-4">
                Detta kommer att radera alla importerade leverantörer och uppladdningshistorik. 
                Detta går <strong>inte att ångra</strong>.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Du kommer att kunna ladda upp ny data efter raderingen.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isDeleting ? "Raderar..." : "Ja, radera allt"}
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  variant="secondary"
                  className="flex-1"
                >
                  Avbryt
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {suppliers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Ingen data ännu</h2>
            <p className="text-slate-400 mb-6">
              {userRole === "OWNER" 
                ? "Ladda upp din Excel-fil för att komma igång"
                : "Kontakta ägaren för att ladda upp data"}
            </p>
            {userRole === "OWNER" && (
              <Link href="/upload">
                <Button size="lg">
                  Ladda upp Excel-fil
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KPICard
                title="Totalt antal leverantörer"
                value={stats?.totalSuppliers || 0}
                variant="info"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <KPICard
                title="Total omsättning"
                value={formatCurrency(stats?.totalRevenue || 0)}
                variant="success"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <KPICard
                title="Genomsnittlig TG"
                value={`${(stats?.avgMargin || 0).toFixed(1)}%`}
                variant="warning"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                }
              />
              <KPICard
                title="Genomsnittlig Score"
                value={(stats?.avgTotalScore || 0).toFixed(1)}
                subtitle="av 10"
                variant="default"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                }
              />
            </div>

            {/* Main Content */}
            <div className="grid lg:grid-cols-4 gap-6">
              {/* Supplier Table */}
              <div className="lg:col-span-3">
                <SupplierTable
                  suppliers={suppliers}
                  onSort={handleSort}
                  sortField={sortField}
                  sortOrder={sortOrder}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <TierChart distribution={stats?.tierDistribution || {}} />
                
                {/* Top Performers */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Top 5 leverantörer</h3>
                  <div className="space-y-3">
                    {suppliers.slice(0, 5).map((supplier, index) => (
                      <Link
                        key={supplier.id}
                        href={`/suppliers/${supplier.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                            {supplier.name}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-400">
                          {parseFloat(supplier.totalScore).toFixed(1)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

