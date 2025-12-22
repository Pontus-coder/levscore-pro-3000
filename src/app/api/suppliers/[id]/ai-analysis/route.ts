import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { generateAIDiagnosis, type SupplierData } from "@/lib/ai-diagnostics"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Hämta användarens organisation
    const context = await getOrganizationContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Hämta leverantören
    const supplier = await prisma.supplier.findFirst({
      where: {
        id,
        organizationId: context.organization.id,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // Förbered data för AI-analys
    const supplierData: SupplierData = {
      name: supplier.name,
      supplierNumber: supplier.supplierNumber,
      totalRevenue: supplier.totalRevenue,
      avgMargin: supplier.avgMargin,
      rowCount: supplier.rowCount,
      totalQuantity: supplier.totalQuantity,
      salesScore: supplier.salesScore,
      assortmentScore: supplier.assortmentScore,
      efficiencyScore: supplier.efficiencyScore,
      marginScore: supplier.marginScore,
      totalScore: supplier.totalScore,
      tier: supplier.tier,
      revenueShare: supplier.revenueShare,
    }

    // Generera AI-analys
    const analysis = await generateAIDiagnosis(supplierData)

    return NextResponse.json({
      success: true,
      analysis,
      isAIPowered: !!process.env.OPENAI_API_KEY,
    })
  } catch (error) {
    console.error("AI analysis error:", error)
    return NextResponse.json(
      { error: "Failed to generate analysis" },
      { status: 500 }
    )
  }
}

