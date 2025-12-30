import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { getTrendData, type TrendData } from "@/lib/google-trends"

// GET: Hämta trenddata för en leverantörs nyckelord
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getOrganizationContext(request)
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const supplier = await prisma.supplier.findFirst({
      where: {
        id,
        organizationId: context.organization.id,
      },
      select: {
        id: true,
        name: true,
        keywords: true,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    if (supplier.keywords.length === 0) {
      return NextResponse.json({
        success: true,
        supplier: supplier.name,
        keywords: [],
        trends: [],
        message: "Inga nyckelord konfigurerade. Lägg till nyckelord för att se trenddata."
      })
    }

    // Hämta trenddata för varje nyckelord
    const trends: Array<{ keyword: string; data: TrendData | null; error?: string }> = []
    
    for (const keyword of supplier.keywords.slice(0, 5)) { // Max 5 nyckelord
      const result = await getTrendData(keyword)
      trends.push({
        keyword,
        data: result.success ? result.data! : null,
        error: result.error,
      })
      
      // Vänta lite mellan anrop
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      success: true,
      supplier: supplier.name,
      keywords: supplier.keywords,
      trends,
    })
  } catch (error) {
    console.error("Trends API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    )
  }
}

// PUT: Uppdatera nyckelord för en leverantör
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getOrganizationContext(request)
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { keywords } = body

    if (!Array.isArray(keywords)) {
      return NextResponse.json({ error: "Keywords must be an array" }, { status: 400 })
    }

    // Validera och rensa nyckelord
    const cleanedKeywords = keywords
      .filter((k: unknown) => typeof k === "string" && k.trim().length > 0)
      .map((k: string) => k.trim().toLowerCase())
      .slice(0, 10) // Max 10 nyckelord

    const supplier = await prisma.supplier.updateMany({
      where: {
        id,
        organizationId: context.organization.id,
      },
      data: {
        keywords: cleanedKeywords,
      },
    })

    if (supplier.count === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      keywords: cleanedKeywords,
    })
  } catch (error) {
    console.error("Update keywords error:", error)
    return NextResponse.json(
      { error: "Failed to update keywords" },
      { status: 500 }
    )
  }
}

