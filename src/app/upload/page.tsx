"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

interface ColumnHeader {
  index: number
  name: string
  preview: string[]
}

interface PreviewData {
  filename: string
  headers: ColumnHeader[]
  rowCount: number
  sheetName: string
}

// Raw article data mapping
interface RawColumnMapping {
  articleNumber: string
  description: string
  quantity: string
  supplierNumber: string
  supplierName: string
  margin: string
  revenue: string
  grossProfit: string  // TB (Bruttovinst)
}

// Aggregated supplier data mapping
interface AggregatedColumnMapping {
  supplierNumber: string
  name: string
  rowCount: string
  totalQuantity: string
  totalRevenue: string
  avgMargin: string
  salesScore: string
  assortmentScore: string
  efficiencyScore: string
  marginScore: string
  totalScore: string
  diagnosis: string
  shortAction: string
  revenueShare: string
  accumulatedShare: string
  tier: string
  profile: string
}

type ImportMode = "raw" | "aggregated"

const RAW_FIELD_LABELS: Record<keyof RawColumnMapping, { label: string; required: boolean; description: string }> = {
  articleNumber: { label: "Artikelnummer", required: false, description: "Unikt ID för artikeln" },
  description: { label: "Benämning", required: false, description: "Artikelns namn/beskrivning" },
  quantity: { label: "Antal", required: false, description: "Antal sålda" },
  supplierNumber: { label: "Lev.nummer", required: true, description: "Leverantörsnummer" },
  supplierName: { label: "Lev.namn", required: true, description: "Leverantörens namn" },
  margin: { label: "TG", required: false, description: "Täckningsgrad i % (valfritt om TB finns)" },
  revenue: { label: "Belopp", required: true, description: "Försäljningsbelopp i SEK" },
  grossProfit: { label: "TB", required: false, description: "Bruttovinst (TB) - används för korrekt TG-beräkning" },
}

const AGGREGATED_FIELD_LABELS: Record<keyof AggregatedColumnMapping, { label: string; required: boolean; description: string }> = {
  supplierNumber: { label: "Leverantörsnummer", required: true, description: "Unikt ID för leverantören" },
  name: { label: "Leverantör", required: true, description: "Namn på leverantören" },
  rowCount: { label: "Antal rader", required: false, description: "Antal orderrader" },
  totalQuantity: { label: "Totalt antal", required: false, description: "Total kvantitet" },
  totalRevenue: { label: "Total omsättning", required: false, description: "Omsättning i SEK" },
  avgMargin: { label: "Snitt-TG (%)", required: false, description: "Genomsnittlig täckningsgrad" },
  salesScore: { label: "Sales score", required: false, description: "Försäljningspoäng" },
  assortmentScore: { label: "Sortimentsbredd score", required: false, description: "Sortimentspoäng" },
  efficiencyScore: { label: "Efficiency score", required: false, description: "Effektivitetspoäng" },
  marginScore: { label: "Margin score", required: false, description: "Marginalpoäng" },
  totalScore: { label: "Total score", required: false, description: "Total poäng" },
  diagnosis: { label: "Diagnos", required: false, description: "Analys/diagnos" },
  shortAction: { label: "Kort handling", required: false, description: "Rekommenderad åtgärd" },
  revenueShare: { label: "Andel av total omsättning", required: false, description: "Procentandel" },
  accumulatedShare: { label: "Ackumulerad andel", required: false, description: "Ackumulerad procentandel" },
  tier: { label: "Leverantörstier", required: false, description: "A, B, C-tier" },
  profile: { label: "Leverantörsprofil", required: false, description: "Beskrivning av profil" },
}

const emptyRawMapping: RawColumnMapping = {
  articleNumber: "",
  description: "",
  quantity: "",
  supplierNumber: "",
  supplierName: "",
  margin: "",
  revenue: "",
  grossProfit: "",
}

const emptyAggregatedMapping: AggregatedColumnMapping = {
  supplierNumber: "",
  name: "",
  rowCount: "",
  totalQuantity: "",
  totalRevenue: "",
  avgMargin: "",
  salesScore: "",
  assortmentScore: "",
  efficiencyScore: "",
  marginScore: "",
  totalScore: "",
  diagnosis: "",
  shortAction: "",
  revenueShare: "",
  accumulatedShare: "",
  tier: "",
  profile: "",
}

export default function UploadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [step, setStep] = useState<"mode" | "upload" | "mapping" | "importing">("mode")
  const [importMode, setImportMode] = useState<ImportMode | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [rawMapping, setRawMapping] = useState<RawColumnMapping>(emptyRawMapping)
  const [aggregatedMapping, setAggregatedMapping] = useState<AggregatedColumnMapping>(emptyAggregatedMapping)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [importStats, setImportStats] = useState<{
    articlesProcessed?: number
    suppliersCreated: number
    suppliersUpdated: number
    totalSuppliers: number
  } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Auto-map columns based on common names
  const autoMapRawColumns = (headers: ColumnHeader[]) => {
    const newMapping = { ...emptyRawMapping }
    const headerNames = headers.map(h => h.name.toLowerCase())
    
    const autoMappings: Record<keyof RawColumnMapping, string[]> = {
      articleNumber: ["artikelnummer", "artikelnr", "article", "artnr", "art.nr"],
      description: ["benämning", "beskrivning", "description", "namn", "artikelnamn", "name"],
      quantity: ["antal", "quantity", "qty", "st", "styck"],
      supplierNumber: ["lev.nummer", "levnummer", "lev.nr", "leverantörsnummer", "leverantörnummer", "supplier number"],
      supplierName: ["lev.namn", "levnamn", "leverantör", "supplier", "leverantörsnamn"],
      margin: ["tg", "tg%", "marginal", "margin", "täckningsgrad", "täckning"],
      revenue: ["belopp", "omsättning", "revenue", "summa", "försäljning", "amount"],
      grossProfit: ["tb", "bruttovinst", "gross profit", "grossprofit", "vinst", "profit"],
    }
    
    for (const [field, alternatives] of Object.entries(autoMappings)) {
      for (const alt of alternatives) {
        const matchIndex = headerNames.findIndex(h => h.includes(alt) || alt.includes(h))
        if (matchIndex !== -1) {
          newMapping[field as keyof RawColumnMapping] = headers[matchIndex].name
          break
        }
      }
    }
    
    setRawMapping(newMapping)
  }

  const autoMapAggregatedColumns = (headers: ColumnHeader[]) => {
    const newMapping = { ...emptyAggregatedMapping }
    const headerNames = headers.map(h => h.name.toLowerCase())
    
    const autoMappings: Record<keyof AggregatedColumnMapping, string[]> = {
      supplierNumber: ["leverantörsnummer", "leverantörnummer", "suppliernumber", "levnr", "supplier number"],
      name: ["leverantör", "supplier", "name", "namn", "leverantörsnamn"],
      rowCount: ["antal rader", "antal_rader", "rowcount", "rows"],
      totalQuantity: ["totalt antal", "total_antal", "totalquantity", "quantity"],
      totalRevenue: ["total omsättning", "omsättning", "revenue", "totalrevenue"],
      avgMargin: ["snitt-tg", "snitt-tg (%)", "tg", "margin", "täckningsgrad"],
      salesScore: ["sales_score", "sales score", "salesscore"],
      assortmentScore: ["sortimentsbredd score", "sortimentsbredd_score", "assortmentscore"],
      efficiencyScore: ["efficiency_score", "efficiency score", "efficiencyscore"],
      marginScore: ["margin_score", "margin score", "marginscore"],
      totalScore: ["total_score", "total score", "totalscore"],
      diagnosis: ["diagnos", "diagnos (varför)", "diagnosis"],
      shortAction: ["kort handling", "kort_handling", "handling", "action"],
      revenueShare: ["andel av total omsättning", "andel", "revenueshare"],
      accumulatedShare: ["ackumulerad andel", "ackumulerad", "accumulatedshare"],
      tier: ["leverantörstier", "tier", "leverantörs-tier"],
      profile: ["leverantörsprofil", "profil", "profile"],
    }
    
    for (const [field, alternatives] of Object.entries(autoMappings)) {
      for (const alt of alternatives) {
        const matchIndex = headerNames.findIndex(h => h.includes(alt) || alt.includes(h))
        if (matchIndex !== -1) {
          newMapping[field as keyof AggregatedColumnMapping] = headers[matchIndex].name
          break
        }
      }
    }
    
    setAggregatedMapping(newMapping)
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload/preview", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunde inte läsa filen")
      }

      setPreview(data)
      
      if (importMode === "raw") {
        autoMapRawColumns(data.headers)
      } else {
        autoMapAggregatedColumns(data.headers)
      }
      
      setStep("mapping")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError("Ingen fil vald")
      return
    }

    if (importMode === "raw") {
      if (!rawMapping.supplierNumber || !rawMapping.supplierName || !rawMapping.revenue) {
        setError("Leverantörsnummer, Leverantörsnamn och Belopp måste mappas")
        return
      }
    } else {
      if (!aggregatedMapping.supplierNumber || !aggregatedMapping.name) {
        setError("Leverantörsnummer och Leverantör måste mappas")
        return
      }
    }

    setIsLoading(true)
    setError(null)
    setStep("importing")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mapping", JSON.stringify(importMode === "raw" ? rawMapping : aggregatedMapping))

      const endpoint = importMode === "raw" ? "/api/upload/raw" : "/api/upload/import"
      
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Import misslyckades")
      }

      setSuccess(data.message)
      setImportStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
      setStep("mapping")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const resetUpload = () => {
    setStep("mode")
    setImportMode(null)
    setFile(null)
    setPreview(null)
    setRawMapping(emptyRawMapping)
    setAggregatedMapping(emptyAggregatedMapping)
    setError(null)
    setSuccess(null)
    setImportStats(null)
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const currentStep = step === "mode" ? 0 : step === "upload" ? 1 : step === "mapping" ? 2 : 3
  const steps = ["Välj typ", "Välj fil", "Mappa kolumner", "Importera"]

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Ladda upp data</h1>
          <p className="text-slate-400">Importera din Excel-fil med leverantörsdata</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-2 whitespace-nowrap ${i <= currentStep ? "text-emerald-400" : "text-slate-500"}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${i <= currentStep ? "bg-emerald-500 text-white" : "bg-slate-700"}`}>
                  {i + 1}
                </span>
                <span className="hidden sm:inline text-sm">{label}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 h-px bg-slate-700 mx-2" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && importStats && (
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <p className="text-emerald-400 font-medium">{success}</p>
            </div>
            
            {/* Debug-info för att se vad som händer */}
            {importStats.debug && (
              <Card variant="glass" className="bg-slate-800/50 border-slate-700">
                <h3 className="font-semibold text-slate-300 mb-3">🔍 Debug-info (för testning):</h3>
                <div className="text-xs text-slate-400 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Total omsättning från artiklar:</span>
                      <span className="text-slate-200 ml-2 block">{importStats.debug.totalRevenueFromArticles.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Efter aggregering:</span>
                      <span className="text-slate-200 ml-2 block">{importStats.debug.totalRevenueFromAggregated.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total omsättning i filen:</span>
                      <span className="text-slate-200 ml-2 block">{importStats.debug.fileTotalRevenue.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Före import:</span>
                      <span className="text-slate-200 ml-2 block">{importStats.debug.beforeTotalRevenue.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-700 pt-2">
                      <span className="text-slate-500">Efter import (från databas):</span>
                      <span className="text-slate-200 ml-2 font-semibold">{importStats.finalTotalRevenue?.toLocaleString('sv-SE')} kr</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            
            <Card variant="glass">
              <h3 className="font-semibold text-slate-100 mb-4">Import-statistik</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {importStats.articlesProcessed !== undefined && (
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-400">{importStats.articlesProcessed}</p>
                    <p className="text-sm text-slate-400">Artiklar</p>
                  </div>
                )}
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-400">{importStats.totalSuppliers}</p>
                  <p className="text-sm text-slate-400">Leverantörer</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">{importStats.suppliersCreated}</p>
                  <p className="text-sm text-slate-400">Nya</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-400">{importStats.suppliersUpdated}</p>
                  <p className="text-sm text-slate-400">Uppdaterade</p>
                </div>
              </div>
              <div className="mt-6 flex gap-4">
                <Button onClick={() => router.push("/dashboard")}>Gå till Dashboard</Button>
                <Button variant="secondary" onClick={resetUpload}>Ladda upp mer</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 0: Choose Mode */}
        {step === "mode" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              variant="glass" 
              className="cursor-pointer hover:border-emerald-500/50 transition-all hover:scale-[1.02]"
              onClick={() => { setImportMode("raw"); setStep("upload"); }}
            >
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Rådata (Artikelnivå)</h3>
                <p className="text-slate-400 mb-4">
                  Ladda upp artikeldata direkt. Systemet aggregerar och beräknar alla scores automatiskt.
                </p>
                <div className="text-left bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Kolumner som behövs:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• <span className="text-emerald-400">Lev.nummer*</span></li>
                    <li>• <span className="text-emerald-400">Lev.namn*</span></li>
                    <li>• <span className="text-emerald-400">Belopp*</span></li>
                    <li>• Artikelnummer</li>
                    <li>• Benämning</li>
                    <li>• Antal</li>
                    <li>• TG</li>
                  </ul>
                </div>
                <p className="text-emerald-400 font-medium mt-4">✨ Rekommenderad</p>
              </div>
            </Card>

            <Card 
              variant="glass" 
              className="cursor-pointer hover:border-slate-500/50 transition-all hover:scale-[1.02]"
              onClick={() => { setImportMode("aggregated"); setStep("upload"); }}
            >
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Förberäknad data</h3>
                <p className="text-slate-400 mb-4">
                  Ladda upp data som redan är aggregerad per leverantör med uträknade scores.
                </p>
                <div className="text-left bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Kolumner som behövs:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• <span className="text-emerald-400">Leverantörsnummer*</span></li>
                    <li>• <span className="text-emerald-400">Leverantör*</span></li>
                    <li>• Scores (beräknas om saknas)</li>
                    <li>• Diagnos, Åtgärd, Tier...</li>
                  </ul>
                </div>
                <p className="text-slate-500 font-medium mt-4">För avancerade användare</p>
              </div>
            </Card>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <Card variant="glass">
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => setStep("mode")} 
                  className="text-slate-400 hover:text-slate-100 transition-colors"
                >
                  ← Tillbaka
                </button>
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {importMode === "raw" ? "Rådata (Artikelnivå)" : "Förberäknad data"}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {importMode === "raw" 
                      ? "Systemet aggregerar och beräknar alla scores automatiskt"
                      : "Ladda upp förberäknad leverantörsdata"}
                  </p>
                </div>
              </div>
              
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <p className="text-slate-300">Läser fil...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-1">Släpp din Excel-fil här</h3>
                    <p className="text-sm text-slate-400 mb-4">eller klicka för att välja fil</p>
                    <p className="text-xs text-slate-500">Stödjer .xlsx, .xls och .csv</p>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && preview && (
          <div className="space-y-6">
            <Card variant="glass">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-100">{preview.filename}</h3>
                  <p className="text-sm text-slate-400">
                    {preview.rowCount} rader hittades 
                    {importMode === "raw" && " (kommer aggregeras per leverantör)"}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}>
                  Byt fil
                </Button>
              </div>
            </Card>

            <Card variant="glass">
              <h3 className="font-semibold text-slate-100 mb-4">Mappa kolumner</h3>
              <p className="text-sm text-slate-400 mb-6">
                Välj vilken kolumn i din fil som motsvarar varje fält. Obligatoriska fält är markerade med *
              </p>
              
              {importMode === "raw" ? (
                <div className="grid gap-4">
                  {(Object.entries(RAW_FIELD_LABELS) as [keyof RawColumnMapping, typeof RAW_FIELD_LABELS[keyof RawColumnMapping]][]).map(([field, config]) => (
                    <div key={field} className="grid sm:grid-cols-3 gap-2 items-center">
                      <div>
                        <label className="text-sm font-medium text-slate-300">
                          {config.label}
                          {config.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <p className="text-xs text-slate-500">{config.description}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          value={rawMapping[field]}
                          onChange={(e) => setRawMapping({ ...rawMapping, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                        >
                          <option value="">-- Välj kolumn --</option>
                          {preview.headers.map((header) => (
                            <option key={header.index} value={header.name}>
                              {header.name} {header.preview[0] && `(ex: ${header.preview[0]})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4">
                  {(Object.entries(AGGREGATED_FIELD_LABELS) as [keyof AggregatedColumnMapping, typeof AGGREGATED_FIELD_LABELS[keyof AggregatedColumnMapping]][]).map(([field, config]) => (
                    <div key={field} className="grid sm:grid-cols-3 gap-2 items-center">
                      <div>
                        <label className="text-sm font-medium text-slate-300">
                          {config.label}
                          {config.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <p className="text-xs text-slate-500">{config.description}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          value={aggregatedMapping[field]}
                          onChange={(e) => setAggregatedMapping({ ...aggregatedMapping, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                        >
                          <option value="">-- Välj kolumn --</option>
                          {preview.headers.map((header) => (
                            <option key={header.index} value={header.name}>
                              {header.name} {header.preview[0] && `(ex: ${header.preview[0]})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {importMode === "raw" && (
              <Card variant="glass" className="bg-emerald-500/5 border-emerald-500/20">
                <h4 className="font-medium text-emerald-400 mb-2">🧮 Automatisk beräkning</h4>
                <p className="text-sm text-slate-400">
                  När du importerar rådata beräknar systemet automatiskt:
                </p>
                <ul className="text-sm text-slate-400 mt-2 space-y-1 ml-4">
                  <li>• Sales Score (baserat på omsättning)</li>
                  <li>• Sortimentsbredd Score (baserat på antal artikelrader)</li>
                  <li>• Efficiency Score (omsättning per artikel)</li>
                  <li>• Margin Score (baserat på TG)</li>
                  <li>• Total Score (summa av alla scores)</li>
                  <li>• Diagnos och rekommenderad åtgärd</li>
                  <li>• Tier-klassificering (A, B, C)</li>
                </ul>
              </Card>
            )}

            <div className="flex justify-end gap-4">
              <Button variant="secondary" onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}>
                Avbryt
              </Button>
              <Button 
                onClick={handleImport}
                disabled={
                  importMode === "raw" 
                    ? (!rawMapping.supplierNumber || !rawMapping.supplierName || !rawMapping.revenue)
                    : (!aggregatedMapping.supplierNumber || !aggregatedMapping.name)
                }
              >
                {importMode === "raw" 
                  ? `Beräkna & Importera ${preview.rowCount} rader`
                  : `Importera ${preview.rowCount} leverantörer`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && !success && (
          <Card variant="glass">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                {importMode === "raw" ? "Beräknar och importerar..." : "Importerar..."}
              </h3>
              <p className="text-slate-400">
                {importMode === "raw" 
                  ? "Aggregerar data och beräknar scores för alla leverantörer"
                  : "Vänta medan leverantörerna läggs till i databasen"}
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
