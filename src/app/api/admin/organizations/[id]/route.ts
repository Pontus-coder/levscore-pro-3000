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

    // Super admin can delete any organization, including ones they're a member of
    // First remove their own membership if it exists (to avoid foreign key issues)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (user) {
      await prisma.organizationMember.deleteMany({
        where: {
          userId: user.id,
          organizationId: id,
        },
      })
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



