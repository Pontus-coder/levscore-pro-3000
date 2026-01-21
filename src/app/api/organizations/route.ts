import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateSlug } from "@/lib/organization"

// GET - List all organizations user belongs to
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                _count: {
                  select: {
                    members: true,
                    suppliers: true,
                  },
                },
              },
            },
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const organizations = user.memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      memberCount: m.organization._count.members,
      supplierCount: m.organization._count.suppliers,
      joinedAt: m.joinedAt,
    }))

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    )
  }
}

// POST - Create new organization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body as { name?: string }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organisationsnamn krävs" },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Organisationsnamn får max vara 100 tecken" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const slug = generateSlug(name.trim())
    
    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            suppliers: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: "OWNER" as const,
        memberCount: organization._count.members,
        supplierCount: organization._count.suppliers,
      },
    })
  } catch (error) {
    console.error("Error creating organization:", error)
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    )
  }
}



