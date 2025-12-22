"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Header } from "@/components/Header"
import { ExcelUploader } from "@/components/ExcelUploader"
import { Card } from "@/components/ui/Card"

export default function UploadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

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
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Ladda upp data</h1>
          <p className="text-slate-400">Importera din Excel-fil med leverantörsdata</p>
        </div>

        <ExcelUploader onUploadSuccess={() => router.push("/dashboard")} />

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Card variant="glass">
            <h3 className="font-semibold text-slate-100 mb-3">Förväntade kolumner</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Leverantörsnummer
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Leverantör
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Antal rader
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Total omsättning
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Snitt-TG (%)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Sales_score, Margin_score, etc.
              </li>
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
              = Obligatorisk
            </p>
          </Card>

          <Card variant="glass">
            <h3 className="font-semibold text-slate-100 mb-3">Tips</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Filen ska ha kolumnrubriker på första raden</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Befintliga leverantörer uppdateras automatiskt</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Stöder .xlsx, .xls och .csv filer</span>
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Manuellt tillagda faktorer bevaras vid ny import</span>
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  )
}

