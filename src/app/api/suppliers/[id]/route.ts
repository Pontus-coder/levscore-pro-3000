import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { id } = await params

    // Validate ID format (CUID)
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        customFactors: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership - user can only access their own suppliers
    if (supplier.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Calculate adjusted score with custom factors
    const customFactorsScore = supplier.customFactors.reduce((sum, factor) => {
      return sum + Number(factor.factorValue) * Number(factor.weight)
    }, 0)

    const adjustedTotalScore = Number(supplier.totalScore) + customFactorsScore

    return NextResponse.json({
      ...supplier,
      adjustedTotalScore,
    })
  } catch (error) {
    console.error("Error fetching supplier:", error)
    return NextResponse.json(
      { error: "Failed to fetch supplier" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { id } = await params

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    // First check if supplier exists and belongs to user
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership - user can only delete their own suppliers
    if (supplier.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await prisma.supplier.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting supplier:", error)
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    )
  }
}
