import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { calculateAdjustedValues } from "@/lib/score-calculator"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // SECURITY: Verify ownership - supplier belongs to user's organization
    if (supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Calculate adjusted values for bonus/tender support
    const adjusted = calculateAdjustedValues(
      Number(supplier.totalTB),
      Number(supplier.totalRevenue),
      supplier.bonusAmount,
      supplier.tenderSupport,
      Number(supplier.salesScore),
      Number(supplier.assortmentScore),
      Number(supplier.efficiencyScore)
    )

    // Calculate adjusted score with custom factors
    const customFactorsScore = supplier.customFactors.reduce((sum, factor) => {
      return sum + Number(factor.factorValue) * Number(factor.weight)
    }, 0)

    // Final adjusted score = adjustedTotalScore (from bonus) + custom factors
    const finalAdjustedTotalScore = adjusted.adjustedTotalScore + customFactorsScore

    return NextResponse.json({
      ...supplier,
      adjustedTotalScore: finalAdjustedTotalScore,
      adjustedTotalTB: adjusted.adjustedTotalTB,
      adjustedAvgMargin: adjusted.adjustedAvgMargin,
      adjustedMarginScore: adjusted.adjustedMarginScore,
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
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    // First check if supplier exists and belongs to organization
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { organizationId: true },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership
    if (supplier.organizationId !== ctx.organization.id) {
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
