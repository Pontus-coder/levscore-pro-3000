"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "./ui/Badge"
import { Input } from "./ui/Input"

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
  tier: string | null
  profile: string | null
  diagnosis: string | null
  shortAction: string | null
}

interface SupplierTableProps {
  suppliers: Supplier[]
  onSort?: (field: string) => void
  sortField?: string
  sortOrder?: "asc" | "desc"
}

export function SupplierTable({ suppliers, onSort, sortField, sortOrder }: SupplierTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tierFilter, setTierFilter] = useState<string | null>(null)

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.supplierNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = !tierFilter || supplier.tier === tierFilter
    return matchesSearch && matchesTier
  })

  const tiers = [...new Set(suppliers.map(s => s.tier).filter(Boolean))]

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

  const formatScore = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return num.toFixed(1)
  }

  // Färger baserat på total score (max 10)
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400"
    if (score >= 6) return "text-blue-400"
    if (score >= 4) return "text-amber-400"
    if (score >= 2) return "text-orange-400"
    return "text-red-400"
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortOrder === "asc" ? (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Sök leverantör..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">Tier:</span>
          <button
            onClick={() => setTierFilter(null)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              !tierFilter ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Alla
          </button>
          {tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                tierFilter === tier ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Leverantör
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => onSort?.("totalRevenue")}
              >
                <div className="flex items-center justify-end gap-1">
                  Omsättning
                  <SortIcon field="totalRevenue" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => onSort?.("avgMargin")}
              >
                <div className="flex items-center justify-end gap-1">
                  TG
                  <SortIcon field="avgMargin" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => onSort?.("totalScore")}
              >
                <div className="flex items-center justify-end gap-1">
                  Total Score
                  <SortIcon field="totalScore" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Handling
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredSuppliers.map((supplier) => (
              <tr 
                key={supplier.id}
                className="bg-slate-900/40 hover:bg-slate-800/60 transition-colors"
              >
                <td className="px-4 py-4">
                  <Link href={`/suppliers/${supplier.id}`} className="block group">
                    <div className="font-medium text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {supplier.name}
                    </div>
                    <div className="text-sm text-slate-500">{supplier.supplierNumber}</div>
                  </Link>
                </td>
                <td className="px-4 py-4 text-right font-mono text-slate-200">
                  {formatCurrency(supplier.totalRevenue)}
                </td>
                <td className="px-4 py-4 text-right font-mono text-slate-200">
                  {formatPercent(supplier.avgMargin)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-end gap-1">
                    <div>
                      <span className={`font-bold text-lg ${getScoreColor(parseFloat(supplier.totalScore))}`}>
                        {formatScore(supplier.totalScore)}
                      </span>
                      <span className="text-xs text-slate-500 ml-0.5">/10</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          parseFloat(supplier.totalScore) >= 8 ? "bg-emerald-500" :
                          parseFloat(supplier.totalScore) >= 6 ? "bg-blue-500" :
                          parseFloat(supplier.totalScore) >= 4 ? "bg-amber-500" :
                          parseFloat(supplier.totalScore) >= 2 ? "bg-orange-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min((parseFloat(supplier.totalScore) / 10) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  {supplier.tier && (
                    <Badge variant="tier" tier={supplier.tier}>
                      {supplier.tier}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-slate-400 max-w-[200px] truncate">
                  {supplier.shortAction || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Inga leverantörer hittades</p>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500 text-right">
        Visar {filteredSuppliers.length} av {suppliers.length} leverantörer
      </p>
    </div>
  )
}

