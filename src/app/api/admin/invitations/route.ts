import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateInvitationToken, getInvitationExpiry } from "@/lib/organization"

// GET - List all standalone invitations (super admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is super admin
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, isSuperAdmin: true },
    })

    if (!adminUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: "Endast superadmin kan se inbjudningar" },
        { status: 403 }
      )
    }

    // Get all standalone invitations
    const invitations = await prisma.invitation.findMany({
      where: { isStandalone: true },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error("Error fetching invitations:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta inbjudningar" },
      { status: 500 }
    )
  }
}

// POST - Create standalone invitation (super admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is super admin
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, isSuperAdmin: true },
    })

    if (!adminUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: "Endast superadmin kan skapa inbjudningar" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email } = body as { email?: string }

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists and has organizations
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: true,
      },
    })

    if (existingUser?.memberships.length) {
      return NextResponse.json(
        { error: "Användaren finns redan och har organisationer" },
        { status: 400 }
      )
    }

    // Check if there's already a pending standalone invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        isStandalone: true,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvitation) {
      // Return existing invitation URL
      const baseUrl = process.env.NEXTAUTH_URL || "https://levscorepro.com"
      const inviteUrl = `${baseUrl}/invite/${existingInvitation.token}`
      
      return NextResponse.json({
        success: true,
        message: "En inbjudan finns redan för denna e-post",
        inviteUrl,
        token: existingInvitation.token,
        expiresAt: existingInvitation.expiresAt,
        isExisting: true,
      })
    }

    // Create standalone invitation
    const token = generateInvitationToken()
    const expiresAt = getInvitationExpiry()

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
        invitedById: adminUser.id,
        isStandalone: true,
        role: "OWNER", // Standalone users become OWNER of their own org
        organizationId: null,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "https://levscorepro.com"
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`

    return NextResponse.json({
      success: true,
      message: `Inbjudan skapad för ${normalizedEmail}`,
      inviteUrl,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error("Error creating invitation:", error)
    return NextResponse.json(
      { error: "Kunde inte skapa inbjudan" },
      { status: 500 }
    )
  }
}

// DELETE - Delete standalone invitation (super admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is super admin
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { isSuperAdmin: true },
    })

    if (!adminUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: "Endast superadmin kan ta bort inbjudningar" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get("id")

    if (!invitationId) {
      return NextResponse.json({ error: "Inbjudnings-ID saknas" }, { status: 400 })
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invitation:", error)
    return NextResponse.json(
      { error: "Kunde inte ta bort inbjudan" },
      { status: 500 }
    )
  }
}

