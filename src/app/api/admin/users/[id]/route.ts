import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH - Update user (block/unblock, set super admin)
export async function PATCH(
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
        { error: "Endast superadmin kan ändra användare" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { isBlocked, blockedReason, isSuperAdmin } = body as {
      isBlocked?: boolean
      blockedReason?: string
      isSuperAdmin?: boolean
    }

    // Prevent blocking yourself
    if (isBlocked && id === session.user.id) {
      return NextResponse.json(
        { error: "Du kan inte blockera dig själv" },
        { status: 400 }
      )
    }

    // Prevent removing super admin from yourself
    if (isSuperAdmin === false && id === session.user.id) {
      return NextResponse.json(
        { error: "Du kan inte ta bort superadmin-rättigheter från dig själv" },
        { status: 400 }
      )
    }

    const updateData: any = {}
    
    if (typeof isBlocked === "boolean") {
      updateData.isBlocked = isBlocked
      if (isBlocked) {
        updateData.blockedAt = new Date()
        updateData.blockedReason = blockedReason || null
      } else {
        updateData.blockedAt = null
        updateData.blockedReason = null
      }
    }

    if (typeof isSuperAdmin === "boolean") {
      updateData.isSuperAdmin = isSuperAdmin
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (super admin only)
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
        { error: "Endast superadmin kan ta bort användare" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Prevent deleting yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Du kan inte ta bort dig själv" },
        { status: 400 }
      )
    }

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Användare raderad" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}

