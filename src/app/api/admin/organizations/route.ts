import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET - List all organizations (super admin only)
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

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ]
    }

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            suppliers: true,
            uploads: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isSuperAdmin: true,
              },
            },
          },
          orderBy: [
            { role: "asc" },
            { joinedAt: "asc" },
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const orgsWithDetails = organizations.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      supplierCount: org._count.suppliers,
      uploadCount: org._count.uploads,
      owners: org.members
        .filter(m => m.role === "OWNER")
        .map(m => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          isSuperAdmin: m.user.isSuperAdmin,
        })),
      admins: org.members
        .filter(m => m.role === "ADMIN")
        .map(m => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
    }))

    return NextResponse.json({ organizations: orgsWithDetails })
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    )
  }
}



