import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId, factorName, factorValue, weight, comment } = body

    if (!supplierId || !factorName || factorValue === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    const factor = await prisma.customFactor.create({
      data: {
        supplierId,
        userId: session.user.id,
        factorName,
        factorValue: parseFloat(factorValue),
        weight: weight ? parseFloat(weight) : 1,
        comment: comment || null,
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
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const factorId = searchParams.get("id")

    if (!factorId) {
      return NextResponse.json(
        { error: "Factor ID required" },
        { status: 400 }
      )
    }

    // Check if user owns this factor
    const factor = await prisma.customFactor.findUnique({
      where: { id: factorId },
    })

    if (!factor) {
      return NextResponse.json(
        { error: "Factor not found" },
        { status: 404 }
      )
    }

    if (factor.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Not authorized to delete this factor" },
        { status: 403 }
      )
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

