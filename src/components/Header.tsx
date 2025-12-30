"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import { Button } from "./ui/Button"

interface Organization {
  id: string
  name: string
  slug: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  memberCount: number
  supplierCount: number
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const orgMenuRef = useRef<HTMLDivElement>(null)

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Ladda upp", href: "/upload" },
  ]

  // Fetch organizations and current org
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch("/api/organizations")
        if (response.ok) {
          const data = await response.json()
          setOrganizations(data.organizations || [])
          
          // Get current org from cookie or use first one
          const cookies = document.cookie.split("; ")
          const selectedOrgId = cookies.find(c => c.startsWith("selectedOrganizationId="))?.split("=")[1]
          const current = selectedOrgId 
            ? data.organizations.find((o: Organization) => o.id === selectedOrgId)
            : data.organizations[0]
          setCurrentOrg(current || data.organizations[0] || null)
        }
      } catch (error) {
        console.error("Error fetching organizations:", error)
      } finally {
        setIsLoadingOrgs(false)
      }
    }

    if (session) {
      fetchOrganizations()
    }
  }, [session])

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setShowOrgMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSwitchOrg = async (orgId: string) => {
    try {
      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentOrg(data.organization)
        setShowOrgMenu(false)
        // Reload page to update all data
        router.refresh()
        window.location.reload()
      }
    } catch (error) {
      console.error("Error switching organization:", error)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-100">LevScore</span>
              <span className="text-lg font-light text-emerald-400 ml-1">PRO</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Organization Selector */}
          {session?.user && !isLoadingOrgs && currentOrg && (
            <div className="relative" ref={orgMenuRef}>
              <button
                onClick={() => setShowOrgMenu(!showOrgMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-slate-200 font-medium max-w-[200px] truncate">
                  {currentOrg.name}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Organization Dropdown */}
              {showOrgMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Organisationer</p>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleSwitchOrg(org.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                          currentOrg.id === org.id
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                        }`}
                      >
                        <div className="flex-1 text-left">
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {org.memberCount} medlemmar • {org.supplierCount} leverantörer
                          </div>
                        </div>
                        {currentOrg.id === org.id && (
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-700 px-4 py-2">
                    <Link
                      href="/team"
                      onClick={() => setShowOrgMenu(false)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Skapa eller hantera organisationer
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Menu */}
          {session?.user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-8 h-8 rounded-full ring-2 ring-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-sm text-slate-300">
                      {(session.user.name || session.user.email || "U")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm text-slate-300 hidden sm:block">
                  {session.user.name}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-sm font-medium text-slate-100">{session.user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      href="/team"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Team & Inbjudningar
                    </Link>
                    {session?.user && (session.user as any).isSuperAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Super Admin
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-700 py-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logga ut
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
