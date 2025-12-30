import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { calculateAdjustedValues } from "@/lib/score-calculator"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { bonusAmount, tenderSupport, bonusComment } = body

    // Validate input
    if (bonusAmount !== null && bonusAmount !== undefined && (typeof bonusAmount !== 'number' || bonusAmount < 0)) {
      return NextResponse.json({ error: "Bonus amount must be a non-negative number" }, { status: 400 })
    }

    if (tenderSupport !== null && tenderSupport !== undefined && (typeof tenderSupport !== 'number' || tenderSupport < 0)) {
      return NextResponse.json({ error: "Tender support must be a non-negative number" }, { status: 400 })
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: {
        organizationId: true,
        totalTB: true,
        totalRevenue: true,
        salesScore: true,
        assortmentScore: true,
        efficiencyScore: true,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership
    if (supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Calculate adjusted values
    const adjusted = calculateAdjustedValues(
      Number(supplier.totalTB),
      Number(supplier.totalRevenue),
      bonusAmount,
      tenderSupport,
      Number(supplier.salesScore),
      Number(supplier.assortmentScore),
      Number(supplier.efficiencyScore)
    )

    // Update supplier
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        bonusAmount: bonusAmount !== undefined ? bonusAmount : null,
        tenderSupport: tenderSupport !== undefined ? tenderSupport : null,
        bonusComment: bonusComment !== undefined ? bonusComment : null,
        adjustedTotalTB: adjusted.adjustedTotalTB,
        adjustedAvgMargin: adjusted.adjustedAvgMargin,
        adjustedMarginScore: adjusted.adjustedMarginScore,
        adjustedTotalScore: adjusted.adjustedTotalScore,
      },
    })

    return NextResponse.json({
      ...updated,
      adjustedTotalTB: adjusted.adjustedTotalTB,
      adjustedAvgMargin: adjusted.adjustedAvgMargin,
      adjustedMarginScore: adjusted.adjustedMarginScore,
      adjustedTotalScore: adjusted.adjustedTotalScore,
    })
  } catch (error) {
    console.error("Error updating bonus/tender support:", error)
    return NextResponse.json(
      { error: "Failed to update bonus/tender support" },
      { status: 500 }
    )
  }
}

