import { prisma } from "./db"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { NextRequest } from "next/server"
import crypto from "crypto"

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER"

export interface OrganizationContext {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
  }
  role: MemberRole
}

/**
 * Get the current user's organization context
 * Uses selected organization from cookie, or first organization, or creates one
 */
export async function getOrganizationContext(request?: { cookies: { get: (name: string) => { value: string } | undefined } } | NextRequest): Promise<OrganizationContext | null> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          joinedAt: "asc", // Oldest first (likely the user's own organization)
        },
      },
    },
  })

  if (!user) {
    return null
  }

  // Get selected organization ID from cookie if available
  let selectedOrgId: string | null = null
  if (request) {
    // Handle both NextRequest and simple object with cookies
    const cookies = 'cookies' in request ? request.cookies : (request as any).cookies
    if (cookies) {
      const orgCookie = cookies.get("selectedOrganizationId")
      selectedOrgId = orgCookie?.value || null
    }
  }

  // Find membership - prefer selected org, otherwise first one
  let membership = selectedOrgId
    ? user.memberships.find(m => m.organizationId === selectedOrgId) || null
    : (user.memberships[0] as typeof user.memberships[0] | null)

  // If no membership, create a personal organization
  if (!membership) {
    const slug = generateSlug(user.name || user.email || "team")
    
    const organization = await prisma.organization.create({
      data: {
        name: user.name ? `${user.name}s team` : "Mitt team",
        slug,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    })

    const newMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId: organization.id,
      },
      include: {
        organization: true,
      },
    })

    if (!newMembership) {
      return null
    }
    
    membership = newMembership
  }

  if (!membership) {
    return null
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
      name: user.name,
      image: user.image,
    },
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    role: membership.role as MemberRole,
  }
}

/**
 * Check if user has required role or higher
 */
export function hasRole(userRole: MemberRole, requiredRole: MemberRole): boolean {
  const roleHierarchy: Record<MemberRole, number> = {
    OWNER: 3,
    ADMIN: 2,
    MEMBER: 1,
  }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Generate a URL-safe slug
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30)
  
  // Add random suffix to ensure uniqueness
  const suffix = crypto.randomBytes(4).toString("hex")
  return `${base}-${suffix}`
}

/**
 * Generate a secure invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Get invitation expiry date (7 days from now)
 */
export function getInvitationExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 7)
  return expiry
}

