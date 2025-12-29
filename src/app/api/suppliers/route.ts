import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tier = searchParams.get("tier")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "totalScore"
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
      orderBy: {
        [sortBy]: sortOrder,
      },
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
      avgTotalScore: suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + Number(s.totalScore), 0) / suppliers.length
        : 0,
      tierDistribution: suppliers.reduce((acc, s) => {
        const tier = s.tier || "Okänd"
        acc[tier] = (acc[tier] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({ suppliers, stats })
  } catch (error) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    )
  }
}
