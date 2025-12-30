import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET - List all users (super admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is super admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { isSuperAdmin: true },
    })

    if (!user?.isSuperAdmin) {
      return NextResponse.json(
        { error: "Endast superadmin kan se denna information" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const blocked = searchParams.get("blocked")

    const where: any = {}
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }

    if (blocked === "true") {
      where.isBlocked = true
    } else if (blocked === "false") {
      where.isBlocked = false
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isSuperAdmin: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            invitationsSent: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Get organization info for each user
    const usersWithOrgs = await Promise.all(
      users.map(async (user) => {
        const memberships = await prisma.organizationMember.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: {
                  select: {
                    members: true,
                    suppliers: true,
                  },
                },
              },
            },
          },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          isSuperAdmin: user.isSuperAdmin,
          isBlocked: user.isBlocked,
          blockedAt: user.blockedAt,
          blockedReason: user.blockedReason,
          createdAt: user.createdAt,
          organizationCount: user._count.memberships,
          invitationCount: user._count.invitationsSent,
          organizations: memberships.map(m => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
            memberCount: m.organization._count.members,
            supplierCount: m.organization._count.suppliers,
          })),
        }
      })
    )

    return NextResponse.json({ users: usersWithOrgs })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

