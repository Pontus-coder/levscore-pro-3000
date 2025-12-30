"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface TeamMember {
  id: string
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: "OWNER" | "ADMIN" | "MEMBER"
  joinedAt: string
  isCurrentUser: boolean
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  expiresAt: string
  invitedBy: string
  createdAt: string
}

interface TeamData {
  organization: {
    id: string
    name: string
    slug: string
  }
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER"
  members: TeamMember[]
  pendingInvitations: PendingInvitation[]
}

const roleLabels: Record<string, string> = {
  OWNER: "Ägare",
  ADMIN: "Administratör",
  MEMBER: "Medlem",
}

const roleColors: Record<string, string> = {
  OWNER: "bg-amber-500/20 text-amber-400",
  ADMIN: "bg-purple-500/20 text-purple-400",
  MEMBER: "bg-slate-500/20 text-slate-400",
}

export default function TeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [team, setTeam] = useState<TeamData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER")
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  // Organizations management
  const [organizations, setOrganizations] = useState<Array<{
    id: string
    name: string
    slug: string
    role: "OWNER" | "ADMIN" | "MEMBER"
    memberCount: number
    supplierCount: number
  }>>([])
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editingOrgName, setEditingOrgName] = useState("")
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchTeam() {
      try {
        const response = await fetch("/api/team")
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || "Kunde inte hämta team")
          return
        }

        setTeam(data)
      } catch {
        setError("Något gick fel")
      } finally {
        setIsLoading(false)
      }
    }

    async function fetchOrganizations() {
      try {
        const response = await fetch("/api/organizations")
        if (response.ok) {
          const data = await response.json()
          setOrganizations(data.organizations || [])
        }
      } catch (error) {
        console.error("Error fetching organizations:", error)
      }
    }

    if (status === "authenticated") {
      fetchTeam()
      fetchOrganizations()
    }
  }, [status])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setError(null)
    setInviteSuccess(null)
    setInviteUrl(null)

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte skicka inbjudan")
        return
      }

      setInviteSuccess(data.message)
      setInviteUrl(data.inviteUrl)
      setInviteEmail("")
      
      // Refresh team data
      const teamResponse = await fetch("/api/team")
      const teamData = await teamResponse.json()
      if (teamResponse.ok) setTeam(teamData)
    } catch {
      setError("Något gick fel")
    } finally {
      setIsInviting(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invite?id=${invitationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Kunde inte ta bort inbjudan")
        return
      }

      // Refresh team data
      const teamResponse = await fetch("/api/team")
      const teamData = await teamResponse.json()
      if (teamResponse.ok) setTeam(teamData)
    } catch {
      setError("Något gick fel")
    }
  }

  const handleRemoveMember = async (memberId: string, isLeaving: boolean = false) => {
    if (!confirm(isLeaving ? "Är du säker på att du vill lämna teamet?" : "Är du säker på att du vill ta bort denna medlem?")) {
      return
    }

    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte ta bort medlem")
        return
      }

      if (data.left) {
        // User left, redirect to home
        router.push("/")
        return
      }

      // Refresh team data
      const teamResponse = await fetch("/api/team")
      const teamData = await teamResponse.json()
      if (teamResponse.ok) setTeam(teamData)
    } catch {
      setError("Något gick fel")
    }
  }

  const copyInviteUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return

    setIsCreatingOrg(true)
    setError(null)

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte skapa organisation")
        return
      }

      // Refresh organizations list
      const orgsResponse = await fetch("/api/organizations")
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json()
        setOrganizations(orgsData.organizations || [])
      }

      setNewOrgName("")
      setShowCreateOrg(false)
    } catch {
      setError("Något gick fel")
    } finally {
      setIsCreatingOrg(false)
    }
  }

  const handleUpdateOrgName = async (orgId: string) => {
    if (!editingOrgName.trim()) {
      setEditingOrgId(null)
      return
    }

    setIsUpdatingOrg(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingOrgName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunde inte uppdatera organisationsnamn")
        return
      }

      // Refresh organizations list and team data
      const orgsResponse = await fetch("/api/organizations")
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json()
        setOrganizations(orgsData.organizations || [])
      }

      const teamResponse = await fetch("/api/team")
      if (teamResponse.ok) {
        const teamData = await teamResponse.json()
        setTeam(teamData)
      }

      setEditingOrgId(null)
      setEditingOrgName("")
    } catch {
      setError("Något gick fel")
    } finally {
      setIsUpdatingOrg(false)
    }
  }

  const handleSwitchOrg = async (orgId: string) => {
    try {
      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (response.ok) {
        // Reload page to update all data
        window.location.reload()
      }
    } catch (error) {
      console.error("Error switching organization:", error)
      setError("Kunde inte växla organisation")
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !team) return null

  const canInvite = team.currentUserRole === "OWNER" || team.currentUserRole === "ADMIN"
  const canManageMembers = team.currentUserRole === "OWNER" || team.currentUserRole === "ADMIN"

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-slate-100">
              {editingOrgId === team.organization.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingOrgName}
                    onChange={(e) => setEditingOrgName(e.target.value)}
                    onBlur={() => handleUpdateOrgName(team.organization.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUpdateOrgName(team.organization.id)
                      } else if (e.key === "Escape") {
                        setEditingOrgId(null)
                        setEditingOrgName("")
                      }
                    }}
                    autoFocus
                    className="px-3 py-1 bg-slate-800 border border-emerald-500/50 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{team.organization.name}</span>
                  {(team.currentUserRole === "OWNER" || team.currentUserRole === "ADMIN") && (
                    <button
                      onClick={() => {
                        setEditingOrgId(team.organization.id)
                        setEditingOrgName(team.organization.name)
                      }}
                      className="p-1 text-slate-400 hover:text-slate-300 transition-colors"
                      title="Redigera organisationsnamn"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </h1>
          </div>
          <p className="text-slate-400">Hantera ditt team och bjud in nya medlemmar</p>
        </div>

        {/* Organizations List */}
        {organizations.length > 1 && (
          <Card variant="glass" className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Mina organisationer</h2>
              <Button variant="secondary" onClick={() => setShowCreateOrg(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Skapa ny
              </Button>
            </div>

            {showCreateOrg && (
              <form onSubmit={handleCreateOrg} className="mb-4 p-4 bg-slate-800/30 rounded-lg">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="T.ex. Bolag X AB"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    autoFocus
                  />
                  <Button type="submit" isLoading={isCreatingOrg}>
                    Skapa
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => {
                    setShowCreateOrg(false)
                    setNewOrgName("")
                  }}>
                    Avbryt
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    org.id === team.organization.id
                      ? "bg-emerald-500/20 border border-emerald-500/30"
                      : "bg-slate-800/30 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex-1">
                    {editingOrgId === org.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingOrgName}
                          onChange={(e) => setEditingOrgName(e.target.value)}
                          onBlur={() => handleUpdateOrgName(org.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateOrgName(org.id)
                            } else if (e.key === "Escape") {
                              setEditingOrgId(null)
                              setEditingOrgName("")
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 bg-slate-800 border border-emerald-500/50 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">{org.name}</span>
                        {org.id === team.organization.id && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                            Aktiv
                          </span>
                        )}
                        {(org.role === "OWNER" || org.role === "ADMIN") && (
                          <button
                            onClick={() => {
                              setEditingOrgId(org.id)
                              setEditingOrgName(org.name)
                            }}
                            className="p-1 text-slate-400 hover:text-slate-300 transition-colors"
                            title="Redigera organisationsnamn"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      {org.memberCount} medlemmar • {org.supplierCount} leverantörer • {roleLabels[org.role]}
                    </div>
                  </div>
                  {org.id !== team.organization.id && (
                    <Button
                      variant="secondary"
                      onClick={() => handleSwitchOrg(org.id)}
                      className="ml-4"
                    >
                      Växla till
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Create Organization (if user only has one) */}
        {organizations.length === 1 && (
          <Card variant="glass" className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Skapa ny organisation</h2>
                <p className="text-sm text-slate-400">Skapa en ny organisation för ett annat bolag eller projekt</p>
              </div>
              {!showCreateOrg && (
                <Button variant="secondary" onClick={() => setShowCreateOrg(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Skapa ny
                </Button>
              )}
            </div>

            {showCreateOrg && (
              <form onSubmit={handleCreateOrg} className="mt-4 p-4 bg-slate-800/30 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Organisationsnamn</label>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="T.ex. Bolag X AB"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => {
                      setShowCreateOrg(false)
                      setNewOrgName("")
                    }}>
                      Avbryt
                    </Button>
                    <Button type="submit" isLoading={isCreatingOrg}>
                      Skapa organisation
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </Card>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {inviteSuccess && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-emerald-400 mb-2">{inviteSuccess}</p>
            {inviteUrl && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-800 rounded text-sm text-slate-300 font-mono"
                />
                <Button variant="secondary" onClick={copyInviteUrl}>
                  Kopiera länk
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Invite Section */}
        {canInvite && (
          <Card variant="glass" className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Bjud in medlemmar</h2>
              {!showInviteForm && (
                <Button variant="secondary" onClick={() => setShowInviteForm(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Bjud in
                </Button>
              )}
            </div>

            {showInviteForm && (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      label="E-postadress"
                      type="email"
                      placeholder="kollega@foretag.se"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Roll</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="MEMBER">Medlem</option>
                      {team.currentUserRole === "OWNER" && (
                        <option value="ADMIN">Administratör</option>
                      )}
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowInviteForm(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" isLoading={isInviting}>
                    Skicka inbjudan
                  </Button>
                </div>
              </form>
            )}

            {/* Pending Invitations */}
            {team.pendingInvitations.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Väntande inbjudningar</h3>
                <div className="space-y-2">
                  {team.pendingInvitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div>
                        <p className="text-slate-100">{inv.email}</p>
                        <p className="text-xs text-slate-500">
                          {roleLabels[inv.role]} • Går ut {new Date(inv.expiresAt).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleCancelInvitation(inv.id)}
                      >
                        Avbryt
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Members List */}
        <Card variant="glass">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Medlemmar ({team.members.length})
          </h2>
          
          <div className="space-y-3">
            {team.members.map((member) => (
              <div 
                key={member.id} 
                className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {member.image ? (
                    <img 
                      src={member.image} 
                      alt={member.name || ""} 
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-lg text-slate-400">
                        {(member.name || member.email || "?")[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-100">
                      {member.name || member.email}
                      {member.isCurrentUser && (
                        <span className="ml-2 text-xs text-slate-500">(du)</span>
                      )}
                    </p>
                    {member.name && (
                      <p className="text-sm text-slate-400">{member.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                  
                  {canManageMembers && !member.isCurrentUser && member.role !== "OWNER" && (
                    <Button 
                      variant="ghost" 
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Ta bort
                    </Button>
                  )}
                  
                  {member.isCurrentUser && member.role !== "OWNER" && (
                    <Button 
                      variant="ghost" 
                      className="text-slate-400 hover:text-slate-300"
                      onClick={() => handleRemoveMember(member.id, true)}
                    >
                      Lämna
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Role Explanation */}
        <div className="mt-8 p-4 bg-slate-800/30 rounded-xl">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Roller förklarade</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${roleColors.OWNER}`}>
                Ägare
              </span>
              <p className="text-slate-400">Full åtkomst. Kan ta bort teamet och hantera alla medlemmar.</p>
            </div>
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${roleColors.ADMIN}`}>
                Administratör
              </span>
              <p className="text-slate-400">Kan bjuda in/ta bort medlemmar och full dataåtkomst.</p>
            </div>
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${roleColors.MEMBER}`}>
                Medlem
              </span>
              <p className="text-slate-400">Kan se och lägga till data, men inte hantera team.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

