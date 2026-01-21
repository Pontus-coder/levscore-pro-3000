"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Header } from "@/components/Header"

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasOrganizations, setHasOrganizations] = useState<boolean | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Check if user already has organizations
  useEffect(() => {
    async function checkOrganizations() {
      if (status !== "authenticated") return
      
      try {
        const response = await fetch("/api/organizations")
        if (response.ok) {
          const data = await response.json()
          if (data.organizations && data.organizations.length > 0) {
            // User already has organizations, redirect to dashboard
            setHasOrganizations(true)
            router.push("/dashboard")
          } else {
            setHasOrganizations(false)
          }
        }
      } catch (error) {
        console.error("Error checking organizations:", error)
        setHasOrganizations(false)
      }
    }

    checkOrganizations()
  }, [status, router])

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim() || isCreating) return

    setIsCreating(true)
    setError(null)

    try {
      // Double-check user doesn't already have an organization
      const checkResponse = await fetch("/api/organizations")
      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        if (checkData.organizations && checkData.organizations.length > 0) {
          // Already has org, redirect without creating
          router.push("/dashboard")
          return
        }
      }

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte skapa organisation")
        setIsCreating(false)
        return
      }

      // Success - redirect to dashboard (don't reset isCreating to prevent double-click)
      router.push("/dashboard")
    } catch (err) {
      setError("Något gick fel")
      setIsCreating(false)
    }
    // Note: Don't set isCreating to false on success to prevent double-submissions during redirect
  }

  if (status === "loading" || hasOrganizations === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 py-16">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
            step >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
            step >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
          }`}>
            2
          </div>
        </div>

        {step === 1 && (
          <Card variant="glass" className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-slate-100 mb-3">
              Välkommen, {session.user?.name?.split(" ")[0] || "där"}!
            </h1>
            
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              LevScore PRO hjälper dig att analysera och optimera dina leverantörsrelationer med data-drivna insikter och AI.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-200">Leverantörsscoring</p>
                <p className="text-xs text-slate-500">ABC-analys & KPIs</p>
              </div>
              
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-200">AI-analys</p>
                <p className="text-xs text-slate-500">Smarta rekommendationer</p>
              </div>
              
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-200">Team</p>
                <p className="text-xs text-slate-500">Samarbeta med kollegor</p>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="px-8">
              Kom igång
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card variant="glass">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Skapa din organisation</h2>
              <p className="text-slate-400">
                Ge din organisation ett namn - du kan ändra det senare.
              </p>
            </div>

            <form onSubmit={handleCreateOrganization} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organisationsnamn
                </label>
                <Input
                  type="text"
                  placeholder="T.ex. Mitt Företag AB"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="text-lg"
                  autoFocus
                />
                <p className="mt-2 text-sm text-slate-500">
                  Detta är namnet som visas i dashboarden och för dina teammedlemmar.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Tillbaka
                </Button>
                <Button
                  type="submit"
                  disabled={!orgName.trim() || isCreating}
                  isLoading={isCreating}
                  className="flex-1"
                >
                  Skapa organisation
                </Button>
              </div>
            </form>
          </Card>
        )}
      </main>
    </div>
  )
}

