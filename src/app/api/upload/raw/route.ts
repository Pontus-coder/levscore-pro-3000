import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"
import {
  RawArticleData,
  toNumber,
  aggregateBySupplier,
  calculateAllScores,
} from "@/lib/score-calculator"

interface RawColumnMapping {
  articleNumber: string
  description: string
  quantity: string
  supplierNumber: string
  supplierName: string
  margin: string
  revenue: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const mappingStr = formData.get("mapping") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!mappingStr) {
      return NextResponse.json({ error: "No column mapping provided" }, { status: 400 })
    }

    const mapping = JSON.parse(mappingStr) as RawColumnMapping

    // Parse Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    // Konvertera till rådata format
    const articles: RawArticleData[] = []
    
    for (const row of data) {
      // Hämta värden baserat på mapping
      const articleNumber = mapping.articleNumber ? String(row[mapping.articleNumber] || "") : ""
      const description = mapping.description ? String(row[mapping.description] || "") : ""
      const quantity = mapping.quantity ? toNumber(row[mapping.quantity]) : 1
      const supplierNumber = String(row[mapping.supplierNumber] || "")
      const supplierName = String(row[mapping.supplierName] || "")
      const margin = mapping.margin ? toNumber(row[mapping.margin]) : 0
      const revenue = toNumber(row[mapping.revenue])

      // Skippa rader utan leverantörsnummer
      if (!supplierNumber) continue

      articles.push({
        articleNumber,
        description,
        quantity: isNaN(quantity) ? 1 : quantity,
        supplierNumber,
        supplierName,
        margin: isNaN(margin) ? 0 : margin,
        revenue: isNaN(revenue) ? 0 : revenue,
      })
    }

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No valid article data found" },
        { status: 400 }
      )
    }

    // Aggregera till leverantörsnivå
    const aggregated = aggregateBySupplier(articles)

    // Beräkna alla scores
    const calculated = calculateAllScores(aggregated)

    // Spara till databasen
    let imported = 0
    let updated = 0

    for (const supplier of calculated) {
      const existing = await prisma.supplier.findUnique({
        where: {
          supplierNumber_userId: {
            supplierNumber: supplier.supplierNumber,
            userId: user.id,
          },
        },
      })

      const supplierData = {
        supplierNumber: supplier.supplierNumber,
        name: supplier.name,
        rowCount: supplier.rowCount,
        totalQuantity: supplier.totalQuantity,
        totalRevenue: supplier.totalRevenue,
        avgMargin: supplier.avgMargin,
        salesScore: supplier.salesScore,
        assortmentScore: supplier.assortmentScore,
        efficiencyScore: supplier.efficiencyScore,
        marginScore: supplier.marginScore,
        totalScore: supplier.totalScore,
        diagnosis: supplier.diagnosis,
        shortAction: supplier.shortAction,
        revenueShare: supplier.revenueShare,
        accumulatedShare: supplier.accumulatedShare,
        tier: supplier.tier,
        profile: supplier.profile,
      }

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: supplierData,
        })
        updated++
      } else {
        await prisma.supplier.create({
          data: {
            ...supplierData,
            userId: user.id,
          },
        })
        imported++
      }
    }

    // Spara uppladdningshistorik
    await prisma.uploadHistory.create({
      data: {
        userId: user.id,
        fileName: file.name,
        recordCount: calculated.length,
        status: "completed",
      },
    })

    return NextResponse.json({
      success: true,
      message: `Import klar! ${calculated.length} leverantörer bearbetade.`,
      stats: {
        articlesProcessed: articles.length,
        suppliersCreated: imported,
        suppliersUpdated: updated,
        totalSuppliers: calculated.length,
      },
    })
  } catch (error) {
    console.error("Raw import error:", error)
    return NextResponse.json(
      { error: "Failed to process import" },
      { status: 500 }
    )
  }
}
