"use client"

import { useSession, signIn } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

interface InvitationInfo {
  email: string
  role: string
  organizationName: string
  memberCount: number
  invitedBy: string
  expiresAt: string
}

export default function InvitePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const response = await fetch(`/api/team/accept?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || "Kunde inte hämta inbjudan")
          setIsLoading(false)
          return
        }

        if (!data || !data.email) {
          setError("Inbjudan hittades inte eller är ogiltig")
          setIsLoading(false)
          return
        }

        setInvitation(data)
      } catch (err) {
        console.error("Error fetching invitation:", err)
        setError("Något gick fel när inbjudan skulle hämtas")
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchInvitation()
    } else {
      setError("Ogiltig inbjudningslänk")
      setIsLoading(false)
    }
  }, [token])

  const handleAccept = async () => {
    if (!session) {
      // Store token and redirect to sign in
      localStorage.setItem("pendingInviteToken", token)
      signIn("google")
      return
    }

    setIsAccepting(true)
    setError(null)

    try {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte acceptera inbjudan")
        return
      }

      // Redirect to dashboard
      router.push("/dashboard")
    } catch {
      setError("Något gick fel")
    } finally {
      setIsAccepting(false)
    }
  }

  // Check for pending invite after sign in
  useEffect(() => {
    if (status === "authenticated") {
      const pendingToken = localStorage.getItem("pendingInviteToken")
      if (pendingToken === token) {
        localStorage.removeItem("pendingInviteToken")
        handleAccept()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Card variant="glass" className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Ogiltig inbjudan</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => router.push("/")}>Gå till startsidan</Button>
        </Card>
      </div>
    )
  }

  if (!isLoading && !invitation && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Card variant="glass" className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Inbjudan hittades inte</h1>
          <p className="text-slate-400 mb-6">Inbjudan kan ha gått ut eller raderats.</p>
          <Button onClick={() => router.push("/")}>Gå till startsidan</Button>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return null
  }

  const roleLabels: Record<string, string> = {
    OWNER: "Ägare",
    ADMIN: "Administratör",
    MEMBER: "Medlem",
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Card variant="glass" className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Team-inbjudan</h1>
          <p className="text-slate-400">
            Du har blivit inbjuden att gå med i ett team
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">Organisation</p>
            <p className="text-lg font-semibold text-slate-100">{invitation.organizationName}</p>
            <p className="text-sm text-slate-500">{invitation.memberCount} medlemmar</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-sm text-slate-400 mb-1">Roll</p>
              <p className="font-medium text-emerald-400">{roleLabels[invitation.role]}</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-sm text-slate-400 mb-1">Inbjuden av</p>
              <p className="font-medium text-slate-100">{invitation.invitedBy}</p>
            </div>
          </div>

          {session && session.user?.email?.toLowerCase() !== invitation.email.toLowerCase() && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-400">
                ⚠️ Denna inbjudan är för <strong>{invitation.email}</strong>. 
                Du är inloggad som <strong>{session.user?.email}</strong>.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {!session ? (
            <Button 
              className="w-full" 
              onClick={handleAccept}
              isLoading={isAccepting}
            >
              Logga in för att acceptera
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={handleAccept}
              isLoading={isAccepting}
              disabled={session.user?.email?.toLowerCase() !== invitation.email.toLowerCase()}
            >
              Acceptera inbjudan
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => router.push("/")}
          >
            Avböj
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          Inbjudan går ut {new Date(invitation.expiresAt).toLocaleDateString("sv-SE")}
        </p>
      </Card>
    </div>
  )
}

