"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  isSuperAdmin: boolean
  isBlocked: boolean
  blockedAt: string | null
  blockedReason: string | null
  createdAt: string
  organizationCount: number
  invitationCount: number
  organizations: Array<{
    id: string
    name: string
    slug: string
    role: string
    memberCount: number
    supplierCount: number
  }>
}

interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
  memberCount: number
  supplierCount: number
  uploadCount: number
  owners: Array<{
    id: string
    name: string | null
    email: string | null
    isSuperAdmin: boolean
  }>
  admins: Array<{
    id: string
    name: string | null
    email: string | null
  }>
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"users" | "organizations">("users")
  const [users, setUsers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [blockedFilter, setBlockedFilter] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    async function checkAccess() {
      if (!session?.user) return

      // Check if user is super admin
      const response = await fetch("/api/admin/users")
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard")
          return
        }
        setError("Kunde inte ladda admin-data")
        setIsLoading(false)
        return
      }

      setIsLoading(false)
    }

    if (status === "authenticated") {
      checkAccess()
      fetchUsers()
      fetchOrganizations()
    }
  }, [status, session, router])

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (blockedFilter) params.append("blocked", blockedFilter)

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchOrganizations = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)

      const response = await fetch(`/api/admin/organizations?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error("Error fetching organizations:", error)
    }
  }

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers()
    } else {
      fetchOrganizations()
    }
  }, [searchTerm, blockedFilter, activeTab])

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    if (!confirm(isBlocked ? "Är du säker på att du vill blockera denna användare?" : "Är du säker på att du vill avblockera denna användare?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunde inte uppdatera användare")
        return
      }

      fetchUsers()
    } catch (error) {
      alert("Något gick fel")
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Är du säker på att du vill radera denna användare? Alla deras data kommer att raderas permanent.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunde inte radera användare")
        return
      }

      fetchUsers()
    } catch (error) {
      alert("Något gick fel")
    }
  }

  const handleDeleteOrganization = async (orgId: string) => {
    if (!confirm("Är du säker på att du vill radera denna organisation? All data kommer att raderas permanent.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunde inte radera organisation")
        return
      }

      fetchOrganizations()
    } catch (error) {
      alert("Något gick fel")
    }
  }

  const handleSetSuperAdmin = async (userId: string, isSuperAdmin: boolean) => {
    if (!confirm(isSuperAdmin ? "Är du säker på att du vill ge denna användare superadmin-rättigheter?" : "Är du säker på att du vill ta bort superadmin-rättigheter från denna användare?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuperAdmin }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunde inte uppdatera användare")
        return
      }

      fetchUsers()
    } catch (error) {
      alert("Något gick fel")
    }
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

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Super Admin Panel</h1>
          <p className="text-slate-400">Hantera alla användare och organisationer</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "users"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Användare ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("organizations")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "organizations"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Organisationer ({organizations.length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Sök..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === "users" && (
            <select
              value={blockedFilter || ""}
              onChange={(e) => setBlockedFilter(e.target.value || null)}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
            >
              <option value="">Alla användare</option>
              <option value="false">Aktiva</option>
              <option value="true">Blockerade</option>
            </select>
          )}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card variant="glass">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Användare</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Organisationer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Skapad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt={user.name || ""} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                              <span className="text-sm text-slate-400">
                                {(user.name || user.email || "?")[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-100">
                              {user.name || user.email}
                            </div>
                            {user.name && (
                              <div className="text-sm text-slate-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {user.isSuperAdmin && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                              Super Admin
                            </span>
                          )}
                          {user.isBlocked ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                              Blockerad
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                              Aktiv
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {user.organizationCount} org{user.organizationCount !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString("sv-SE")}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!user.isSuperAdmin && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSetSuperAdmin(user.id, true)}
                            >
                              Gör superadmin
                            </Button>
                          )}
                          {user.isSuperAdmin && user.id !== session?.user?.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSetSuperAdmin(user.id, false)}
                            >
                              Ta bort superadmin
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleBlockUser(user.id, !user.isBlocked)}
                            className={user.isBlocked ? "text-emerald-400" : "text-red-400"}
                          >
                            {user.isBlocked ? "Avblockera" : "Blockera"}
                          </Button>
                          {user.id !== session?.user?.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-400"
                            >
                              Radera
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  Inga användare hittades
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Organizations Tab */}
        {activeTab === "organizations" && (
          <div className="space-y-4">
            {organizations.map((org) => (
              <Card key={org.id} variant="glass">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-100">{org.name}</h3>
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                        {org.slug}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-slate-500">Medlemmar:</span>
                        <span className="text-slate-300 ml-2">{org.memberCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Leverantörer:</span>
                        <span className="text-slate-300 ml-2">{org.supplierCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Uppladdningar:</span>
                        <span className="text-slate-300 ml-2">{org.uploadCount}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {org.owners.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-500">Ägare:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {org.owners.map((owner) => (
                              <span
                                key={owner.id}
                                className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs"
                              >
                                {owner.name || owner.email}
                                {owner.isSuperAdmin && " (Super Admin)"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {org.admins.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-500">Administratörer:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {org.admins.map((admin) => (
                              <span
                                key={admin.id}
                                className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs"
                              >
                                {admin.name || admin.email}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Skapad: {new Date(org.createdAt).toLocaleDateString("sv-SE")}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDeleteOrganization(org.id)}
                    className="text-red-400"
                  >
                    Radera
                  </Button>
                </div>
              </Card>
            ))}
            {organizations.length === 0 && (
              <Card variant="glass">
                <div className="text-center py-12 text-slate-500">
                  Inga organisationer hittades
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}



