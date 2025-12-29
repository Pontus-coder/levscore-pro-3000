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

    // Hämta artikeldata för ABC-analys
    const articles = await prisma.article.findMany({
      where: { supplierId: id },
      orderBy: { revenue: "desc" },
    })

    let articleDistribution: SupplierData["articleDistribution"] | undefined
    if (articles.length > 0) {
      const aArticles = articles.filter(a => a.category === "A")
      const bArticles = articles.filter(a => a.category === "B")
      const cArticles = articles.filter(a => a.category === "C")

      // Identifiera topp B-artiklar med potential
      // Ta hänsyn till BÅDE omsättning OCH kvantitet
      const topBByRevenue = bArticles
        .filter(a => a.revenue > 0 && (a.margin === null || a.margin >= 20))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      const topBByQuantity = bArticles
        .filter(a => a.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)

      // Kombinera och deduplicera, prioritera artiklar med både hög omsättning OCH hög kvantitet
      const combinedBArticles = new Map<string, typeof bArticles[0] & { score: number }>()
      
      for (const article of bArticles) {
        if (article.revenue > 0 || article.quantity > 0) {
          // Beräkna ett "potential score" baserat på både omsättning och kvantitet
          // Normalisera omsättning (0-1) och kvantitet (0-1) och kombinera
          const maxRevenue = Math.max(...bArticles.map(a => a.revenue), 1)
          const maxQuantity = Math.max(...bArticles.map(a => a.quantity), 1)
          const revenueScore = article.revenue / maxRevenue
          const quantityScore = article.quantity / maxQuantity
          const combinedScore = (revenueScore * 0.6) + (quantityScore * 0.4) // 60% omsättning, 40% kvantitet
          
          combinedBArticles.set(article.id, { ...article, score: combinedScore })
        }
      }

      const topBArticles = Array.from(combinedBArticles.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(a => ({
          articleNumber: a.articleNumber,
          description: a.description,
          revenue: a.revenue,
          quantity: a.quantity,
          revenueShare: a.revenueShare,
          margin: a.margin,
        }))

      articleDistribution = {
        totalArticles: articles.length,
        aArticles: aArticles.length,
        bArticles: bArticles.length,
        cArticles: cArticles.length,
        aArticlePercentage: (aArticles.length / articles.length) * 100,
        topBArticles: topBArticles.length > 0 ? topBArticles : undefined,
      }
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
      // Lägg till artikeldata
      articleDistribution,
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
