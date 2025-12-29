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
      const supplierNumber = String(row[mapping.supplierNumber] || "").trim().substring(0, 50)
      const supplierName = String(row[mapping.supplierName] || "").trim().substring(0, 200)
      const margin = mapping.margin ? toNumber(row[mapping.margin]) : 0
      const revenue = toNumber(row[mapping.revenue])
      const grossProfit = mapping.grossProfit ? toNumber(row[mapping.grossProfit]) : undefined

      // Skippa rader utan leverantörsnummer eller leverantörsnamn (efter trim)
      if (!supplierNumber || !supplierName || supplierNumber.length === 0 || supplierName.length === 0) {
        continue
      }

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

    // Debug: Räkna total omsättning från artiklar
    const totalRevenueFromArticles = articles.reduce((sum, a) => sum + a.revenue, 0)
    console.log(`[RAW IMPORT] Total omsättning från artiklar (innan aggregering): ${totalRevenueFromArticles.toLocaleString('sv-SE')} kr`)
    console.log(`[RAW IMPORT] Antal artiklar: ${articles.length}`)

    // Aggregera till leverantörsnivå
    const aggregated = aggregateBySupplier(articles)

    // Debug: Räkna total omsättning efter aggregering
    const totalRevenueFromAggregated = aggregated.reduce((sum, s) => sum + s.totalRevenue, 0)
    console.log(`[RAW IMPORT] Total omsättning efter aggregering: ${totalRevenueFromAggregated.toLocaleString('sv-SE')} kr`)
    console.log(`[RAW IMPORT] Antal leverantörer efter aggregering: ${aggregated.length}`)

    // Beräkna alla scores
    const calculated = calculateAllScores(aggregated)

    // Räkna total omsättning från filen för jämförelse
    const fileTotalRevenue = calculated.reduce((sum, s) => sum + s.totalRevenue, 0)
    console.log(`[RAW IMPORT] Total omsättning i filen: ${fileTotalRevenue.toLocaleString('sv-SE')} kr`)

    // Hämta alla befintliga leverantörer en gång för snabb lookup
    const allExistingSuppliersForLookup = await prisma.supplier.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
    })

    console.log(`[RAW IMPORT] Före import: ${allExistingSuppliersForLookup.length} leverantörer i databasen`)
    const beforeTotalRevenue = allExistingSuppliersForLookup.reduce((sum, s) => sum + Number(s.totalRevenue), 0)
    console.log(`[RAW IMPORT] Före import: Total omsättning = ${beforeTotalRevenue.toLocaleString('sv-SE')} kr`)

    // Skapa en map med normaliserade nummer som nyckel
    const existingSuppliersMap = new Map<string, typeof allExistingSuppliersForLookup[0]>()
    for (const supplier of allExistingSuppliersForLookup) {
      const normalized = supplier.supplierNumber.trim().toUpperCase()
      if (!existingSuppliersMap.has(normalized)) {
        existingSuppliersMap.set(normalized, supplier)
      } else {
        // Om det finns dubletter, behåll den första
        console.log(`[RAW IMPORT] VARNING: Dublett hittad för leverantör ${supplier.supplierNumber}`)
      }
    }

    // Spara till databasen
    let imported = 0
    let updated = 0
    const supplierNumbersInFile = new Set<string>() // Samla alla leverantörsnummer från filen

    for (const supplier of calculated) {
      // Normalisera leverantörsnummer (trim för att undvika matchningsproblem)
      const normalizedSupplierNumber = supplier.supplierNumber.trim()
      supplierNumbersInFile.add(normalizedSupplierNumber)

      // Hitta befintlig leverantör med normaliserad matchning
      const existing = existingSuppliersMap.get(normalizedSupplierNumber.toUpperCase())

      const supplierData = {
        supplierNumber: normalizedSupplierNumber,
        name: supplier.name,
        rowCount: supplier.rowCount,
        totalQuantity: supplier.totalQuantity,
        totalRevenue: supplier.totalRevenue,
        totalTB: supplier.totalTB, // Spara totalTB för korrekt TG-beräkning
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
        // Uppdatera och normalisera supplierNumber i databasen
        await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            ...supplierData,
            supplierNumber: normalizedSupplierNumber, // Säkerställ normaliserat nummer
          },
        })
        updated++
        // Ta bort från map så den inte tas bort senare
        existingSuppliersMap.delete(normalizedSupplierNumber.toUpperCase())
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

    // Ta bort alla leverantörer som INTE finns i den nya filen (full refresh)
    // Använd samma data som vi redan hämtat
    const normalizedFileNumbers = new Set(
      Array.from(supplierNumbersInFile)
        .map(n => n.trim().toUpperCase())
        .filter(n => n.length > 0) // Filtrera bort tomma
    )

    // Hitta leverantörer som ska tas bort (normalisera för jämförelse)
    const suppliersToDelete = allExistingSuppliersForLookup.filter(
      existing => {
        const normalizedExisting = existing.supplierNumber.trim().toUpperCase()
        // Ta bort om: inte i filen, eller om leverantörsnummer är tomt
        return normalizedExisting.length === 0 || !normalizedFileNumbers.has(normalizedExisting)
      }
    )

    // Ta bort leverantörer som inte finns i filen
    let deletedCount = 0
    if (suppliersToDelete.length > 0) {
      console.log(`[RAW IMPORT] Tar bort ${suppliersToDelete.length} leverantörer som inte finns i filen`)
      console.log(`[RAW IMPORT] Leverantörer att ta bort:`, suppliersToDelete.map(s => `${s.supplierNumber} (${s.id})`).slice(0, 10))
      
      const deleted = await prisma.supplier.deleteMany({
        where: {
          id: {
            in: suppliersToDelete.map(s => s.id),
          },
        },
      })
      deletedCount = deleted.count
      console.log(`[RAW IMPORT] Raderade ${deleted.count} leverantörer`)
    } else {
      console.log(`[RAW IMPORT] Inga leverantörer att ta bort`)
    }

    // Verifiera att alla leverantörer i filen finns i databasen
    const finalSuppliers = await prisma.supplier.findMany({
      where: { organizationId: ctx.organization.id },
      select: { supplierNumber: true, totalRevenue: true },
    })
    const finalTotalRevenue = finalSuppliers.reduce((sum, s) => sum + Number(s.totalRevenue), 0)
    console.log(`[RAW IMPORT] Efter import: ${finalSuppliers.length} leverantörer, total omsättning: ${finalTotalRevenue.toLocaleString('sv-SE')} kr`)

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
      message: `Import klar! ${calculated.length} leverantörer bearbetade. ${deletedCount > 0 ? `${deletedCount} leverantörer togs bort.` : ''}`,
      stats: {
        articlesProcessed: articles.length,
        suppliersCreated: imported,
        suppliersUpdated: updated,
        suppliersDeleted: deletedCount,
        totalSuppliers: calculated.length,
        existingBeforeDelete: allExistingSuppliersForLookup.length,
        finalTotalRevenue: finalTotalRevenue,
        // Debug-info för att se vad som händer
        debug: {
          totalRevenueFromArticles: totalRevenueFromArticles,
          totalRevenueFromAggregated: totalRevenueFromAggregated,
          fileTotalRevenue: fileTotalRevenue,
          beforeTotalRevenue: beforeTotalRevenue,
        }
      },
    })
  } catch (error) {
    console.error("Raw import error:", error)
    const errorMessage = error instanceof Error ? error.message : "Okänt fel"
    return NextResponse.json(
      { 
        error: "Kunde inte bearbeta filen. Kontrollera formatet och försök igen.",
        details: errorMessage // Lägg till detaljer för debugging
      },
      { status: 500 }
    )
  }
}
