import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// DELETE - Delete organization (super admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: "Endast superadmin kan ta bort organisationer" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if admin is a member of this organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          where: { organizationId: id },
        },
      },
    })

    if (user?.memberships.length) {
      return NextResponse.json(
        { error: "Du kan inte ta bort en organisation du är medlem i. Lämna organisationen först." },
        { status: 400 }
      )
    }

    // Delete organization (cascade will handle related data)
    await prisma.organization.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Organisation raderad" })
  } catch (error) {
    console.error("Error deleting organization:", error)
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    )
  }
}



