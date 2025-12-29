import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { validateFile, sanitizeFilename, MAX_ROWS } from "@/lib/file-validation"
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
  grossProfit: string  // TB (Bruttovinst) - används för korrekt TG-beräkning
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // SECURITY: Validate file
    const validation = await validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // SECURITY: Safe JSON parse
    let mapping: RawColumnMapping
    try {
      mapping = JSON.parse(mappingStr)
    } catch {
      return NextResponse.json({ error: "Invalid mapping format" }, { status: 400 })
    }

    // Validate mapping has required fields
    if (!mapping.supplierNumber || !mapping.supplierName || !mapping.revenue) {
      return NextResponse.json({ 
        error: "Leverantörsnummer, leverantörsnamn och belopp måste mappas" 
      }, { status: 400 })
    }

    // Parse Excel file with security options
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { 
      type: "array",
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
    })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    // SECURITY: Limit rows
    if (data.length > MAX_ROWS) {
      return NextResponse.json({ 
        error: `Filen innehåller för många rader. Max ${MAX_ROWS.toLocaleString()} rader tillåtet.` 
      }, { status: 400 })
    }

    // Konvertera till rådata format
    const articles: RawArticleData[] = []
    
    for (const row of data) {
      // Hämta värden baserat på mapping
      const articleNumber = mapping.articleNumber 
        ? String(row[mapping.articleNumber] || "").substring(0, 100) 
        : ""
      const description = mapping.description 
        ? String(row[mapping.description] || "").substring(0, 500) 
        : ""
      const quantity = mapping.quantity ? toNumber(row[mapping.quantity]) : 1
      const supplierNumber = String(row[mapping.supplierNumber] || "").substring(0, 50)
      const supplierName = String(row[mapping.supplierName] || "").substring(0, 200)
      const margin = mapping.margin ? toNumber(row[mapping.margin]) : 0
      const revenue = toNumber(row[mapping.revenue])
      const grossProfit = mapping.grossProfit ? toNumber(row[mapping.grossProfit]) : undefined

      // Skippa rader utan leverantörsnummer
      if (!supplierNumber) continue

      articles.push({
        articleNumber,
        description,
        quantity: isNaN(quantity) ? 1 : Math.max(0, quantity),
        supplierNumber,
        supplierName,
        margin: isNaN(margin) ? 0 : Math.max(-100, Math.min(100, margin)),
        revenue: isNaN(revenue) ? 0 : Math.max(0, revenue),
        grossProfit: grossProfit !== undefined && !isNaN(grossProfit) ? Math.max(0, grossProfit) : undefined,
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
          supplierNumber_organizationId: {
            supplierNumber: supplier.supplierNumber,
            organizationId: ctx.organization.id,
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
            organizationId: ctx.organization.id,
          },
        })
        imported++
      }
    }

    // Spara uppladdningshistorik
    await prisma.uploadHistory.create({
      data: {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        fileName: sanitizeFilename(file.name),
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
      { error: "Kunde inte bearbeta filen. Kontrollera formatet och försök igen." },
      { status: 500 }
    )
  }
}
