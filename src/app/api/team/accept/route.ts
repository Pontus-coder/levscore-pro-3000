import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST - Accept invitation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { token } = body as { token?: string }

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Ogiltig inbjudningstoken" }, { status: 400 })
    }

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Inbjudan hittades inte" }, { status: 404 })
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Inbjudan har gått ut" }, { status: 400 })
    }

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      // Check if user is blocked (shouldn't happen if signIn callback works, but double-check)
      const blockedCheck = await prisma.user.findFirst({
        where: {
          email: session.user.email,
          isBlocked: true,
        },
      })
      
      if (blockedCheck) {
        return NextResponse.json(
          { error: "Din användare är blockerad" },
          { status: 403 }
        )
      }

      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        },
      })
    }

    // Double-check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Din användare är blockerad" },
        { status: 403 }
      )
    }

    // Check if invitation email matches (case insensitive)
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Denna inbjudan är för en annan e-postadress" },
        { status: 403 }
      )
    }

    // Handle standalone invitations
    if (invitation.isStandalone) {
      // Delete the invitation - user can now create their own organization
      await prisma.invitation.delete({ where: { id: invitation.id } })
      
      return NextResponse.json({
        success: true,
        message: "Välkommen till LevScore PRO! Du kan nu skapa din organisation.",
        isStandalone: true,
        redirectTo: "/onboarding",
      })
    }

    // Regular organization invitation - check if organization exists
    if (!invitation.organizationId || !invitation.organization) {
      return NextResponse.json(
        { error: "Organisationen för denna inbjudan finns inte längre" },
        { status: 404 }
      )
    }

    // Check if already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    })

    if (existingMembership) {
      // Delete the invitation since user is already a member
      await prisma.invitation.delete({ where: { id: invitation.id } })
      return NextResponse.json({
        success: true,
        message: "Du är redan medlem i detta team",
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
      })
    }

    // Create membership and delete invitation in a transaction
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      prisma.invitation.delete({
        where: { id: invitation.id },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `Välkommen till ${invitation.organization.name}!`,
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
    })
  } catch (error) {
    console.error("Error accepting invitation:", error)
    return NextResponse.json(
      { error: "Kunde inte acceptera inbjudan" },
      { status: 500 }
    )
  }
}

// GET - Get invitation details (for preview before accepting)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token saknas" }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Inbjudan hittades inte. Den kan ha gått ut eller raderats." }, { status: 404 })
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Inbjudan har gått ut" }, { status: 400 })
    }

    // Handle standalone invitations
    if (invitation.isStandalone) {
      return NextResponse.json({
        email: invitation.email,
        role: invitation.role,
        isStandalone: true,
        invitedBy: invitation.invitedBy.name || invitation.invitedBy.email,
        expiresAt: invitation.expiresAt,
      })
    }

    // Kontrollera att organisationen fortfarande finns
    if (!invitation.organization || !invitation.organization.id) {
      return NextResponse.json({ error: "Organisationen för denna inbjudan finns inte längre" }, { status: 404 })
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      isStandalone: false,
      organizationName: invitation.organization.name,
      memberCount: invitation.organization._count.members,
      invitedBy: invitation.invitedBy.name || invitation.invitedBy.email,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error("Error fetching invitation:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta inbjudan" },
      { status: 500 }
    )
  }
}

