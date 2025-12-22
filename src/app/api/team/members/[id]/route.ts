import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext, hasRole, MemberRole } from "@/lib/organization"

// PATCH - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: memberId } = await params

    // Get the member to update
    const member = await prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organization.id,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Medlem hittades inte" }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { role } = body as { role?: MemberRole }

    const validRoles: MemberRole[] = ["OWNER", "ADMIN", "MEMBER"]
    if (!role || !validRoles.includes(role as MemberRole)) {
      return NextResponse.json({ error: "Ogiltig roll" }, { status: 400 })
    }
    
    const newRole = role as MemberRole

    // Permission checks
    const targetCurrentRole = member.role as MemberRole

    // Can't change your own role (except OWNER stepping down)
    if (member.userId === ctx.user.id) {
      // OWNER can transfer ownership
      if (ctx.role === "OWNER" && role !== "OWNER") {
        // Check there's another OWNER or this will make us ownerless
        const otherOwners = await prisma.organizationMember.count({
          where: {
            organizationId: ctx.organization.id,
            role: "OWNER",
            userId: { not: ctx.user.id },
          },
        })
        
        if (otherOwners === 0 && newRole !== "OWNER") {
          return NextResponse.json(
            { error: "Det måste finnas minst en ägare. Överför ägarskapet först." },
            { status: 400 }
          )
        }
      } else {
        return NextResponse.json(
          { error: "Du kan inte ändra din egen roll" },
          { status: 403 }
        )
      }
    }

    // Only OWNER can change roles
    if (ctx.role !== "OWNER") {
      return NextResponse.json(
        { error: "Endast ägare kan ändra roller" },
        { status: 403 }
      )
    }

    // Can't demote another OWNER unless you're the only one doing it
    if (targetCurrentRole === "OWNER" && newRole !== "OWNER") {
      return NextResponse.json(
        { error: "Ägare kan inte degraderas direkt. Be dem överföra ägarskap först." },
        { status: 403 }
      )
    }

    await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera medlem" },
      { status: 500 }
    )
  }
}

// DELETE - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: memberId } = await params

    // Get the member to remove
    const member = await prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organization.id,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Medlem hittades inte" }, { status: 404 })
    }

    // Users can remove themselves (leave)
    if (member.userId === ctx.user.id) {
      // OWNER can't leave if they're the only owner
      if (ctx.role === "OWNER") {
        const otherOwners = await prisma.organizationMember.count({
          where: {
            organizationId: ctx.organization.id,
            role: "OWNER",
            userId: { not: ctx.user.id },
          },
        })
        
        if (otherOwners === 0) {
          return NextResponse.json(
            { error: "Du är den enda ägaren. Överför ägarskapet innan du lämnar." },
            { status: 400 }
          )
        }
      }

      await prisma.organizationMember.delete({
        where: { id: memberId },
      })

      return NextResponse.json({ success: true, left: true })
    }

    // Only ADMIN+ can remove others
    if (!hasRole(ctx.role, "ADMIN")) {
      return NextResponse.json(
        { error: "Du har inte behörighet att ta bort medlemmar" },
        { status: 403 }
      )
    }

    // Can't remove OWNER
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "Ägare kan inte tas bort" },
        { status: 403 }
      )
    }

    // ADMIN can only remove MEMBER, not other ADMINs
    if (ctx.role === "ADMIN" && member.role === "ADMIN") {
      return NextResponse.json(
        { error: "Administratörer kan inte ta bort andra administratörer" },
        { status: 403 }
      )
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json(
      { error: "Kunde inte ta bort medlem" },
      { status: 500 }
    )
  }
}

