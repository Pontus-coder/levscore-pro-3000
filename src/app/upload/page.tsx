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

interface ColumnMapping {
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

const FIELD_LABELS: Record<keyof ColumnMapping, { label: string; required: boolean; description: string }> = {
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
  tier: { label: "Leverantörstier", required: false, description: "A, B, C, D eller F" },
  profile: { label: "Leverantörsprofil", required: false, description: "Beskrivning av profil" },
}

export default function UploadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [step, setStep] = useState<"upload" | "mapping" | "importing">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({
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
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Auto-map columns based on common names
  const autoMapColumns = (headers: ColumnHeader[]) => {
    const newMapping = { ...mapping }
    const headerNames = headers.map(h => h.name.toLowerCase())
    
    const autoMappings: Record<keyof ColumnMapping, string[]> = {
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
          newMapping[field as keyof ColumnMapping] = headers[matchIndex].name
          break
        }
      }
    }
    
    setMapping(newMapping)
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
      autoMapColumns(data.headers)
      setStep("mapping")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !mapping.supplierNumber || !mapping.name) {
      setError("Leverantörsnummer och Leverantör måste mappas")
      return
    }

    setIsLoading(true)
    setError(null)
    setStep("importing")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mapping", JSON.stringify(mapping))

      const response = await fetch("/api/upload/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Import misslyckades")
      }

      setSuccess(data.message)
      setTimeout(() => router.push("/dashboard"), 2000)
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

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Ladda upp data</h1>
          <p className="text-slate-400">Importera din Excel-fil med leverantörsdata</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step === "upload" ? "text-emerald-400" : "text-slate-500"}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "upload" ? "bg-emerald-500 text-white" : "bg-slate-700"}`}>1</span>
            <span className="hidden sm:inline">Välj fil</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className={`flex items-center gap-2 ${step === "mapping" ? "text-emerald-400" : "text-slate-500"}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "mapping" ? "bg-emerald-500 text-white" : "bg-slate-700"}`}>2</span>
            <span className="hidden sm:inline">Mappa kolumner</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className={`flex items-center gap-2 ${step === "importing" ? "text-emerald-400" : "text-slate-500"}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "importing" ? "bg-emerald-500 text-white" : "bg-slate-700"}`}>3</span>
            <span className="hidden sm:inline">Importera</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-emerald-400">{success}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card variant="glass">
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
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && preview && (
          <div className="space-y-6">
            <Card variant="glass">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-100">{preview.filename}</h3>
                  <p className="text-sm text-slate-400">{preview.rowCount} rader hittades</p>
                </div>
                <Button variant="ghost" onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}>
                  Byt fil
                </Button>
              </div>
            </Card>

            <Card variant="glass">
              <h3 className="font-semibold text-slate-100 mb-4">Mappa kolumner</h3>
              <p className="text-sm text-slate-400 mb-6">Välj vilken kolumn i din fil som motsvarar varje fält. Obligatoriska fält är markerade med *</p>
              
              <div className="grid gap-4">
                {(Object.entries(FIELD_LABELS) as [keyof ColumnMapping, typeof FIELD_LABELS[keyof ColumnMapping]][]).map(([field, config]) => (
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
                        value={mapping[field]}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
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
            </Card>

            <div className="flex justify-end gap-4">
              <Button variant="secondary" onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}>
                Avbryt
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!mapping.supplierNumber || !mapping.name}
              >
                Importera {preview.rowCount} leverantörer
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <Card variant="glass">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Importerar...</h3>
              <p className="text-slate-400">Vänta medan leverantörerna läggs till i databasen</p>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
