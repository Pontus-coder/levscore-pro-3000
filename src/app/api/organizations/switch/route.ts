import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST - Switch to a different organization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId } = body as { organizationId?: string }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organisations-ID krävs" },
        { status: 400 }
      )
    }

    // Verify user is a member of this organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          where: {
            organizationId,
          },
          include: {
            organization: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const membership = user.memberships[0]
    if (!membership) {
      return NextResponse.json(
        { error: "Du är inte medlem i denna organisation" },
        { status: 403 }
      )
    }

    // Set cookie for selected organization
    const response = NextResponse.json({
      success: true,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      },
    })

    // Set cookie that expires in 1 year
    response.cookies.set("selectedOrganizationId", organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Error switching organization:", error)
    return NextResponse.json(
      { error: "Failed to switch organization" },
      { status: 500 }
    )
  }
}



