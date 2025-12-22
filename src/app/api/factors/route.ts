import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Input validation constants
const MAX_FACTOR_NAME_LENGTH = 100
const MAX_COMMENT_LENGTH = 1000
const MAX_FACTOR_VALUE = 100
const MIN_FACTOR_VALUE = -100
const MAX_WEIGHT = 10
const MIN_WEIGHT = 0

export async function POST(request: NextRequest) {
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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { supplierId, factorName, factorValue, weight, comment } = body

    // Input validation
    if (!supplierId || typeof supplierId !== 'string') {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    if (!factorName || typeof factorName !== 'string' || factorName.length > MAX_FACTOR_NAME_LENGTH) {
      return NextResponse.json({ error: "Invalid factor name" }, { status: 400 })
    }

    if (factorValue === undefined || typeof factorValue !== 'number' || 
        factorValue < MIN_FACTOR_VALUE || factorValue > MAX_FACTOR_VALUE) {
      return NextResponse.json({ error: "Invalid factor value" }, { status: 400 })
    }

    if (weight !== undefined && (typeof weight !== 'number' || weight < MIN_WEIGHT || weight > MAX_WEIGHT)) {
      return NextResponse.json({ error: "Invalid weight" }, { status: 400 })
    }

    if (comment && (typeof comment !== 'string' || comment.length > MAX_COMMENT_LENGTH)) {
      return NextResponse.json({ error: "Invalid comment" }, { status: 400 })
    }

    // Verify supplier exists AND belongs to the user
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, userId: true },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership - user can only add factors to their own suppliers
    if (supplier.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const factor = await prisma.customFactor.create({
      data: {
        supplierId,
        userId: user.id,
        factorName: factorName.trim().substring(0, MAX_FACTOR_NAME_LENGTH),
        factorValue: Math.max(MIN_FACTOR_VALUE, Math.min(MAX_FACTOR_VALUE, factorValue)),
        weight: weight ? Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight)) : 1,
        comment: comment ? comment.trim().substring(0, MAX_COMMENT_LENGTH) : null,
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(factor)
  } catch (error) {
    console.error("Error creating factor:", error)
    return NextResponse.json(
      { error: "Failed to create factor" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const factorId = searchParams.get("id")

    if (!factorId || typeof factorId !== 'string') {
      return NextResponse.json({ error: "Factor ID required" }, { status: 400 })
    }

    // Check if user owns this factor
    const factor = await prisma.customFactor.findUnique({
      where: { id: factorId },
    })

    if (!factor) {
      return NextResponse.json({ error: "Factor not found" }, { status: 404 })
    }

    // SECURITY: User can only delete their own factors
    if (factor.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await prisma.customFactor.delete({
      where: { id: factorId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting factor:", error)
    return NextResponse.json(
      { error: "Failed to delete factor" },
      { status: 500 }
    )
  }
}
