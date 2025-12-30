import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { calculateAdjustedValues } from "@/lib/score-calculator"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tier = searchParams.get("tier")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "adjustedTotalScore"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      organizationId: ctx.organization.id,
    }
    
    if (tier) {
      where.tier = tier
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { supplierNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        customFactors: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    // Calculate adjusted total score for each supplier (including bonus/tender support and custom factors)
    const suppliersWithAdjustedScore = suppliers.map(supplier => {
      // Calculate adjusted values from bonus/tender support
      const adjusted = calculateAdjustedValues(
        Number(supplier.totalTB),
        Number(supplier.totalRevenue),
        supplier.bonusAmount,
        supplier.tenderSupport,
        Number(supplier.salesScore),
        Number(supplier.assortmentScore),
        Number(supplier.efficiencyScore)
      )

      // Add custom factors
      const customFactorsScore = supplier.customFactors.reduce((sum, factor) => {
        return sum + Number(factor.factorValue) * Number(factor.weight)
      }, 0)

      // Final adjusted score = adjustedTotalScore (from bonus) + custom factors
      const finalAdjustedTotalScore = adjusted.adjustedTotalScore + customFactorsScore

      return {
        ...supplier,
        adjustedTotalScore: finalAdjustedTotalScore,
      }
    })

    // Sort by adjustedTotalScore (or the requested field)
    suppliersWithAdjustedScore.sort((a, b) => {
      let aValue: number
      let bValue: number

      if (sortBy === "adjustedTotalScore") {
        aValue = a.adjustedTotalScore
        bValue = b.adjustedTotalScore
      } else {
        // For other fields, use the original field value
        aValue = Number((a as any)[sortBy] || 0)
        bValue = Number((b as any)[sortBy] || 0)
      }

      if (sortOrder === "asc") {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    // Calculate aggregated stats
    const totalRevenue = suppliers.reduce((sum, s) => sum + Number(s.totalRevenue), 0)
    const totalTB = suppliers.reduce((sum, s) => sum + Number(s.totalTB || 0), 0)
    
    // Beräkna genomsnittlig TG
    // Försök använda totalTB om det finns och är > 0, annars fallback till genomsnitt av avgMargin
    let avgMargin = 0
    if (totalTB > 0 && totalRevenue > 0) {
      // Använd viktat genomsnitt om totalTB finns
      avgMargin = (totalTB / totalRevenue) * 100
    } else if (suppliers.length > 0) {
      // Fallback: genomsnitt av avgMargin (för gamla data utan totalTB)
      avgMargin = suppliers.reduce((sum, s) => sum + Number(s.avgMargin || 0), 0) / suppliers.length
    }
    
    const stats = {
      totalSuppliers: suppliers.length,
      totalRevenue,
      avgMargin,
      avgTotalScore: suppliersWithAdjustedScore.length > 0
        ? suppliersWithAdjustedScore.reduce((sum, s) => sum + s.adjustedTotalScore, 0) / suppliersWithAdjustedScore.length
        : 0,
      tierDistribution: suppliers.reduce((acc, s) => {
        const tier = s.tier || "Okänd"
        acc[tier] = (acc[tier] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({ suppliers: suppliersWithAdjustedScore, stats })
  } catch (error) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    )
  }
}
