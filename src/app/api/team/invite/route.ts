import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { 
  getOrganizationContext, 
  hasRole, 
  generateInvitationToken, 
  getInvitationExpiry,
  MemberRole 
} from "@/lib/organization"

// POST - Send invitation
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only OWNER and ADMIN can invite
    if (!hasRole(ctx.role, "ADMIN")) {
      return NextResponse.json(
        { error: "Du har inte behörighet att bjuda in medlemmar" },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { email, role } = body as { email?: string; role?: MemberRole }

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Validate role
    const allowedRoles: MemberRole[] = ["ADMIN", "MEMBER"]
    const inviteRole: MemberRole = role && allowedRoles.includes(role) ? role : "MEMBER"

    // Only OWNER can invite ADMIN
    if (inviteRole === "ADMIN" && ctx.role !== "OWNER") {
      return NextResponse.json(
        { error: "Endast ägare kan bjuda in administratörer" },
        { status: 403 }
      )
    }

    // Check if user already exists and is member
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { organizationId: ctx.organization.id },
        },
      },
    })

    if (existingUser?.memberships.length) {
      return NextResponse.json(
        { error: "Användaren är redan medlem i teamet" },
        { status: 400 }
      )
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        email_organizationId: {
          email: normalizedEmail,
          organizationId: ctx.organization.id,
        },
      },
    })

    if (existingInvitation) {
      // Update existing invitation
      const invitation = await prisma.invitation.update({
        where: { id: existingInvitation.id },
        data: {
          role: inviteRole,
          token: generateInvitationToken(),
          expiresAt: getInvitationExpiry(),
          invitedById: ctx.user.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Inbjudan uppdaterad",
        inviteUrl: `${process.env.NEXTAUTH_URL}/invite/${invitation.token}`,
      })
    }

    // Create new invitation
    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        organizationId: ctx.organization.id,
        role: inviteRole,
        token: generateInvitationToken(),
        expiresAt: getInvitationExpiry(),
        invitedById: ctx.user.id,
      },
    })

    // In a real app, you'd send an email here
    // For now, return the invite URL

    return NextResponse.json({
      success: true,
      message: `Inbjudan skapad för ${normalizedEmail}`,
      inviteUrl: `${process.env.NEXTAUTH_URL}/invite/${invitation.token}`,
    })
  } catch (error) {
    console.error("Error creating invitation:", error)
    return NextResponse.json(
      { error: "Kunde inte skapa inbjudan" },
      { status: 500 }
    )
  }
}

// DELETE - Cancel invitation
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasRole(ctx.role, "ADMIN")) {
      return NextResponse.json(
        { error: "Du har inte behörighet att ta bort inbjudningar" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get("id")

    if (!invitationId) {
      return NextResponse.json({ error: "Inbjudnings-ID saknas" }, { status: 400 })
    }

    // Verify invitation belongs to this org
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: ctx.organization.id,
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Inbjudan hittades inte" }, { status: 404 })
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

