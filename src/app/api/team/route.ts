import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

// GET - List team members
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER first, then ADMIN, then MEMBER
        { joinedAt: "asc" },
      ],
    })

    const pendingInvitations = await prisma.invitation.findMany({
      where: { 
        organizationId: ctx.organization.id,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      organization: ctx.organization,
      currentUserRole: ctx.role,
      members: members.map(m => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
        isCurrentUser: m.user.id === ctx.user.id,
      })),
      pendingInvitations: pendingInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        invitedBy: inv.invitedBy.name || inv.invitedBy.email,
        createdAt: inv.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching team:", error)
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    )
  }
}

