import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { generateAIDiagnosis, type SupplierData, type AIAnalysis } from "@/lib/ai-diagnostics"
import { getTrendData, formatTrendsForAI, type TrendData } from "@/lib/google-trends"

interface CachedAnalysis extends AIAnalysis {
  trends?: Array<{ keyword: string; data: TrendData | null }>
  generatedAt: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getOrganizationContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get("refresh") === "true"

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

    // Kolla om vi har en cachad analys som inte är för gammal (max 7 dagar)
    if (!forceRefresh && supplier.aiAnalysis && supplier.aiAnalysisDate) {
      const ageInDays = (Date.now() - supplier.aiAnalysisDate.getTime()) / (1000 * 60 * 60 * 24)
      if (ageInDays < 7) {
        try {
          const cached = JSON.parse(supplier.aiAnalysis) as CachedAnalysis
          return NextResponse.json({
            success: true,
            analysis: cached,
            isAIPowered: !!process.env.OPENAI_API_KEY,
            cached: true,
            cachedAt: supplier.aiAnalysisDate,
          })
        } catch {
          // Om parsing misslyckas, generera ny analys
        }
      }
    }

    // Hämta trenddata om nyckelord finns
    let trendsData: Array<{ keyword: string; data: TrendData | null }> = []
    let trendsForAI = ""
    
    if (supplier.keywords && supplier.keywords.length > 0) {
      const trendsMap = new Map<string, { success: boolean; data?: TrendData; error?: string }>()
      
      for (const keyword of supplier.keywords.slice(0, 3)) { // Max 3 för AI
        const result = await getTrendData(keyword)
        trendsMap.set(keyword, result)
        trendsData.push({
          keyword,
          data: result.success ? result.data! : null,
        })
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      trendsForAI = formatTrendsForAI(trendsMap)
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
      // Lägg till trenddata
      trendsContext: trendsForAI || undefined,
    }

    // Generera AI-analys
    const analysis = await generateAIDiagnosis(supplierData)

    // Skapa cachad analys med trends
    const cachedAnalysis: CachedAnalysis = {
      ...analysis,
      trends: trendsData.length > 0 ? trendsData : undefined,
      generatedAt: new Date().toISOString(),
    }

    // Spara till databasen
    await prisma.supplier.update({
      where: { id },
      data: {
        aiAnalysis: JSON.stringify(cachedAnalysis),
        aiAnalysisDate: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      analysis: cachedAnalysis,
      isAIPowered: !!process.env.OPENAI_API_KEY,
      cached: false,
    })
  } catch (error) {
    console.error("AI analysis error:", error)
    return NextResponse.json(
      { error: "Failed to generate analysis" },
      { status: 500 }
    )
  }
}
